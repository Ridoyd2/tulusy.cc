import asyncio
import ipaddress
import json
import math
import re
import socket
import ssl
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from app.config import (
    OUTBOUND_PROXY_URL,
    CF_WORKER_RELAY_URL,
    CF_WORKER_SECRET,
    PROTECTED_SELF_DOMAINS,
)

ANONYMOUS_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

STRIPPED_OUTBOUND_HEADERS = {
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "x-client-ip",
    "forwarded",
    "via",
    "host",
    "origin",
    "referer",
    "content-length",
    "transfer-encoding",
    "connection",
    "x-relay-secret",
    "x-target-url",
    "x-target-method",
    "x-relay-headers",
}

SENSITIVE_INCOMING_HEADERS = {
    "cookie",
    "set-cookie",
    "authorization",
    "proxy-authorization",
    "x-api-key",
    "x-relay-secret",
    "cf-access-jwt-assertion",
}

MAX_LOAD_TEST_BODY_BYTES = 5 * 1024 * 1024  # 5 MB per request stream cap
MAX_DA_HTML_BYTES = 2 * 1024 * 1024         # 2 MB cap for HTML / robots / sitemap

_warp_cache: Dict[str, Any] = {"checked_at": 0.0, "available": False}


def _is_local_warp_listening() -> bool:
    """Auto-detects if Cloudflare WARP proxy (`warp-cli mode proxy`) is listening on 127.0.0.1:40000."""
    now = time.monotonic()
    if now - _warp_cache["checked_at"] < 30.0:
        return bool(_warp_cache["available"])
    _warp_cache["checked_at"] = now
    try:
        with socket.create_connection(("127.0.0.1", 40000), timeout=0.15):
            _warp_cache["available"] = True
            return True
    except OSError:
        _warp_cache["available"] = False
        return False


def get_active_outbound_shield() -> Dict[str, Any]:
    """
    Returns the active outbound IP-masking transport:
    1. Cloudflare Worker Edge Relay (`CF_WORKER_RELAY_URL`)
    2. Explicit HTTP/SOCKS Proxy (`OUTBOUND_PROXY_URL`)
    3. Auto-detected local Cloudflare WARP Proxy (`http://127.0.0.1:40000`)
    4. None (`proxied: False` -> Frontend automatically uses Client Browser Direct mode)
    """
    if CF_WORKER_RELAY_URL:
        return {
            "proxied": True,
            "mode": "cloudflare-worker",
            "relay_url": CF_WORKER_RELAY_URL,
            "proxy_url": None,
        }
    if OUTBOUND_PROXY_URL:
        return {
            "proxied": True,
            "mode": "outbound-proxy",
            "relay_url": None,
            "proxy_url": OUTBOUND_PROXY_URL,
        }
    if _is_local_warp_listening():
        return {
            "proxied": True,
            "mode": "cloudflare-warp",
            "relay_url": None,
            "proxy_url": "http://127.0.0.1:40000",
        }
    return {
        "proxied": False,
        "mode": "browser-direct",
        "relay_url": None,
        "proxy_url": None,
    }


def country_code_to_flag(country_code: str) -> str:
    if not country_code or len(country_code) != 2:
        return "🌐"
    return "".join(chr(127397 + ord(c.upper())) for c in country_code)


def sanitize_error_msg(error_msg: str) -> str:
    """Strips local paths, internal IP patterns, and socket addresses to prevent server IP leakage."""
    if not error_msg:
        return "Request failed"
    cleaned = re.sub(r'\b(?:127\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}\b', '[internal-ip]', error_msg)
    cleaned = re.sub(r'[A-Za-z]:\\[\w\\\.-]+', '[system-path]', cleaned)
    cleaned = re.sub(r'/[\w\.-]+/[\w\.-]+', '[system-path]', cleaned)
    return cleaned


