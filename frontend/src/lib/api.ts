import {
  ConversionSettings,
  DomainAuditResult,
  IpDetailsResult,
  LoadTestCodeSummary,
  LoadTestRequestResult,
  LoadTestResult,
  ProxyStatus,
} from '../types';
import { SITE_DOMAIN } from './site';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (
      (port === '3000' || port === '3001' || port === '3480') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    ) {
      return `${protocol}//${hostname}:8480`;
    }
    return '';
  }
  const serverBase = process.env.BACKEND_URL || 'http://127.0.0.1:8480';
  return serverBase.replace(/\/+$/, '');
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/health`, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function convertSingleFile(
  file: File,
  targetFormat: string,
  settings: ConversionSettings,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; fileName: string }> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_format', targetFormat.toLowerCase().replace('.', ''));
  formData.append('quality', settings.quality.toString());
  if (settings.width) formData.append('width', settings.width.toString());
  if (settings.height) formData.append('height', settings.height.toString());
  formData.append('maintain_aspect_ratio', settings.maintainAspectRatio ? 'true' : 'false');
  formData.append('dpi', settings.dpi.toString());
  formData.append('grayscale', settings.grayscale ? 'true' : 'false');
  formData.append('bg_color', settings.bgColor || '#FFFFFF');

  if (onProgress) onProgress(30);

  const response = await fetch(`${base}/api/convert/universal`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = 'Conversion failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = `Server responded with status ${response.status}`;
    }
    throw new Error(errorDetail);
  }

  if (onProgress) onProgress(85);

  const blob = await response.blob();

  // Extract filename from header if available (supporting both standard filename= and RFC 5987 filename*=UTF-8'')
  const dotIdx = file.name.lastIndexOf('.');
  const baseName = dotIdx > 0 ? file.name.substring(0, dotIdx) : file.name;
  const cleanTarget = targetFormat.toLowerCase().replace('.', '');
  let fileName = `${baseName}.${cleanTarget}`;
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=(?:UTF-8|utf-8)''([^;\s]+)/);
    const asciiMatch = disposition.match(/filename="?([^";]+)"?/);
    if (utf8Match && utf8Match[1]) {
      try {
        fileName = decodeURIComponent(utf8Match[1]);
      } catch {
        fileName = utf8Match[1];
      }
    } else if (asciiMatch && asciiMatch[1]) {
      fileName = asciiMatch[1].trim();
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/zip') && !fileName.toLowerCase().endsWith('.zip')) {
    fileName = `${baseName}_pages.zip`;
  }

  if (onProgress) onProgress(100);

  return { blob, fileName };
}

export async function mergeImagesToPdf(
  files: File[],
  outputName: string = 'merged_document.pdf'
): Promise<{ blob: Blob; fileName: string }> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('output_name', outputName);

  const response = await fetch(`${base}/api/convert/images-to-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = 'Images to PDF merger failed';
    try {
      const errJson = (await response.json()) as { detail?: string };
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = `Images to PDF merger failed (status ${response.status})`;
    }
    throw new Error(errorDetail);
  }

  const blob = await response.blob();
  return { blob, fileName: outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf` };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function executeBrowserLoadTest(params: {
  url: string;
  requests_count: number;
  concurrency: number;
  timeout?: number;
  method?: string;
  payload?: string;
  cacheBust?: boolean;
  signal?: AbortSignal;
}): Promise<LoadTestResult> {
  const targetUrl = params.url.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error('Invalid target URL format.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are supported.');
  }

  const hostLower = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  const protectedDomains = ['tulusy.cc', 'tulusy.com', 'toolsy4u.com', SITE_DOMAIN.toLowerCase().replace(/\.+$/, '')];
  if (
    !hostLower ||
    hostLower === 'localhost' ||
    hostLower.endsWith('.localhost') ||
    hostLower.endsWith('.local') ||
    hostLower.endsWith('.internal') ||
    hostLower === '127.0.0.1' ||
    hostLower === '0.0.0.0' ||
    hostLower === '::1' ||
    protectedDomains.some(d => hostLower === d || hostLower.endsWith(`.${d}`))
  ) {
    throw new Error('Targeting local loopback or this service domain is restricted.');
  }

  const totalRequests = Math.max(1, Math.min(100, params.requests_count || 20));
  const concurrency = Math.max(1, Math.min(20, params.concurrency || 5));
  const timeoutMs = Math.max(1000, Math.min(30000, (params.timeout || 10) * 1000));
  const method = (params.method || 'GET').toUpperCase();
  const canUseNoCors = method === 'GET' || method === 'HEAD' || method === 'POST';

  const results: LoadTestRequestResult[] = [];

  let nextId = 1;
  let preferNoCors = false;
  let opaqueCount = 0;
  const totalStart = performance.now();

  const runSingle = async (reqId: number) => {
    if (params.signal?.aborted) {
      throw new DOMException('Benchmark aborted', 'AbortError');
    }

    let reqStart = performance.now();
    let statusCode = 0;
    let sizeBytes = 0;
    let errStr: string | null = null;
    let isOpaque = false;

    let benchUrl = targetUrl;
    if (params.cacheBust) {
      const cacheUrl = new URL(targetUrl);
      cacheUrl.searchParams.set('_t', `${Date.now()}_${reqId}`);
      benchUrl = cacheUrl.toString();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });

    const fetchOpaque = async () => {
      const opaqueResp = await fetch(benchUrl, {
        method,
        body: method === 'POST' ? params.payload : undefined,
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller.signal,
      });
      if (opaqueResp.type === 'opaque') {
        isOpaque = true;
        statusCode = 0;
        opaqueCount++;
      } else if (opaqueResp.ok) {
        statusCode = opaqueResp.status || 200;
      } else {
        statusCode = opaqueResp.status || 0;
        if (!statusCode) errStr = 'Connection Error';
      }
    };

    try {
      if (preferNoCors && canUseNoCors) {
        await fetchOpaque();
      } else {
        try {
          const corsResp = await fetch(benchUrl, {
            method,
            body: method === 'POST' || method === 'PUT' ? params.payload : undefined,
            cache: 'no-store',
            mode: 'cors',
            signal: controller.signal,
          });
          statusCode = corsResp.status || 0;
          const buf = await corsResp.arrayBuffer();
          sizeBytes = buf.byteLength;
        } catch (corsErr: unknown) {
          if ((corsErr instanceof Error && corsErr.name === 'AbortError') || params.signal?.aborted) {
            throw corsErr;
          }
          if (!canUseNoCors) {
            errStr = `CORS blocked (${method} unsupported in no-CORS)`;
          } else {
            // Fallback to opaque no-cors timing when target endpoint does not send CORS headers
            preferNoCors = true;
            reqStart = performance.now();
            try {
              await fetchOpaque();
            } catch (opaqueErr: unknown) {
              if (!(opaqueErr instanceof Error && opaqueErr.name === 'AbortError')) {
                preferNoCors = false;
              }
              throw opaqueErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (params.signal?.aborted) {
        throw new DOMException('Benchmark aborted', 'AbortError');
      }
      if (err instanceof Error && err.name === 'AbortError') {
        errStr = 'Timeout';
      } else {
        errStr = 'Connection Error';
      }
    } finally {
      clearTimeout(timer);
      params.signal?.removeEventListener('abort', onParentAbort);
    }

    const durationMs = Math.round((performance.now() - reqStart) * 100) / 100;
    results.push({
      id: reqId,
      status_code: statusCode,
      duration_ms: durationMs,
      bytes: sizeBytes,
      error: errStr,
      success: statusCode >= 200 && statusCode < 400,
      ...(isOpaque ? { opaque: true } : {}),
    });
  };

  if (totalRequests > 1 && canUseNoCors) {
    // Run request #1 alone first so any CORS -> no-cors detection happens once instead of N times concurrently
    nextId = 2;
    await runSingle(1);
  }

  const runWorker = async () => {
    while (nextId <= totalRequests) {
      if (params.signal?.aborted) {
        throw new DOMException('Benchmark aborted', 'AbortError');
      }
      const reqId = nextId++;
      await runSingle(reqId);
    }
  };

  const remaining = totalRequests - (nextId - 1);
  if (remaining > 0) {
    const workers = Array.from({ length: Math.min(concurrency, remaining) }, () => runWorker());
    await Promise.all(workers);
  }

  const totalDurationSec = Math.max(0.001, (performance.now() - totalStart) / 1000);
  results.sort((a, b) => a.id - b.id);

  const latencies = results.filter(r => r.status_code > 0 || r.opaque).map(r => r.duration_ms);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success && !r.opaque).length;
  const totalBytes = results.reduce((acc, r) => acc + r.bytes, 0);

  const statusDistribution: Record<string, number> = {};
  const codeSummary: LoadTestCodeSummary = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, errors: 0, opaque: 0 };

  for (const r of results) {
    if (r.opaque) {
      codeSummary.opaque = (codeSummary.opaque || 0) + 1;
      continue;
    }
    const code = r.status_code;
    if (code > 0) {
      statusDistribution[String(code)] = (statusDistribution[String(code)] || 0) + 1;
      if (code >= 200 && code < 300) codeSummary['2xx']++;
      else if (code >= 300 && code < 400) codeSummary['3xx']++;
      else if (code >= 400 && code < 500) codeSummary['4xx']++;
      else if (code >= 500 && code < 600) codeSummary['5xx']++;
    } else {
      codeSummary.errors++;
    }
  }

  const sorted = latencies.length > 0 ? [...latencies].sort((a, b) => a - b) : [0];
  const n = sorted.length;
  const pct = (p: number) => sorted[Math.max(0, Math.min(Math.ceil(n * p) - 1, n - 1))] || 0;
  const avg = latencies.length > 0 ? Math.round((latencies.reduce((a, b) => a + b, 0) / n) * 100) / 100 : 0;

  return {
    target_url: targetUrl,
    method,
    execution_mode: 'browser-direct',
    total_requests: totalRequests,
    concurrency,
    total_duration_sec: Math.round(totalDurationSec * 1000) / 1000,
    successful_requests: successCount,
    failed_requests: failCount,
    success_rate_percent: Math.round((successCount / totalRequests) * 1000) / 10,
    requests_per_second: Math.round((totalRequests / totalDurationSec) * 100) / 100,
    transfer_rate_kbps: Math.round((totalBytes / 1024 / totalDurationSec) * 100) / 100,
    total_bytes_transferred: totalBytes,
    latency_stats_ms: {
      min: latencies.length > 0 ? Math.round(sorted[0] * 100) / 100 : 0,
      avg,
      median_p50: Math.round(pct(0.5) * 100) / 100,
      p75: Math.round(pct(0.75) * 100) / 100,
      p90: Math.round(pct(0.9) * 100) / 100,
      p95: Math.round(pct(0.95) * 100) / 100,
      p99: Math.round(pct(0.99) * 100) / 100,
      max: latencies.length > 0 ? Math.round(sorted[n - 1] * 100) / 100 : 0,
    },
    code_summary: codeSummary,
    status_distribution: statusDistribution,
    opaque_responses: opaqueCount,
    timeline: results.slice(0, 100),
  };
}

export async function fetchProxyStatus(): Promise<ProxyStatus> {
  try {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/tools/proxy-status`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return { proxied: false, mode: 'browser-direct' };
    return (await res.json()) as ProxyStatus;
  } catch {
    return { proxied: false, mode: 'browser-direct' };
  }
}

