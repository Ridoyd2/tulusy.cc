'use client';

import React, { useState, useRef } from 'react';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  Globe,
  Lock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Server,
  Eye
} from 'lucide-react';
import { analyzeDomainAuthority } from '../lib/api';
import { DomainAuditRecommendation, DomainAuditResult } from '../types';

type AuditTab = 'seo' | 'security' | 'technical' | 'recommendations';

export const DaChecker: React.FC = () => {
  const [domain, setDomain] = useState('github.com');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DomainAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<AuditTab>('seo');
  const requestSeqRef = useRef(0);

  const handleAnalyze = async (targetDomain?: string) => {
    const input = (targetDomain || domain).trim();
    if (!input) return;

    const mySeq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await analyzeDomainAuthority(input);
      if (mySeq === requestSeqRef.current) {
        setData(res);
      }
    } catch (err: unknown) {
      if (mySeq === requestSeqRef.current) {
        setError(err instanceof Error ? err.message : 'Domain analysis failed');
      }
    } finally {
      if (mySeq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Domain Authority & Technical SEO Audit
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Evaluate Domain Authority (DA), Page Authority (PA), TLS/SSL certificates, HTTP security headers, on-page structure, and SERP metadata.
        </p>
      </div>

      {/* Domain Input Card */}
      <div className="panel rounded-xl p-4 sm:p-6 space-y-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="github.com or https://example.com"
              disabled={isLoading}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm font-mono focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !domain.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Audit...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Inspect Domain</span>
              </>
            )}
          </button>
        </form>

        {/* Preset Domain Tags */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px]">Examples:</span>
          {['github.com', 'wikipedia.org', 'cloudflare.com', 'vercel.com'].map(site => (
            <button
              key={site}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setDomain(site);
                handleAnalyze(site);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {site}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold">Audit Failed</p>
              <p className="mt-0.5 text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results View */}
      {data && (
        <div className="space-y-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="panel p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Domain Authority</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {data.scores.da_rating}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {data.scores.da}<span className="text-xs font-normal text-slate-400">/100</span>
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${data.scores.da}%` }} />
              </div>
            </div>

            <div className="panel p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Page Authority</span>
                <span className="font-mono text-[10px] text-slate-400">PA</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {data.scores.pa}<span className="text-xs font-normal text-slate-400">/100</span>
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${data.scores.pa}%` }} />
              </div>
            </div>

            <div className="panel p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>SEO Health</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Grade {data.scores.grade}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {data.scores.seo_health}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-slate-900 dark:bg-white rounded-full" style={{ width: `${data.scores.seo_health}%` }} />
              </div>
            </div>

            <div className="panel p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Spam Risk</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {data.scores.spam_score <= 10 ? 'Low' : data.scores.spam_score <= 30 ? 'Moderate' : 'High'}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {data.scores.spam_score}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${data.scores.spam_score > 30 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                  style={{ width: `${Math.max(4, data.scores.spam_score)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Search Snippet Preview */}
          <div className="panel p-4 sm:p-5 rounded-xl space-y-2.5">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-400" />
              Search Engine Result Snippet
            </h3>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 max-w-2xl space-y-1">
              <div className="text-xs text-slate-500 truncate">
                {data.serp_preview.url}
              </div>
              <h4 className="text-sm sm:text-base font-medium text-blue-700 dark:text-blue-400 truncate">
                {data.serp_preview.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {data.serp_preview.snippet}
              </p>
            </div>
          </div>

          {/* Audit Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'seo', label: 'On-Page SEO', icon: <FileText className="w-3.5 h-3.5" /> },
                { id: 'security', label: 'TLS & Security Headers', icon: <Lock className="w-3.5 h-3.5" /> },
                { id: 'technical', label: 'Server & Crawlability', icon: <Server className="w-3.5 h-3.5" /> },
                { id: 'recommendations', label: `Audit Findings (${data.recommendations.length})`, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              ] satisfies Array<{ id: AuditTab; label: string; icon: React.ReactNode }>
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: On-Page SEO */}
          {activeTab === 'seo' && (
            <div className="panel p-4 sm:p-5 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                  <div>
                    <span className="text-slate-500 font-medium block">
                      Title Tag ({data.on_page_seo.title_length} chars)
                    </span>
                    <p className="font-medium text-slate-900 dark:text-slate-100 mt-1 break-all">
                      {data.on_page_seo.title || '<Missing Title>'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium block">
                      Meta Description ({data.on_page_seo.meta_description_length} chars)
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                      {data.on_page_seo.meta_description || '<Missing Meta Description>'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-800">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-slate-500">Heading Tags</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                      H1: {data.on_page_seo.h1_count} · H2: {data.on_page_seo.h2_count} · H3: {data.on_page_seo.h3_count}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500">Document Word Count</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                      {data.on_page_seo.word_count} words
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-500">Image Alt Attributes</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                      {data.on_page_seo.total_images - data.on_page_seo.images_missing_alt} / {data.on_page_seo.total_images}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-500">OpenGraph Metadata</span>
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {data.on_page_seo.has_opengraph ? 'Present' : 'Missing'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: SSL & Security */}
          {activeTab === 'security' && (
            <div className="panel p-4 sm:p-5 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    TLS Certificate
                  </h4>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className={`font-medium ${data.ssl.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {data.ssl.valid ? 'Valid' : 'Invalid / Untrusted'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Issuer</span>
                      <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                        {data.ssl.issuer}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Validity Remaining</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                        {data.ssl.days_left != null
                          ? `${data.ssl.days_left} days`
                          : data.ssl.valid
                          ? 'Verified (Edge Relay)'
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Protocol</span>
                      <span className="font-mono text-slate-900 dark:text-slate-200">
                        {data.ssl.tls_version}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-slate-400" />
                    Response Security Headers
                  </h4>
                  <div className="space-y-1.5 pt-1">
                    {Object.entries(data.security_headers).map(([hdr, active]) => (
                      <div key={hdr} className="flex justify-between items-center">
                        <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] truncate">{hdr}</span>
                        {active ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Set
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Unset
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Technical & DNS */}
          {activeTab === 'technical' && (
            <div className="panel p-4 sm:p-5 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Origin Server</h4>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resolved IP</span>
                      <span className="font-mono text-slate-900 dark:text-slate-200 tabular-nums">
                        {data.technical.server_ip}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time to First Byte</span>
                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {data.ttfb_ms} ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">HTTP Version</span>
                      <span className="font-mono text-slate-900 dark:text-slate-200">
                        {data.http_version}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Server Header</span>
                      <span className="font-mono text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                        {data.server}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Indexing & Compression</h4>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">robots.txt</span>
                      <span className={`font-medium ${data.technical.robots_txt ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {data.technical.robots_txt ? 'Found' : 'Not found'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">sitemap.xml</span>
                      <span className={`font-medium ${data.technical.sitemap_xml ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {data.technical.sitemap_xml ? 'Found' : 'Not found'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Content Encoding</span>
                      <span className="font-mono text-slate-900 dark:text-slate-200">
                        {data.technical.encoding}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Action Plan & Recommendations */}
          {activeTab === 'recommendations' && (
            <div className="panel p-4 sm:p-5 rounded-xl space-y-3">
              <div className="space-y-2 text-xs">
                {data.recommendations.map((rec: DomainAuditRecommendation, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                      rec.type === 'critical'
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
                        : rec.type === 'warning'
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    {rec.type === 'critical' ? (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    ) : rec.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold">{rec.title}</p>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {rec.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