def _is_disallowed_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Returns True for non-global, private, loopback, CGNAT, link-local, multicast, or reserved IPs."""
    mapped = getattr(ip_obj, "ipv4_mapped", None)
    chk = mapped or ip_obj
    return bool(
        (not chk.is_global)
        or chk.is_private
        or chk.is_loopback
        or chk.is_reserved
        or chk.is_link_local
        or chk.is_multicast
        or chk.is_unspecified
    )


def is_safe_target_url(url: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validates that a URL is well-formed and safe against SSRF attacks (both IPv4 and IPv6).
    Blocks private subnets, loopbacks, CGNAT, trailing-dot bypasses, metadata endpoints, and non-http(s) schemes.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() not in ("http", "https"):
            return False, "Only HTTP and HTTPS protocols are supported.", None

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: hostname could not be parsed.", None

        host_lower = hostname.lower().rstrip(".")
        if (
            not host_lower
            or host_lower in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "local", "internal", "metadata.google.internal")
            or host_lower.endswith(".local")
            or host_lower.endswith(".internal")
            or host_lower.endswith(".localhost")
        ):
            return False, "Access to localhost or loopback addresses is restricted for security.", None

        if host_lower in PROTECTED_SELF_DOMAINS or any(host_lower.endswith(f".{d}") for d in PROTECTED_SELF_DOMAINS):
            return False, "Targeting this service's own domain is restricted.", None

        try:
            addr_info = socket.getaddrinfo(host_lower, None)
        except socket.gaierror:
            return False, f"Could not resolve domain name '{host_lower}'. Check DNS or spelling.", None

        if not addr_info:
            return False, f"Could not resolve domain name '{host_lower}'.", None

        primary_ip: Optional[str] = None
        for entry in addr_info:
            ip_str = entry[4][0]
            if "%" in ip_str:
                ip_str = ip_str.split("%")[0]
            ip_obj = ipaddress.ip_address(ip_str)
            if _is_disallowed_ip(ip_obj):
                return False, "Access to private or internal network IP ranges is blocked.", None
            if primary_ip is None:
                primary_ip = ip_str

        return True, "Safe URL", primary_ip
    except Exception as e:
        return False, f"URL validation failed: {sanitize_error_msg(str(e))}", None


async def _safe_fetch_with_redirects(
    client: httpx.AsyncClient,
    target_url: str,
    method: str = "GET",
    base_headers: Optional[Dict[str, str]] = None,
    custom_headers: Optional[Dict[str, str]] = None,
    payload: Optional[str] = None,
    timeout: float = 10.0,
    relay_url: Optional[str] = None,
    max_bytes: int = MAX_DA_HTML_BYTES,
    max_redirects: int = 5,
    skip_initial_validation: bool = False,
    timing_out: Optional[Dict[str, float]] = None,
) -> Tuple[int, Dict[str, str], bytes, str, str]:
    """
    Executes an HTTP request with per-hop SSRF validation on redirects and bounded streaming reads.
    Returns (status_code, lowercased_headers, body_bytes, final_url, http_version).
    """
    current_url = target_url
    current_method = method

    for hop in range(max_redirects + 1):
        if hop > 0 or not skip_initial_validation:
            safe, reason, _ = await asyncio.to_thread(is_safe_target_url, current_url)
            if not safe:
                raise ValueError(f"Blocked unsafe target URL: {reason}" if hop == 0 else f"Blocked unsafe redirect target: {reason}")

        req_headers = dict(base_headers or {})
        if custom_headers:
            if relay_url:
                req_headers["X-Relay-Headers"] = json.dumps(custom_headers)
            else:
                req_headers.update(custom_headers)

        dispatch_url = current_url
        if relay_url:
            req_headers["X-Target-URL"] = current_url
            req_headers["X-Target-Method"] = current_method
            if CF_WORKER_SECRET:
                req_headers["X-Relay-Secret"] = CF_WORKER_SECRET
            dispatch_url = relay_url

        req_content = payload if current_method in ("POST", "PUT") else None

        hop_start = time.perf_counter()
        async with client.stream(
            current_method,
            dispatch_url,
            headers=req_headers,
            content=req_content,
            timeout=timeout,
            follow_redirects=False,
        ) as resp:
            ttfb_ms = round((time.perf_counter() - hop_start) * 1000, 1)
            status_code = resp.status_code
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            http_version = resp.http_version or "HTTP/1.1"

            if status_code in (301, 302, 303, 307, 308) and hdrs.get("location"):
                if hop >= max_redirects:
                    raise ValueError("Too many HTTP redirects.")
                current_url = urljoin(current_url, hdrs["location"])
                if status_code == 303 or (status_code in (301, 302) and current_method == "POST"):
                    current_method = "GET"
                continue

            if timing_out is not None:
                timing_out["ttfb_ms"] = ttfb_ms

            chunks: List[bytes] = []
            read_bytes = 0
            async for chunk in resp.aiter_bytes():
                if read_bytes >= max_bytes:
                    break
                remaining = max_bytes - read_bytes
                piece = chunk[:remaining]
                chunks.append(piece)
                read_bytes += len(piece)

            return status_code, hdrs, b"".join(chunks), current_url, http_version

    raise ValueError("Too many HTTP redirects.")


# ============================================================================
# 1. LOAD TESTER ENGINE
# ============================================================================

async def run_load_test(
    url: str,
    requests_count: int = 20,
    concurrency: int = 5,
    timeout: float = 10.0,
    method: str = "GET",
    custom_headers: Optional[Dict[str, str]] = None,
    payload: Optional[str] = None
) -> Dict[str, Any]:
    """
    Runs an asynchronous concurrent load test against the target URL.
    Ensures VPS IP is never exposed in output metrics or logs and bounds memory usage.
    """
    requests_count = max(1, min(100, requests_count))
    concurrency = max(1, min(20, concurrency))
    timeout = max(1.0, min(30.0, timeout))
    method = method.upper() if method.upper() in ("GET", "POST", "HEAD", "PUT") else "GET"

    is_safe, reason, _ = await asyncio.to_thread(is_safe_target_url, url)
    if not is_safe:
        raise ValueError(reason)

    shield = await asyncio.to_thread(get_active_outbound_shield)
    relay_url = shield.get("relay_url")
    proxy_url = shield.get("proxy_url")

    base_headers = {
        "User-Agent": ANONYMOUS_USER_AGENT,
        "Accept": "*/*",
        "Connection": "keep-alive",
    }
    sanitized_custom: Dict[str, str] = {}
    if custom_headers:
        for k, v in custom_headers.items():
            if k.lower().strip() not in STRIPPED_OUTBOUND_HEADERS:
                sanitized_custom[k] = v

    semaphore = asyncio.Semaphore(concurrency)
    results: List[Dict[str, Any]] = []

    async def single_worker(req_id: int, client: httpx.AsyncClient):
        async with semaphore:
            req_start = time.perf_counter()
            status_code = 0
            size_bytes = 0
            err_str = None

            try:
                status_code, resp_hdrs, body, _, _ = await _safe_fetch_with_redirects(
                    client,
                    url,
                    method=method,
                    base_headers=base_headers,
                    custom_headers=sanitized_custom,
                    payload=payload,
                    timeout=timeout,
                    relay_url=relay_url,
                    max_bytes=MAX_LOAD_TEST_BODY_BYTES,
                    skip_initial_validation=True,
                )
                relay_err = resp_hdrs.get("x-relay-error", "") if relay_url else ""
                if relay_err == "tls":
                    status_code = 0
                    err_str = "TLS Verification Error"
                elif relay_err == "upstream":
                    status_code = 0
                    err_str = "Connection Error"
                else:
                    size_bytes = len(body)
            except httpx.TimeoutException:
                err_str = "Timeout"
            except httpx.ConnectError as ce:
                msg = str(ce).lower()
                err_str = "TLS Verification Error" if ("ssl" in msg or "cert" in msg) else "Connection Error"
            except httpx.HTTPError as he:
                err_str = sanitize_error_msg(type(he).__name__)
            except Exception as ex:
                err_str = sanitize_error_msg(str(ex))

            req_duration_ms = round((time.perf_counter() - req_start) * 1000, 2)
            results.append({
                "id": req_id,
                "status_code": status_code,
                "duration_ms": req_duration_ms,
                "bytes": size_bytes,
                "error": err_str,
                "success": 200 <= status_code < 400,
            })

    total_start = time.perf_counter()
    client_kwargs: Dict[str, Any] = {
        "verify": True,
        "follow_redirects": False,
    }
    if proxy_url:
        client_kwargs["proxy"] = proxy_url

    async with httpx.AsyncClient(**client_kwargs) as client:
        tasks = [single_worker(i + 1, client) for i in range(requests_count)]
        await asyncio.gather(*tasks)

    total_duration_sec = max(0.001, time.perf_counter() - total_start)
    results.sort(key=lambda x: x["id"])

    latencies = [r["duration_ms"] for r in results if r["status_code"] > 0]
    success_count = sum(1 for r in results if r["success"])
    fail_count = requests_count - success_count
    total_bytes = sum(r["bytes"] for r in results)

    status_distribution: Dict[str, int] = {}
    code_summary = {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, "errors": 0}
    for r in results:
        code = r["status_code"]
        if code > 0:
            status_distribution[str(code)] = status_distribution.get(str(code), 0) + 1
            if 200 <= code < 300:
                code_summary["2xx"] += 1
            elif 300 <= code < 400:
                code_summary["3xx"] += 1
            elif 400 <= code < 500:
                code_summary["4xx"] += 1
            elif 500 <= code < 600:
                code_summary["5xx"] += 1
        else:
            code_summary["errors"] += 1

    latencies_sorted = sorted(latencies) if latencies else [0]
    n = len(latencies_sorted)

    def percentile(p: float) -> float:
        if not latencies_sorted:
            return 0.0
        idx = max(0, min(math.ceil(n * p) - 1, n - 1))
        return latencies_sorted[idx]

    avg_latency = round(sum(latencies) / n, 2) if n > 0 else 0.0
    rps = round(requests_count / total_duration_sec, 2)
    transfer_rate_kbps = round((total_bytes / 1024) / total_duration_sec, 2)

    return {
        "target_url": url,
        "method": method,
        "total_requests": requests_count,
        "concurrency": concurrency,
        "total_duration_sec": round(total_duration_sec, 3),
        "successful_requests": success_count,
        "failed_requests": fail_count,
        "success_rate_percent": round((success_count / requests_count) * 100, 1),
        "requests_per_second": rps,
        "transfer_rate_kbps": transfer_rate_kbps,
        "total_bytes_transferred": total_bytes,
        "latency_stats_ms": {
            "min": round(min(latencies_sorted), 2) if latencies else 0.0,
            "avg": avg_latency,
            "median_p50": round(percentile(0.50), 2),
            "p75": round(percentile(0.75), 2),
            "p90": round(percentile(0.90), 2),
            "p95": round(percentile(0.95), 2),
            "p99": round(percentile(0.99), 2),
            "max": round(max(latencies_sorted), 2) if latencies else 0.0,
        },
        "code_summary": code_summary,
        "status_distribution": status_distribution,
        "timeline": results[:100],
    }


# ============================================================================
# 2. WHAT'S MY IP ENGINE
# ============================================================================

def _safe_float(val: Any) -> float:
    """Safely coerces coordinates or numeric metadata to a finite float, defaulting to 0.0."""
    if val is None or isinstance(val, bool):
        return 0.0
    try:
        num = float(val)
        return num if math.isfinite(num) else 0.0
    except (TypeError, ValueError):
        return 0.0


def _clean_asn(raw_as: Any) -> str:
    """Normalizes ASN string to clean AS number format (e.g. 'AS13335')."""
    if not raw_as:
        return "N/A"
    as_str = str(raw_as).strip()
    if not as_str or as_str.upper() in ("N/A", "NONE", "UNKNOWN"):
        return "N/A"
    match = re.match(r"^(AS\d+|\d+)", as_str, re.IGNORECASE)
    if match:
        val = match.group(1).upper()
        return val if val.startswith("AS") else f"AS{val}"
    return as_str


async def get_ip_intel(client_ip: str) -> Dict[str, Any]:
    """
    Fetches geolocation and ASN data with automatic fallback across providers.
    """
    try:
        ip_obj = ipaddress.ip_address(client_ip)
        is_private_or_local = _is_disallowed_ip(ip_obj)
    except ValueError:
        is_private_or_local = True

    if is_private_or_local:
        return {
            "ip": client_ip,
            "country": "Local Network",
            "country_code": "LO",
            "flag": "",
            "region": "Loopback / LAN",
            "city": "Local Client",
            "postal": "N/A",
            "lat": 0.0,
            "lon": 0.0,
            "timezone": "UTC",
            "isp": "Local Area Network",
            "org": "Private / Direct Connection",
            "asn": "Local",
        }

    providers = [
        f"http://ip-api.com/json/{client_ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
        f"https://ipwho.is/{client_ip}",
        f"https://ipapi.co/{client_ip}/json/",
    ]

    async with httpx.AsyncClient(timeout=3.5) as client:
        for provider_url in providers:
            try:
                resp = await client.get(provider_url)
                if resp.status_code == 200:
                    data = resp.json()

                    if data.get("status") == "success" or "countryCode" in data:
                        country_code = data.get("countryCode") or data.get("country_code") or ""
                        raw_as = data.get("as") or data.get("asn") or "N/A"
                        return {
                            "ip": data.get("query") or client_ip,
                            "country": data.get("country") or "Unknown",
                            "country_code": country_code,
                            "flag": country_code_to_flag(country_code),
                            "region": data.get("regionName") or data.get("region") or "",
                            "city": data.get("city") or "",
                            "postal": (data.get("zip") or data.get("postal") or "N/A") or "N/A",
                            "lat": _safe_float(data.get("lat") if data.get("lat") is not None else data.get("latitude")),
                            "lon": _safe_float(data.get("lon") if data.get("lon") is not None else data.get("longitude")),
                            "timezone": data.get("timezone") or "UTC",
                            "isp": data.get("isp") or data.get("org") or "Unknown ISP",
                            "org": data.get("org") or data.get("isp") or "",
                            "asn": _clean_asn(raw_as),
                        }

                    if data.get("success") is True:
                        country_code = data.get("country_code") or ""
                        conn = data.get("connection") or {}
                        raw_asn = conn.get("asn") or data.get("asn") or "N/A"
                        tz_raw = data.get("timezone")
                        tz_val = tz_raw.get("id", "UTC") if isinstance(tz_raw, dict) else (tz_raw or "UTC")
                        return {
                            "ip": data.get("ip") or client_ip,
                            "country": data.get("country") or "Unknown",
                            "country_code": country_code,
                            "flag": country_code_to_flag(country_code),
                            "region": data.get("region") or "",
                            "city": data.get("city") or "",
                            "postal": (data.get("postal") or "N/A") or "N/A",
                            "lat": _safe_float(data.get("latitude")),
                            "lon": _safe_float(data.get("longitude")),
                            "timezone": tz_val or "UTC",
                            "isp": conn.get("isp") or data.get("isp") or conn.get("org") or "Unknown ISP",
                            "org": conn.get("org") or conn.get("isp") or "",
                            "asn": _clean_asn(raw_asn),
                        }

                    if not data.get("error") and ("country_name" in data or "country_code" in data):
                        country_code = data.get("country_code") or ""
                        return {
                            "ip": data.get("ip") or client_ip,
                            "country": data.get("country_name") or data.get("country") or "Unknown",
                            "country_code": country_code,
                            "flag": country_code_to_flag(country_code),
                            "region": data.get("region") or "",
                            "city": data.get("city") or "",
                            "postal": (data.get("postal") or "N/A") or "N/A",
                            "lat": _safe_float(data.get("latitude")),
                            "lon": _safe_float(data.get("longitude")),
                            "timezone": data.get("timezone") or "UTC",
                            "isp": data.get("org") or "Unknown ISP",
                            "org": data.get("org") or "",
                            "asn": _clean_asn(data.get("asn") or "N/A"),
                        }
            except Exception:
                continue

    return {
        "ip": client_ip,
        "country": "Unknown",
        "country_code": "UN",
        "flag": "",
        "region": "Unknown",
        "city": "Unknown",
        "postal": "N/A",
        "lat": 0.0,
        "lon": 0.0,
        "timezone": "UTC",
        "isp": "Unknown ISP",
        "org": "N/A",
        "asn": "N/A",
    }


async def get_my_ip_details(
    raw_ip: str,
    headers: Dict[str, str],
    user_agent: str,
    is_self: bool = True,
) -> Dict[str, Any]:
    """
    Parses full client IP and network intelligence without blocking the event loop.
    """
    reverse_dns = "None"
    try:
        ip_obj = ipaddress.ip_address(raw_ip)
        if not _is_disallowed_ip(ip_obj):
            host_res = await asyncio.wait_for(asyncio.to_thread(socket.gethostbyaddr, raw_ip), timeout=1.2)
            reverse_dns = host_res[0]
    except Exception:
        pass

    geo = await get_ip_intel(raw_ip)

    ua_lower = user_agent.lower()
    browser = "Unknown Browser"
    if "edgios" in ua_lower or "edga" in ua_lower or "edg" in ua_lower:
        browser = "Microsoft Edge"
    elif "opr/" in ua_lower or "opera" in ua_lower:
        browser = "Opera"
    elif "crios" in ua_lower or ("chrome" in ua_lower and "edg" not in ua_lower and "opr/" not in ua_lower):
        browser = "Google Chrome"
    elif "fxios" in ua_lower or "firefox" in ua_lower:
        browser = "Mozilla Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Apple Safari"

    os_name = "Unknown OS"
    if "iphone" in ua_lower or "ipad" in ua_lower or "ipod" in ua_lower:
        os_name = "iOS"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "windows" in ua_lower:
        os_name = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"

    return {
        **geo,
        "ip_version": "IPv6" if ":" in raw_ip else "IPv4",
        "reverse_dns": reverse_dns,
        "is_self": is_self,
        "client_browser": browser if is_self else "",
        "client_os": os_name if is_self else "",
        "user_agent": user_agent if is_self else "",
        "headers": (
            {
                k: v
                for k, v in headers.items()
                if k.lower() not in SENSITIVE_INCOMING_HEADERS and not k.lower().startswith("cookie")
            }
            if is_self
            else {}
        ),
    }


# ============================================================================
# 3. WEBSITE DA & SEO CHECKER ENGINE
# ============================================================================

def get_ssl_cert_info(hostname: str) -> Dict[str, Any]:
    """Inspects SSL certificate via native dual-stack TLS socket connection."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=4.0) as raw_sock:
            with ctx.wrap_socket(raw_sock, server_hostname=hostname) as s:
                s.settimeout(4.0)
                cert = s.getpeercert()
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                subject_dict = dict(x[0] for x in cert.get("subject", []))
                not_after_str = cert.get("notAfter")

                days_left = -1
                if not_after_str:
                    expiry_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                    days_left = (expiry_dt - datetime.now(timezone.utc)).days

                return {
                    "valid": days_left >= 0,
                    "issuer": issuer_dict.get("organizationName") or issuer_dict.get("commonName", "Trusted CA"),
                    "subject": subject_dict.get("commonName", hostname),
                    "expiry_date": not_after_str,
                    "days_left": max(0, days_left),
                    "is_expired": days_left < 0,
                    "tls_version": s.version(),
                }
    except Exception as e:
        return {
            "valid": False,
            "error": sanitize_error_msg(str(e)),
            "issuer": "None / Invalid",
            "days_left": 0,
            "is_expired": True,
            "tls_version": "None",
        }