export async function executeLoadTest(params: {
  url: string;
  requests_count: number;
  concurrency: number;
  timeout?: number;
  method?: string;
  payload?: string;
  executionMode?: 'browser' | 'edge';
  signal?: AbortSignal;
}): Promise<LoadTestResult> {
  // Default to Client Browser execution so the VPS origin IP never connects to external target URLs
  if (params.executionMode !== 'edge') {
    return executeBrowserLoadTest(params);
  }

  const base = getApiBaseUrl();
  const { signal, ...bodyPayload } = params;
  const response = await fetch(`${base}/api/tools/load-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(bodyPayload),
  });

  if (response.status === 403) {
    // Backend blocked direct unproxied connection to protect VPS IP -> fallback seamlessly to Client Browser
    const browserResult = await executeBrowserLoadTest(params);
    return {
      ...browserResult,
      fallback_notice:
        'Edge Relay is currently unavailable on this server. Executed in Client Browser Mode to protect the server origin IP.',
    };
  }

  if (!response.ok) {
    let detail = 'Load test failed';
    try {
      const err = (await response.json()) as { detail?: string };
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as LoadTestResult;
}

export async function fetchMyIp(customIp?: string): Promise<IpDetailsResult> {
  const base = getApiBaseUrl();
  const query = customIp && customIp.trim() ? `?ip=${encodeURIComponent(customIp.trim())}` : '';
  const response = await fetch(`${base}/api/tools/my-ip${query}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = 'Could not fetch IP info';
    try {
      const err = (await response.json()) as { detail?: string };
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  const data = (await response.json()) as IpDetailsResult;

  // If running on localhost and no custom IP was specified, try detecting public IP client-side
  // so the user sees their real public network details rather than 127.0.0.1 loopback.
  if (!customIp && (data.ip === '127.0.0.1' || data.ip === '::1' || data.ip === 'localhost')) {
    try {
      const ipifyRes = await fetch('https://api.ipify.org?format=json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      if (ipifyRes.ok) {
        const ipifyData = (await ipifyRes.json()) as { ip?: string };
        if (ipifyData?.ip && ipifyData.ip !== data.ip) {
          const publicRes = await fetch(`${base}/api/tools/my-ip?ip=${encodeURIComponent(ipifyData.ip)}`, {
            method: 'GET',
            cache: 'no-store',
          });
          if (publicRes.ok) {
            return (await publicRes.json()) as IpDetailsResult;
          }
        }
      }
    } catch {
      // Fallback gracefully to the local loopback response if offline or blocked
    }
  }

  return data;
}

export async function measureApiRtt(): Promise<number> {
  const base = getApiBaseUrl();
  const t0 = performance.now();
  const res = await fetch(`${base}/api/health`, { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return Math.round(performance.now() - t0);
}

export async function analyzeDomainAuthority(domain: string): Promise<DomainAuditResult> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/tools/da-checker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });

  if (!response.ok) {
    let detail = 'Domain analysis failed';
    try {
      const err = (await response.json()) as { detail?: string };
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as DomainAuditResult;
}
