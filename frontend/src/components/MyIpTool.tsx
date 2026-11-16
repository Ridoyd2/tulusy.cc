'use client';

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  MapPin,
  Server,
  Monitor,
  Clock,
  ExternalLink,
  Terminal,
  Search
} from 'lucide-react';
import { fetchMyIp } from '../lib/api';

export const MyIpTool: React.FC = () => {
  const [ipData, setIpData] = useState<any | null>(null);
  const [customIpInput, setCustomIpInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [screenInfo, setScreenInfo] = useState<{ res: string; depth: number } | null>(null);

  const loadIpInfo = async (targetIp?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyIp(targetIp);
      setIpData(data);
    } catch (err: any) {
      setError(err.message || 'Could not retrieve IP details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIpInfo();
    if (typeof window !== 'undefined') {
      setScreenInfo({
        res: `${window.screen.width} × ${window.screen.height}`,
        depth: window.screen.colorDepth,
      });
    }
  }, []);

  const handleCopyIp = () => {
    if (!ipData?.ip) return;
    navigator.clipboard.writeText(ipData.ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePingTest = async () => {
    setIsPinging(true);
    const t0 = performance.now();
    try {
      await fetchMyIp(ipData?.ip);
      const t1 = performance.now();
      setPingMs(Math.round(t1 - t0));
    } catch {
      setPingMs(null);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          IP & Network Inspector
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Inspect your public IPv4/IPv6 address, autonomous system (ASN), routing geolocation, reverse DNS, and request headers—or query any external IP.
        </p>
      </div>

      {/* IP Lookup Bar */}
      <div className="panel rounded-xl p-3 sm:p-4 max-w-2xl mx-auto">
        <form
          onSubmit={e => {
            e.preventDefault();
            loadIpInfo(customIpInput.trim() || undefined);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customIpInput}
              onChange={e => setCustomIpInput(e.target.value)}
              placeholder="Lookup any IPv4 or IPv6 (e.g. 1.1.1.1, 8.8.8.8) or leave blank for your IP"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium transition-colors cursor-pointer"
            >
              Inspect IP
            </button>
            {customIpInput && (
              <button
                type="button"
                onClick={() => {
                  setCustomIpInput('');
                  loadIpInfo(undefined);
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                My IP
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main IP Card */}
      <div className="panel rounded-xl p-6 sm:p-8 text-center relative overflow-hidden space-y-4">
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={() => loadIpInfo(customIpInput.trim() || undefined)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Refresh"
            aria-label="Refresh IP information"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            <p className="text-xs text-slate-500">Querying network routing information...</p>
          </div>
        ) : error ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm">{error}</p>
            <button
              type="button"
              onClick={() => loadIpInfo(undefined)}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium cursor-pointer"
            >
              Reset to My IP
            </button>
          </div>
        ) : ipData ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
              <span className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-[10px]">
                {ipData.country_code || 'IP'}
              </span>
              <span>{ipData.ip_version}</span>
              <span>·</span>
              <span className="font-sans">{ipData.city}, {ipData.country}</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold font-mono tracking-tight text-slate-900 dark:text-white select-all break-all tabular-nums">
                {ipData.ip}
              </h2>

              <button
                type="button"
                onClick={handleCopyIp}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Network: <strong className="text-slate-800 dark:text-slate-200 font-medium">{ipData.isp}</strong>
              {ipData.asn && ipData.asn !== 'N/A' && (
                <span className="ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {ipData.asn}
                </span>
              )}
            </p>
          </div>
        ) : null}
      </div>

      {/* Details Grid */}
      {ipData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Location Details */}
          <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              Geolocation
            </h3>
            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Country</span>
                <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                  {ipData.country} ({ipData.country_code})
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Region / City</span>
                <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                  {ipData.city}, {ipData.region}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Postal Code</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">
                  {ipData.postal || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Coordinates</span>
                <a
                  href={`https://www.google.com/maps?q=${ipData.lat},${ipData.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 tabular-nums"
                >
                  <span>{ipData.lat}, {ipData.lon}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>
          </div>

          {/* Network & ISP Details */}
          <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Server className="w-4 h-4 text-slate-400" />
              Routing & ASN
            </h3>
            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Provider</span>
                <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                  {ipData.isp}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Organization</span>
                <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                  {ipData.org || ipData.isp}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Timezone</span>
                <span className="font-mono text-slate-900 dark:text-slate-200 flex items-center gap-1 truncate max-w-[180px]">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  {ipData.timezone}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">PTR Record</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                  {ipData.reverse_dns || 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Client Environment */}
          <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-slate-400" />
              Client Telemetry
            </h3>
            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">Browser</span>
                <span className="font-medium text-slate-900 dark:text-slate-200">
                  {ipData.client_browser}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">OS Platform</span>
                <span className="font-medium text-slate-900 dark:text-slate-200">
                  {ipData.client_os}
                </span>
              </div>
              {screenInfo && (
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-slate-500">Viewport</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 tabular-nums">
                    {screenInfo.res} ({screenInfo.depth}-bit)
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500">API RTT</span>
                <div className="flex items-center gap-2">
                  {pingMs !== null && (
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {pingMs} ms
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handlePingTest}
                    disabled={isPinging}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {isPinging ? 'Measuring...' : 'Measure'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HTTP Request Headers */}
      {ipData && ipData.headers && (
        <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-slate-400" />
            Received HTTP Request Headers
          </h3>
          <div className="max-h-56 overflow-y-auto rounded-lg bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 space-y-1 border border-slate-800">
            {Object.entries(ipData.headers).map(([key, val]: [string, any]) => (
              <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                <span className="text-slate-400 shrink-0">{key}:</span>
                <span className="text-slate-200 break-all">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