async def analyze_website_da(domain_or_url: str) -> Dict[str, Any]:
    """
    Conducts Domain Authority, Page Authority, Security, and SEO analysis with SSRF & byte bounds.
    """
    raw_input = domain_or_url.strip()
    if not raw_input:
        raise ValueError("Please provide a domain name or URL.")
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", raw_input):
        target_url = f"https://{raw_input}"
    else:
        target_url = raw_input

    parsed = urlparse(target_url)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname:
        raise ValueError("Only valid HTTP and HTTPS domain URLs are supported.")

    hostname = parsed.hostname.lower().rstrip(".")
    port_suffix = f":{parsed.port}" if parsed.port else ""
    auth_prefix = ""
    if parsed.username:
        auth_prefix = f"{parsed.username}:{parsed.password}@" if parsed.password else f"{parsed.username}@"
    host_formatted = f"[{hostname}]" if ":" in hostname else hostname
    netloc_norm = f"{auth_prefix}{host_formatted}{port_suffix}"
    target_url = parsed._replace(scheme=parsed.scheme.lower(), netloc=netloc_norm).geturl()

    is_safe, reason, resolved_ip = await asyncio.to_thread(is_safe_target_url, target_url)
    if not is_safe:
        raise ValueError(reason)

    shield = await asyncio.to_thread(get_active_outbound_shield)
    relay_url = shield.get("relay_url")
    proxy_url = shield.get("proxy_url")

    dns_records: Dict[str, Any] = {"A": [], "IP": resolved_ip}
    try:
        host_info = await asyncio.to_thread(socket.gethostbyname_ex, hostname)
        dns_records["A"] = list(set(host_info[2]))
    except Exception:
        if resolved_ip:
            dns_records["A"] = [resolved_ip]

    base_headers = {
        "User-Agent": ANONYMOUS_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    client_kwargs: Dict[str, Any] = {
        "timeout": 10.0,
        "follow_redirects": False,
        "verify": True,
    }
    if proxy_url:
        client_kwargs["proxy"] = proxy_url

    ttfb_ms = 0.0
    html_content = ""
    status_code = 0
    response_headers: Dict[str, str] = {}
    http_version = "HTTP/1.1"
    final_url = target_url
    ssl_verify_failed_via_proxy = False

    ssl_info: Dict[str, Any]
    if not shield.get("proxied"):
        ssl_info = await asyncio.to_thread(get_ssl_cert_info, hostname)
        # If target TLS itself is invalid, fall back cleanly so on-page SEO can still report alongside SSL Invalid
        if not ssl_info.get("valid") and target_url.startswith("https://"):
            client_kwargs["verify"] = False

    timing_meta: Dict[str, float] = {}
    try:
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                status_code, response_headers, body_bytes, final_url, http_version = await _safe_fetch_with_redirects(
                    client,
                    target_url,
                    method="GET",
                    base_headers=base_headers,
                    timeout=10.0,
                    relay_url=relay_url,
                    max_bytes=MAX_DA_HTML_BYTES,
                    skip_initial_validation=True,
                    timing_out=timing_meta,
                )
        except httpx.ConnectError as ce:
            err_lower = str(ce).lower()
            if proxy_url and not relay_url and ("ssl" in err_lower or "cert" in err_lower):
                ssl_verify_failed_via_proxy = True
                retry_kwargs = {**client_kwargs, "verify": False}
                timing_meta.clear()
                t0 = time.perf_counter()
                async with httpx.AsyncClient(**retry_kwargs) as client:
                    status_code, response_headers, body_bytes, final_url, http_version = await _safe_fetch_with_redirects(
                        client,
                        target_url,
                        method="GET",
                        base_headers=base_headers,
                        timeout=10.0,
                        relay_url=relay_url,
                        max_bytes=MAX_DA_HTML_BYTES,
                        skip_initial_validation=True,
                        timing_out=timing_meta,
                    )
            else:
                raise
        ttfb_ms = timing_meta.get("ttfb_ms", round((time.perf_counter() - t0) * 1000, 1))
        if relay_url and response_headers.get("x-relay-error") == "upstream":
            raise ValueError("Could not connect to website: Upstream connection failed")
        html_content = body_bytes.decode("utf-8", errors="replace")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Could not connect to website: {sanitize_error_msg(str(e))}")

    if shield.get("proxied"):
        is_https = final_url.startswith("https://")
        relay_err = response_headers.get("x-relay-error", "")
        if not is_https:
            ssl_info = {
                "valid": False,
                "issuer": "No HTTPS",
                "subject": hostname,
                "expiry_date": None,
                "days_left": 0,
                "is_expired": True,
                "tls_version": "None",
            }
        elif ssl_verify_failed_via_proxy or status_code in (525, 526) or relay_err == "tls":
            ssl_info = {
                "valid": False,
                "issuer": f"Invalid / Untrusted Certificate (Edge TLS HTTP {status_code or 'Verify Failed'})",
                "subject": hostname,
                "expiry_date": None,
                "days_left": 0,
                "is_expired": True,
                "tls_version": "Failed",
            }
        elif status_code >= 500:
            ssl_info = {
                "valid": False,
                "issuer": f"Origin / TLS Unreachable (HTTP {status_code})",
                "subject": hostname,
                "expiry_date": None,
                "days_left": None,
                "is_expired": False,
                "tls_version": "Unverified",
            }
        else:
            ssl_info = {
                "valid": True,
                "issuer": "Trusted CA (Verified via Edge TLS)",
                "subject": hostname,
                "expiry_date": None,
                "days_left": None,
                "is_expired": False,
                "tls_version": "TLS 1.2 / 1.3",
            }

    soup = BeautifulSoup(html_content, "html.parser")

    title_tag = soup.find("title")
    title_text = title_tag.get_text(strip=True) if title_tag else ""

    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if desc_tag and desc_tag.get("content"):
        meta_desc = desc_tag["content"].strip()

    canonical_url = ""
    for link_tag in soup.find_all("link"):
        rels = link_tag.get("rel") or []
        if isinstance(rels, str):
            rels = rels.split()
        if any(r.lower() == "canonical" for r in rels) and link_tag.get("href"):
            canonical_url = link_tag["href"].strip()
            break

    h1_tags = [h.get_text(strip=True) for h in soup.find_all("h1") if h.get_text(strip=True)]
    h2_count = len(soup.find_all("h2"))
    h3_count = len(soup.find_all("h3"))

    images = soup.find_all("img")
    total_images = len(images)
    images_without_alt = sum(1 for img in images if not img.get("alt") or not img.get("alt").strip())

    og_title = ""
    og_tag = soup.find("meta", property=re.compile(r"^og:title$", re.I))
    if og_tag and og_tag.get("content"):
        og_title = og_tag["content"]

    og_image = ""
    og_img_tag = soup.find("meta", property=re.compile(r"^og:image$", re.I))
    if og_img_tag and og_img_tag.get("content"):
        og_image = og_img_tag["content"]

    viewport_tag = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
    has_viewport = bool(viewport_tag)

    for invisible in soup(["script", "style", "noscript", "template"]):
        invisible.decompose()
    text_content = soup.get_text(separator=" ", strip=True)
    words = [w for w in text_content.split() if len(w) > 1]
    word_count = len(words)

    # Probe robots.txt (and extract declared Sitemap directives) + /sitemap.xml against final host
    robots_ok = False
    sitemap_ok = False
    declared_sitemaps: List[str] = []
    final_parsed = urlparse(final_url)
    probe_host = (final_parsed.hostname or hostname).lower().rstrip(".")
    probe_host_fmt = f"[{probe_host}]" if ":" in probe_host else probe_host
    probe_port = f":{final_parsed.port}" if final_parsed.port else ""
    target_scheme = final_parsed.scheme if final_parsed.scheme in ("http", "https") else (parsed.scheme if parsed.scheme in ("http", "https") else "https")
    schemes_to_try = [target_scheme] + (["http"] if target_scheme == "https" else [])

    probe_kwargs: Dict[str, Any] = {
        "timeout": 4.0,
        "follow_redirects": False,
        "verify": True if (shield.get("proxied") and not ssl_verify_failed_via_proxy) or ssl_info.get("valid") else False,
    }
    if proxy_url:
        probe_kwargs["proxy"] = proxy_url

    probe_headers = {"User-Agent": ANONYMOUS_USER_AGENT}

    async with httpx.AsyncClient(**probe_kwargs) as client:
        for proto in schemes_to_try:
            if not robots_ok:
                try:
                    p_url = f"{proto}://{probe_host_fmt}{probe_port}/robots.txt"
                    r_status, _, r_body, _, _ = await _safe_fetch_with_redirects(
                        client, p_url, base_headers=probe_headers, timeout=4.0, relay_url=relay_url, max_bytes=512 * 1024
                    )
                    r_text = r_body.decode("utf-8", errors="replace")
                    if r_status == 200 and len(r_text) > 5 and not r_text.strip().lower().startswith("<!doctype"):
                        robots_ok = True
                        base_root = f"{proto}://{probe_host_fmt}{probe_port}/"
                        declared_sitemaps.extend(
                            urljoin(base_root, sm.strip())
                            for sm in re.findall(r"(?im)^\s*sitemap:\s*(\S+)", r_text)
                        )
                except Exception:
                    pass

            if not sitemap_ok:
                try:
                    s_url = f"{proto}://{probe_host_fmt}{probe_port}/sitemap.xml"
                    s_status, _, s_body, _, _ = await _safe_fetch_with_redirects(
                        client, s_url, base_headers=probe_headers, timeout=4.0, relay_url=relay_url, max_bytes=MAX_DA_HTML_BYTES
                    )
                    s_lower = s_body.decode("utf-8", errors="replace").lower()
                    if s_status == 200 and ("<urlset" in s_lower or "<sitemapindex" in s_lower):
                        sitemap_ok = True
                except Exception:
                    pass

        if not sitemap_ok and declared_sitemaps:
            for sm_url in declared_sitemaps[:3]:
                try:
                    s_status, _, s_body, _, _ = await _safe_fetch_with_redirects(
                        client, sm_url, base_headers=probe_headers, timeout=4.0, relay_url=relay_url, max_bytes=MAX_DA_HTML_BYTES
                    )
                    s_lower = s_body.decode("utf-8", errors="replace").lower()
                    if s_status == 200 and ("<urlset" in s_lower or "<sitemapindex" in s_lower):
                        sitemap_ok = True
                        break
                except Exception:
                    continue

    sec_headers = {
        "Strict-Transport-Security": "strict-transport-security" in response_headers,
        "Content-Security-Policy": "content-security-policy" in response_headers,
        "X-Frame-Options": "x-frame-options" in response_headers,
        "X-Content-Type-Options": "x-content-type-options" in response_headers,
        "Referrer-Policy": "referrer-policy" in response_headers,
        "Permissions-Policy": "permissions-policy" in response_headers,
    }
    sec_header_score = sum(1 for present in sec_headers.values() if present)

    da_score = 30
    tld = hostname.split(".")[-1]
    if tld in ("edu", "gov"):
        da_score += 35
    elif tld in ("org", "io", "ai", "co", "dev"):
        da_score += 15
    elif tld in ("com", "net"):
        da_score += 12
    elif tld in ("info", "xyz", "top", "online", "club"):
        da_score -= 8

    clean_host = hostname[4:] if hostname.startswith("www.") else hostname
    domain_length = len(clean_host.split(".")[0])
    if domain_length <= 5:
        da_score += 12
    elif domain_length <= 8:
        da_score += 6
    elif domain_length > 20:
        da_score -= 6

    if ssl_info.get("valid"):
        da_score += 10
        days_left = ssl_info.get("days_left")
        if days_left is None or days_left > 30:
            da_score += 5
    else:
        da_score -= 15

    if sec_header_score >= 3:
        da_score += 8
    if title_text and 10 <= len(title_text) <= 70:
        da_score += 5
    if meta_desc and 50 <= len(meta_desc) <= 165:
        da_score += 5
    if len(h1_tags) == 1:
        da_score += 4
    if word_count > 300:
        da_score += 5
    if robots_ok:
        da_score += 3
    if sitemap_ok:
        da_score += 3
    if canonical_url:
        da_score += 3
    if ttfb_ms < 300:
        da_score += 5
    elif ttfb_ms > 1200:
        da_score -= 5

    da_score = max(1, min(99, da_score))
    pa_score = max(1, min(99, int(da_score * 0.92 + (5 if len(h1_tags) == 1 else 0) + (3 if og_title else 0))))

    spam_score = 2
    if not ssl_info.get("valid"):
        spam_score += 35
    if not title_text:
        spam_score += 20
    if not meta_desc:
        spam_score += 15
    if total_images > 0 and (images_without_alt / total_images) > 0.8:
        spam_score += 15
    if sec_header_score == 0:
        spam_score += 8
    spam_score = max(1, min(95, spam_score))

    seo_score = 0
    if title_text:
        seo_score += 15 if 10 <= len(title_text) <= 70 else 8
    if meta_desc:
        seo_score += 15 if 50 <= len(meta_desc) <= 165 else 8
    if len(h1_tags) == 1:
        seo_score += 10
    elif len(h1_tags) > 1:
        seo_score += 5
    if has_viewport:
        seo_score += 10
    if ssl_info.get("valid"):
        seo_score += 15
    if canonical_url:
        seo_score += 10
    if robots_ok:
        seo_score += 5
    if sitemap_ok:
        seo_score += 5
    if og_title:
        seo_score += 5
    if sec_header_score >= 2:
        seo_score += 10

    seo_score = max(5, min(100, seo_score))
    grade = "A+" if seo_score >= 95 else "A" if seo_score >= 85 else "B" if seo_score >= 70 else "C" if seo_score >= 55 else "D" if seo_score >= 40 else "F"

    recommendations = []
    if not ssl_info.get("valid"):
        recommendations.append({"type": "critical", "title": "Missing or Invalid SSL", "desc": "Enable HTTPS with a valid SSL/TLS certificate to protect users and boost rank."})
    else:
        days_rem = ssl_info.get("days_left")
        ssl_desc = (
            f"Protected by {ssl_info.get('issuer')} ({days_rem} days remaining)."
            if days_rem is not None
            else f"Protected by {ssl_info.get('issuer')}."
        )
        recommendations.append({"type": "passed", "title": "Valid SSL Certificate", "desc": ssl_desc})

    if not title_text:
        recommendations.append({"type": "critical", "title": "Missing Title Tag", "desc": "Add a unique descriptive <title> tag (between 30-60 characters)."})
    elif len(title_text) < 20 or len(title_text) > 70:
        recommendations.append({"type": "warning", "title": "Optimize Title Length", "desc": f"Your title is {len(title_text)} chars. Recommended length is 30–60 characters."})
    else:
        recommendations.append({"type": "passed", "title": "Ideal Title Tag Length", "desc": f"Perfect length ({len(title_text)} characters)."})

    if not meta_desc:
        recommendations.append({"type": "critical", "title": "Missing Meta Description", "desc": "Add a meta description (50–160 chars) to improve Google click-through rates."})
    elif len(meta_desc) < 50 or len(meta_desc) > 165:
        recommendations.append({"type": "warning", "title": "Meta Description Length", "desc": f"Current length is {len(meta_desc)} chars. Ideal is 120–160 characters."})
    else:
        recommendations.append({"type": "passed", "title": "Well-Formed Meta Description", "desc": "Optimized description within the ideal snippet length."})

    if len(h1_tags) == 0:
        recommendations.append({"type": "critical", "title": "No <h1> Heading Found", "desc": "Add exactly one primary <h1> heading summarizing your page topic."})
    elif len(h1_tags) > 1:
        recommendations.append({"type": "warning", "title": "Multiple <h1> Tags Detected", "desc": f"Found {len(h1_tags)} H1 headings. Best practice is to use only 1 H1 per page."})
    else:
        h1_preview = h1_tags[0][:40] + ("..." if len(h1_tags[0]) > 40 else "")
        recommendations.append({"type": "passed", "title": "Single <h1> Heading", "desc": f"'{h1_preview}'"})

    if total_images > 0 and images_without_alt > 0:
        recommendations.append({"type": "warning", "title": "Images Missing Alt Attributes", "desc": f"{images_without_alt} of {total_images} images lack alt attributes for accessibility and SEO."})
    elif total_images > 0:
        recommendations.append({"type": "passed", "title": "All Images Have Alt Attributes", "desc": f"All {total_images} images are accessible."})

    if not robots_ok:
        recommendations.append({"type": "warning", "title": "robots.txt Not Accessible", "desc": "Create a robots.txt file to guide search engine crawlers."})
    else:
        recommendations.append({"type": "passed", "title": "robots.txt Found", "desc": "Crawlers can navigate your indexing rules."})

    if not sitemap_ok:
        recommendations.append({"type": "warning", "title": "sitemap.xml Not Found", "desc": "Provide an XML sitemap at /sitemap.xml to accelerate page discovery."})
    else:
        recommendations.append({"type": "passed", "title": "XML Sitemap Active", "desc": "Sitemap detected and accessible."})

    return {
        "domain": hostname,
        "target_url": final_url,
        "status_code": status_code,
        "ttfb_ms": ttfb_ms,
        "http_version": http_version,
        "server": response_headers.get("server") or "Not disclosed",
        "scores": {
            "da": da_score,
            "pa": pa_score,
            "spam_score": spam_score,
            "seo_health": seo_score,
            "grade": grade,
            "da_rating": "Top Authority" if da_score >= 80 else "High Authority" if da_score >= 60 else "Moderate" if da_score >= 40 else "Growing / New",
        },
        "serp_preview": {
            "title": title_text or f"{hostname} - Official Website",
            "url": final_url,
            "snippet": meta_desc or f"Explore {hostname}. Discover features, services, and official content available on {hostname}.",
        },
        "on_page_seo": {
            "title": title_text,
            "title_length": len(title_text),
            "meta_description": meta_desc,
            "meta_description_length": len(meta_desc),
            "canonical_url": canonical_url,
            "h1_count": len(h1_tags),
            "h1_samples": h1_tags[:3],
            "h2_count": h2_count,
            "h3_count": h3_count,
            "word_count": word_count,
            "total_images": total_images,
            "images_missing_alt": images_without_alt,
            "has_viewport": has_viewport,
            "has_opengraph": bool(og_title or og_image),
            "og_title": og_title,
            "og_image": og_image,
        },
        "ssl": ssl_info,
        "security_headers": sec_headers,
        "technical": {
            "robots_txt": robots_ok,
            "sitemap_xml": sitemap_ok,
            "dns_a_records": dns_records.get("A", []),
            "server_ip": dns_records.get("IP", "N/A"),
            "encoding": response_headers.get("x-original-content-encoding") or response_headers.get("content-encoding") or "none",
        },
        "recommendations": recommendations,
    }
