import { ConversionSettings } from '../types';
import { SITE_DOMAIN } from './site';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (
      (port === '3000' || port === '3001') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    ) {
      return `${protocol}//${hostname}:8000`;
    }
    return '';
  }
  return 'http://127.0.0.1:8000';
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
    throw new Error('Images to PDF merger failed');
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
}): Promise<any> {
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

  const hostLower = parsedUrl.hostname.toLowerCase();
  const protectedDomains = ['tulusy.cc', 'tulusy.com', 'toolsy4u.com', SITE_DOMAIN.toLowerCase()];
  if (
    hostLower === 'localhost' ||
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

  const results: Array<{
    id: number;
    status_code: number;
    duration_ms: number;
    bytes: number;
    error: string | null;
    success: boolean;
  }> = [];

  let nextId = 1;
  const totalStart = performance.now();

  const runWorker = async () => {
    while (nextId <= totalRequests) {
      const reqId = nextId++;
      const reqStart = performance.now();
      let statusCode = 0;
      let sizeBytes = 0;
      let errStr: string | null = null;

      // Append cache-buster so browser does not serve cached responses during load benchmark
      const sep = targetUrl.includes('?') ? '&' : '?';
      const benchUrl = `${targetUrl}${sep}_t=${Date.now()}_${reqId}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        try {
          const corsResp = await fetch(benchUrl, {
            method,
            body: method === 'POST' || method === 'PUT' ? params.payload : undefined,
            cache: 'no-store',
            mode: 'cors',
            signal: controller.signal,
          });
          statusCode = corsResp.status || 200;
          const buf = await corsResp.arrayBuffer();
          sizeBytes = buf.byteLength;
        } catch (corsErr: any) {
          if (corsErr?.name === 'AbortError') {
            throw corsErr;
          }
          // Fallback to opaque no-cors timing when target endpoint does not send CORS headers
          const opaqueResp = await fetch(benchUrl, {
            method: method === 'PUT' ? 'POST' : method,
            body: method === 'POST' ? params.payload : undefined,
            cache: 'no-store',
            mode: 'no-cors',
            signal: controller.signal,
          });
          if (opaqueResp.type === 'opaque' || opaqueResp.ok) {
            statusCode = 200;
          } else {
            statusCode = opaqueResp.status || 0;
            if (!statusCode) errStr = 'Connection Error';
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          errStr = 'Timeout';
        } else {
          errStr = 'Connection Error';
        }
      } finally {
        clearTimeout(timer);
      }

      const durationMs = Math.round((performance.now() - reqStart) * 100) / 100;
      results.push({
        id: reqId,
        status_code: statusCode,
        duration_ms: durationMs,
        bytes: sizeBytes,
        error: errStr,
        success: statusCode >= 200 && statusCode < 400,
      });
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, () => runWorker());
  await Promise.all(workers);

  const totalDurationSec = Math.max(0.001, (performance.now() - totalStart) / 1000);
  results.sort((a, b) => a.id - b.id);

  const latencies = results.filter(r => r.status_code > 0).map(r => r.duration_ms);
  const successCount = results.filter(r => r.success).length;
  const failCount = totalRequests - successCount;
  const totalBytes = results.reduce((acc, r) => acc + r.bytes, 0);

  const statusDistribution: Record<string, number> = {};
  const codeSummary = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, errors: 0 };

  for (const r of results) {
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
  const pct = (p: number) => sorted[Math.min(Math.floor(n * p), n - 1)] || 0;
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
    timeline: results.slice(0, 100),
  };
}

export async function executeLoadTest(params: {
  url: string;
  requests_count: number;
  concurrency: number;
  timeout?: number;
  method?: string;
  payload?: string;
  executionMode?: 'browser' | 'edge';
}): Promise<any> {
  // Default to Client Browser execution so the VPS origin IP never connects to external target URLs
  if (params.executionMode !== 'edge') {
    return executeBrowserLoadTest(params);
  }

  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/tools/load-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (response.status === 403) {
    // Backend blocked direct unproxied connection to protect VPS IP -> fallback seamlessly to Client Browser
    return executeBrowserLoadTest(params);
  }

  if (!response.ok) {
    let detail = 'Load test failed';
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

export async function fetchMyIp(customIp?: string): Promise<any> {
  const base = getApiBaseUrl();
  const query = customIp && customIp.trim() ? `?ip=${encodeURIComponent(customIp.trim())}` : '';
  const response = await fetch(`${base}/api/tools/my-ip${query}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = 'Could not fetch IP info';
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  const data = await response.json();

  // If running on localhost and no custom IP was specified, try detecting public IP client-side
  // so the user sees their real public network details rather than 127.0.0.1 loopback.
  if (!customIp && (data.ip === '127.0.0.1' || data.ip === '::1' || data.ip === 'localhost')) {
    try {
      const ipifyRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (ipifyRes.ok) {
        const ipifyData = await ipifyRes.json();
        if (ipifyData?.ip && ipifyData.ip !== data.ip) {
          const publicRes = await fetch(`${base}/api/tools/my-ip?ip=${encodeURIComponent(ipifyData.ip)}`, {
            method: 'GET',
            cache: 'no-store',
          });
          if (publicRes.ok) {
            return await publicRes.json();
          }
        }
      }
    } catch {
      // Fallback gracefully to the local loopback response if offline or blocked
    }
  }

  return data;
}

export async function analyzeDomainAuthority(domain: string): Promise<any> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/tools/da-checker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });

  if (!response.ok) {
    let detail = 'Domain analysis failed';
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}
