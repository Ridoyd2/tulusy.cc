import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.web_tools_service import (
    is_safe_target_url,
    run_load_test,
    get_my_ip_details,
    analyze_website_da,
    get_active_outbound_shield,
    ANONYMOUS_USER_AGENT,
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

    print("\n[SUCCESS] ALL WEB TOOLS TESTS PASSED WITH 100% SUCCESS!\n")

if __name__ == "__main__":
    asyncio.run(test_suite())
