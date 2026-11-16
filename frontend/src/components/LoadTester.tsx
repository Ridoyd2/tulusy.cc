'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Clock,
  Layers,
  Info
} from 'lucide-react';
import { executeLoadTest, fetchProxyStatus, downloadBlob } from '../lib/api';

export const LoadTester: React.FC = () => {
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [requestsCount, setRequestsCount] = useState(25);
  const [concurrency, setConcurrency] = useState(5);
  const [method, setMethod] = useState('GET');
  const [executionMode, setExecutionMode] = useState<'browser' | 'edge'>('browser');
  const [proxyStatus, setProxyStatus] = useState<{ proxied: boolean; mode: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => {
    fetchProxyStatus().then(setProxyStatus);
  }, []);

  const applyPreset = (presetUrl: string, reqs: number, conc: number) => {
    setUrl(presetUrl);
    setRequestsCount(reqs);
    setConcurrency(conc);
  };

  const handleStartTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
      setUrl(targetUrl);
    }

    const edgeUnavailable = executionMode === 'edge' && proxyStatus !== null && !proxyStatus.proxied;

    try {
      const data = await executeLoadTest({
        url: targetUrl,
        requests_count: requestsCount,
        concurrency: concurrency,
        method: method,
        executionMode: edgeUnavailable ? 'browser' : executionMode,
      });
      if (edgeUnavailable && !data.fallback_notice) {
        data.fallback_notice =
          'Edge Relay is not configured on the server (CF_WORKER_RELAY_URL / WARP). Executed in Client Browser Mode to protect the server origin IP.';
      }
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Load test execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (format: 'json' | 'csv') => {
    if (!results) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `load_test_${Date.now()}.json`);
    } else {
      let csv = 'Request ID,Status Code,Duration (ms),Bytes,Success,Error\n';
      results.timeline.forEach((r: any) => {
        const escapedErr = `"${String(r.error || '').replace(/"/g, '""')}"`;
        csv += `${r.id},${r.status_code},${r.duration_ms},${r.bytes},${r.success},${escapedErr}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `load_test_${Date.now()}.csv`);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          HTTP Latency & Load Benchmark
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Measure endpoint throughput, latency percentiles (p50–p99), concurrent worker scaling, and HTTP status distribution.
        </p>
      </div>

      {/* Control Panel */}
      <div className="panel rounded-xl p-4 sm:p-6 space-y-5">
        <form onSubmit={handleStartTest} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex gap-2 flex-1">
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                disabled={isLoading}
                aria-label="HTTP Method"
                className="w-24 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-mono font-semibold focus:outline-none focus:border-blue-600 cursor-pointer shrink-0"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
                <option value="PUT">PUT</option>
              </select>

              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com or API endpoint"
                disabled={isLoading}
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Benchmark...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Benchmark</span>
                </>
              )}
            </button>
          </div>

          {/* Sliders: Requests & Concurrency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  Total Requests
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {requestsCount}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={requestsCount}
                onChange={e => setRequestsCount(Number(e.target.value))}
                disabled={isLoading}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Concurrency
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {concurrency} workers
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={concurrency}
                onChange={e => setConcurrency(Number(e.target.value))}
                disabled={isLoading}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                <span>1</span>
                <span>10</span>
                <span>20</span>
              </div>
            </div>
          </div>

          {/* Quick Presets & Execution Engine Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Profiles:</span>
              <button
                type="button"
                onClick={() => applyPreset('https://httpbin.org/get', 10, 2)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Light Probe (10 / 2c)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('https://example.com', 50, 5)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Standard (50 / 5c)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('https://httpbin.org/get', 100, 10)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Burst (100 / 10c)
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Node:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setExecutionMode('browser')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    executionMode === 'browser'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Dispatches requests directly from your browser so the server origin IP is never exposed"
                >
                  Client Browser (Zero Server IP)
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode('edge')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    executionMode === 'edge'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Routes requests via Cloudflare Edge Worker / WARP Proxy when configured"
                >
                  Edge Relay
                </button>
              </div>
            </div>
          </div>
        </form>

        {executionMode === 'edge' && proxyStatus && !proxyStatus.proxied && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              Edge Relay is not configured on the server (`CF_WORKER_RELAY_URL` / WARP). Benchmarks will run in <strong>Client Browser Mode</strong> so the server IP stays hidden.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold">Benchmark Failed</p>
              <p className="mt-0.5 text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results View */}
      {results && (
        <div className="space-y-4">
          {results.fallback_notice && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>{results.fallback_notice}</span>
            </div>
          )}

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="panel p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Mean Latency</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {results.latency_stats_ms.avg} <span className="text-xs font-normal text-slate-400">ms</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                min {results.latency_stats_ms.min}ms · max {results.latency_stats_ms.max}ms
              </p>
            </div>

            <div className="panel p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Throughput</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {results.requests_per_second} <span className="text-xs font-normal text-slate-400">req/s</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                {results.total_bytes_transferred === 0 && results.opaque_responses > 0
                  ? 'Opaque (No-CORS)'
                  : `${results.transfer_rate_kbps} KB/s`}
              </p>
            </div>

            <div className="panel p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Success Rate</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {results.success_rate_percent}%
              </p>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                {results.successful_requests}/{results.total_requests} OK
              </p>
            </div>

            <div className="panel p-4 rounded-xl space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Wall Time</span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {results.total_duration_sec} <span className="text-xs font-normal text-slate-400">s</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                {results.concurrency}w · {results.execution_mode === 'browser-direct' ? 'Client Browser' : results.execution_mode || 'Edge Relay'}
              </p>
            </div>
          </div>

          {/* Percentiles & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Latency Percentiles */}
            <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Latency Distribution
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                {[
                  { label: 'p50 (Median)', val: results.latency_stats_ms.median_p50 },
                  { label: 'p75', val: results.latency_stats_ms.p75 },
                  { label: 'p90', val: results.latency_stats_ms.p90 },
                  { label: 'p95', val: results.latency_stats_ms.p95 },
                  { label: 'p99', val: results.latency_stats_ms.p99 },
                  { label: 'Max', val: results.latency_stats_ms.max },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
                  >
                    <p className="text-[10px] text-slate-400 font-sans">{stat.label}</p>
                    <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white mt-0.5">
                      {stat.val}ms
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Code Distribution */}
            <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                HTTP Status Summary
              </h3>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-500">2xx</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {results.code_summary['2xx']}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-500">3xx</p>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {results.code_summary['3xx']}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-500">4xx</p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {results.code_summary['4xx']}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-sans text-slate-500">5xx / Err</p>
                  <p className="text-base font-bold text-red-600 dark:text-red-400 mt-0.5">
                    {results.code_summary['5xx'] + results.code_summary['errors']}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(results.status_distribution).map(([code, cnt]: [string, any]) => (
                  <span
                    key={code}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tabular-nums"
                  >
                    HTTP {code}: <strong>{cnt}</strong>
                  </span>
                ))}
              </div>
              {results.opaque_responses > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {results.opaque_responses} opaque no-CORS response{results.opaque_responses === 1 ? '' : 's'} (status inferred as reachable; payload size hidden by browser CORS policy).
                </p>
              )}
            </div>
          </div>

          {/* Per-Request Latency Timeline */}
          <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-400" />
                Request Sequence Waterfall (ms)
              </h3>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportReport('json')}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportReport('csv')}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="h-36 sm:h-40 w-full bg-slate-50 dark:bg-slate-900/60 rounded-lg p-3 border border-slate-200/70 dark:border-slate-800 flex items-end gap-1 overflow-x-auto no-scrollbar">
              {(() => {
                const maxVal = Math.max(...results.timeline.map((t: any) => t.duration_ms), 1);
                return results.timeline.map((item: any) => {
                  const heightPercent = Math.max(8, (item.duration_ms / maxVal) * 100);
                  const isSuccess = item.success;
                  return (
                    <div
                      key={item.id}
                      className="group relative flex-1 min-w-[5px] max-w-[20px] h-full flex items-end cursor-pointer"
                    >
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-xs transition-opacity group-hover:opacity-75 ${
                          isSuccess
                            ? item.duration_ms > results.latency_stats_ms.p90
                              ? 'bg-amber-500'
                              : 'bg-slate-800 dark:bg-slate-200'
                            : 'bg-red-500'
                        }`}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                        <div className="bg-slate-900 text-white text-[10px] font-mono rounded py-1 px-2 whitespace-nowrap shadow-lg border border-slate-700 tabular-nums">
                          <p>#{item.id}: {item.duration_ms}ms</p>
                          <p className="text-slate-400">HTTP {item.status_code || item.error}</p>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tabular-nums">
              <span>Request #1</span>
              <span>Sequence</span>
              <span>Request #{results.timeline.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
