import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import httpx

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.web_tools_service import (
    ANONYMOUS_USER_AGENT,
    _safe_fetch_with_redirects,
    analyze_website_da,
    get_active_outbound_shield,
    get_my_ip_details,
    is_safe_target_url,
    run_load_test,
)

async def test_suite():
    print("[TEST] Starting Web Tools Automated Test Suite...")

    # 1. Test SSRF & Self-Domain Origin Protection
    print("\n--- 1. Testing SSRF & Origin Protection ---")
    safe_ok, _, _ = is_safe_target_url("https://example.com")
    assert safe_ok is True, "example.com should be safe"
    print("[PASS] Valid public URL allowed")

    unsafe_local, reason, _ = is_safe_target_url("http://127.0.0.1:8000")
    assert unsafe_local is False, "127.0.0.1 should be blocked"
    print(f"[PASS] Loopback blocked: {reason}")

    unsafe_host, reason2, _ = is_safe_target_url("http://localhost/admin")
    assert unsafe_host is False, "localhost should be blocked"
    print(f"[PASS] Localhost blocked: {reason2}")

    unsafe_self, reason_self, _ = is_safe_target_url("https://tulusy.com/api/health")
    assert unsafe_self is False, "Self-domain tulusy.com should be blocked"
    unsafe_cc, reason_cc, _ = is_safe_target_url("https://tulusy.cc/api/health")
    assert unsafe_cc is False, "Self-domain tulusy.cc should be blocked"
    print(f"[PASS] Self-domains blocked: {reason_self} | {reason_cc}")

    assert "tulusy" not in ANONYMOUS_USER_AGENT.lower() and "toolsy4u" not in ANONYMOUS_USER_AGENT.lower(), "Outbound User-Agent must not leak service identity"
    shield = get_active_outbound_shield()
    assert "mode" in shield
    print(f"[PASS] Outbound User-Agent anonymized & Shield Status verified ({shield['mode']})")

    # 2. Test Load Tester (against public reliable endpoint example.com)
    print("\n--- 2. Testing Load Tester Engine ---")
    load_res = await run_load_test(
        url="https://example.com",
        requests_count=5,
        concurrency=2,
        timeout=5.0,
        method="GET"
    )
    assert load_res["total_requests"] == 5
    assert "latency_stats_ms" in load_res
    assert "p95" in load_res["latency_stats_ms"]
    assert "requests_per_second" in load_res
    assert len(load_res["timeline"]) == 5
    print(f"[PASS] Load test completed successfully:")
    print(f"       Requests: {load_res['successful_requests']}/{load_res['total_requests']} | RPS: {load_res['requests_per_second']} | Avg Latency: {load_res['latency_stats_ms']['avg']}ms")

    # 3. Test What's My IP details
    print("\n--- 3. Testing What's My IP Engine ---")
    mock_headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", "accept-language": "en-US"}
    ip_res = await get_my_ip_details("8.8.8.8", mock_headers, mock_headers["user-agent"])
    assert "ip" in ip_res
    assert ip_res["ip"] == "8.8.8.8"
    assert "country" in ip_res
    assert "client_browser" in ip_res
    print(f"[PASS] IP details retrieved: {ip_res['ip']} ({ip_res.get('city')}, {ip_res.get('country')}) | ISP: {ip_res.get('isp')} | Browser: {ip_res.get('client_browser')}")

    # 4. Test Website DA & SEO Checker
    print("\n--- 4. Testing Website DA & SEO Checker ---")
    da_res = await analyze_website_da("example.com")
    assert "scores" in da_res
    assert "da" in da_res["scores"]
    assert "pa" in da_res["scores"]
    assert "ssl" in da_res
    assert "on_page_seo" in da_res
    assert "serp_preview" in da_res
    print(f"[PASS] DA Check for example.com:")
    print(f"       Domain Authority (DA): {da_res['scores']['da']}/100 ({da_res['scores']['da_rating']})")
    print(f"       Page Authority (PA): {da_res['scores']['pa']}/100 | Grade: {da_res['scores']['grade']}")
    print(f"       SSL Status: {'Valid' if da_res['ssl']['valid'] else 'Invalid'} (Issuer: {da_res['ssl'].get('issuer')})")
    print(f"       SERP Title: {da_res['serp_preview']['title']}")

    # 5. Test Redirect SSRF Protection
    print("\n--- 5. Testing Redirect SSRF Hop Validation ---")
    def redirect_to_loopback(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "http://127.0.0.1:8080/internal"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(redirect_to_loopback)) as mock_client:
        blocked = False
        try:
            await _safe_fetch_with_redirects(mock_client, "https://example.com")
        except ValueError as ve:
            if "redirect" in str(ve).lower() or "private" in str(ve).lower():
                blocked = True
        assert blocked, "Redirect to 127.0.0.1 must be blocked"
    print("[PASS] Redirect SSRF to loopback blocked")

    # 6. Test Proxied Relay TLS Error & Neutral SSL Reporting
    print("\n--- 6. Testing Proxied Relay TLS Error Handling ---")
    with patch(
        "app.services.web_tools_service.get_active_outbound_shield",
        return_value={"proxied": True, "mode": "cloudflare-worker", "relay_url": "https://relay.example.invalid", "proxy_url": None},
    ):
        async def mock_tls_526(*args, **kwargs):
            return 526, {"x-relay-error": "tls"}, b"", "https://expired.badssl.com", "HTTP/2"

        with patch("app.services.web_tools_service._safe_fetch_with_redirects", side_effect=mock_tls_526):
            res_526 = await analyze_website_da("expired.badssl.com")
            assert res_526["ssl"]["valid"] is False, "526 relay error must report valid=False"
            assert res_526["ssl"]["is_expired"] is True
            assert res_526["ssl"]["days_left"] == 0

        async def mock_ok_relay(*args, **kwargs):
            return 200, {}, b"<html><head><title>Healthy Site</title></head><body><h1>Ok</h1></body></html>", "https://example.com", "HTTP/2"

        with patch("app.services.web_tools_service._safe_fetch_with_redirects", side_effect=mock_ok_relay):
            res_ok = await analyze_website_da("example.com")
            assert res_ok["ssl"]["valid"] is True
            assert res_ok["ssl"]["days_left"] is None, "Relayed HTTPS should set days_left=None rather than fabricating 90"

        async def mock_downgrade_relay(*args, **kwargs):
            return 200, {}, b"<html><title>Downgraded</title></html>", "http://example.com", "HTTP/1.1"

        with patch("app.services.web_tools_service._safe_fetch_with_redirects", side_effect=mock_downgrade_relay):
            res_down = await analyze_website_da("https://example.com")
            assert res_down["ssl"]["valid"] is False, "HTTPS->HTTP downgrade must not claim valid SSL"
            assert res_down["ssl"]["issuer"] == "No HTTPS"
    print("[PASS] Proxied Relay 526 TLS invalid, downgrade handling, & neutral days_left verified")

    # 7. Test My-IP Sensitive Header Redaction
    print("\n--- 7. Testing My-IP Header Redaction ---")
    leaky_headers = {
        "user-agent": "Mozilla/5.0 Chrome/120.0.0.0",
        "accept-language": "en-US",
        "authorization": "Bearer topsecret",
        "x-api-key": "secret-api-key",
        "x-relay-secret": "relay-tok",
        "cf-access-jwt-assertion": "jwt-tok",
        "cookie": "session=abc",
    }
    redacted_res = await get_my_ip_details("127.0.0.1", leaky_headers, leaky_headers["user-agent"])
    returned_hdrs = {k.lower() for k in redacted_res["headers"].keys()}
    for forbidden in ("authorization", "x-api-key", "x-relay-secret", "cf-access-jwt-assertion", "cookie"):
        assert forbidden not in returned_hdrs, f"Sensitive header leaked: {forbidden}"
    assert "accept-language" in returned_hdrs
    print("[PASS] Sensitive incoming headers redacted from /my-ip response")

    print("\n[SUCCESS] ALL WEB TOOLS TESTS PASSED WITH 100% SUCCESS!\n")

if __name__ == "__main__":
    asyncio.run(test_suite())
