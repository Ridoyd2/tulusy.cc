import asyncio
import ipaddress
from typing import Any, Dict, Literal, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from app.config import PROTECT_VPS_IP
from app.services.web_tools_service import (
    run_load_test,
    get_my_ip_details,
    analyze_website_da,
    get_active_outbound_shield,
)

router = APIRouter(prefix="/api/tools", tags=["Web & Network Utilities"])


class LoadTestRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=2048, description="Target website or API endpoint (http/https)")
    requests_count: int = Field(20, ge=1, le=100, description="Total number of requests to execute (1-100)")
    concurrency: int = Field(5, ge=1, le=20, description="Simultaneous concurrent connections (1-20)")
    timeout: float = Field(10.0, ge=1.0, le=30.0, description="Per-request timeout in seconds")
    method: Literal["GET", "POST", "HEAD", "PUT"] = Field("GET", description="HTTP Method (GET, POST, HEAD, PUT)")
    custom_headers: Optional[Dict[str, str]] = Field(None, description="Custom request headers")
    payload: Optional[str] = Field(None, max_length=1_000_000, description="Request body payload for POST/PUT")

    @field_validator("method", mode="before")
    @classmethod
    def _normalize_method(cls, v: Any) -> str:
        return str(v or "GET").strip().upper()

    @field_validator("custom_headers")
    @classmethod
    def _validate_headers(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        if v is None:
            return None
        if len(v) > 30:
            raise ValueError("At most 30 custom headers are allowed.")
        for k, val in v.items():
            if len(str(k)) > 128 or len(str(val)) > 4096 or "\n" in str(k) or "\r" in str(k) or "\n" in str(val) or "\r" in str(val):
                raise ValueError("Invalid custom header name or value.")
        return v


class DaCheckRequest(BaseModel):
    domain: str = Field(..., min_length=1, max_length=2048, description="Domain name or website URL (e.g., example.com)")


def _is_public_prod_request(request: Request) -> bool:
    host_header = (request.headers.get("host") or "").split(":")[0].lower().rstrip(".")
    return bool(
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for")
        or (host_header and host_header not in ("127.0.0.1", "localhost", "testserver", "::1"))
    )


def _extract_valid_ip_candidate(raw: Optional[str]) -> Optional[str]:
    if not raw or not raw.strip():
        return None
    candidate = raw.strip()
    try:
        ipaddress.ip_address(candidate)
        return candidate
    except ValueError:
        return None


@router.get("/proxy-status")
async def proxy_status_endpoint():
    """Returns whether the backend has an active outbound IP shield (Cloudflare Worker, Proxy, or WARP)."""
    shield = await asyncio.to_thread(get_active_outbound_shield)
    return {
        "proxied": shield["proxied"],
        "mode": shield["mode"],
    }


@router.post("/load-test")
async def load_test_endpoint(request: Request, req: LoadTestRequest):
    """
    Executes a high-performance concurrent website load test.
    Never exposes internal VPS or server IP to external target sites in production.
    """
    shield = await asyncio.to_thread(get_active_outbound_shield)
    if PROTECT_VPS_IP and _is_public_prod_request(request) and not shield.get("proxied"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Server-side relay is unavailable on this node. "
                "Switch to Client Browser Mode to run benchmarks directly from your browser."
            ),
        )

    try:
        results = await run_load_test(
            url=req.url,
            requests_count=req.requests_count,
            concurrency=req.concurrency,
            timeout=req.timeout,
            method=req.method,
            custom_headers=req.custom_headers,
            payload=req.payload
        )
        results["execution_mode"] = shield["mode"]
        return results
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Load test execution error: {str(e)}")

@router.get("/my-ip")
async def my_ip_endpoint(request: Request, ip: Optional[str] = Query(None, description="Optional IPv4/IPv6 address to inspect")):
    """
    Detects caller public IP address (or inspects a specified IP), geolocation, ISP, ASN, and client headers.
    """
    try:
        is_self = not bool(ip and ip.strip())
        if not is_self:
            candidate = _extract_valid_ip_candidate(ip)
            if not candidate:
                raise HTTPException(status_code=400, detail=f"Invalid IP address format: '{ip.strip()}'")
            client_ip = candidate
        else:
            forwarded_for = request.headers.get("x-forwarded-for")
            first_xff = forwarded_for.split(",")[0] if forwarded_for else None
            client_ip = (
                _extract_valid_ip_candidate(request.headers.get("cf-connecting-ip"))
                or _extract_valid_ip_candidate(first_xff)
                or _extract_valid_ip_candidate(request.headers.get("x-real-ip"))
                or (request.client.host if request.client else "127.0.0.1")
            )

        user_agent = request.headers.get("user-agent", "Unknown Browser")
        headers_dict = dict(request.headers)

        ip_info = await get_my_ip_details(client_ip, headers_dict, user_agent, is_self=is_self)
        return ip_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve IP details: {str(e)}")

@router.post("/da-checker")
async def da_checker_endpoint(request: Request, req: DaCheckRequest):
    """
    Analyzes Domain Authority (DA 1-100), Page Authority (PA), Spam Score,
    SSL Certificate, Security Headers, and On-Page SEO audit.
    """
    shield = await asyncio.to_thread(get_active_outbound_shield)
    if PROTECT_VPS_IP and _is_public_prod_request(request) and not shield.get("proxied"):
        raise HTTPException(
            status_code=403,
            detail="Outbound edge relay is not currently active on this server. Please try again later.",
        )

    try:
        analysis = await analyze_website_da(req.domain)
        return analysis
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Domain analysis failed: {str(e)}")
