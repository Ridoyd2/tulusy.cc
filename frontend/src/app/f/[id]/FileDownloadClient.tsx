'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Download,
  Shield,
  Clock,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Flag,
  X,
  Infinity as InfinityIcon
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTopOnMount } from '@/components/ScrollToTopOnMount';
import { getApiBaseUrl } from '@/lib/api';
import { CONTACT_EMAIL } from '@/lib/site';

interface FileInfo {
  file_id: string;
  filename: string;
  file_size: number;
  content_type: string;
  created_at: number;
  expires_at: number;
  downloads_count: number;
  views_count?: number;
  last_viewed_at?: number;
  expiry_mode?: 'fixed' | 'forever_idle_7d';
  is_forever?: boolean;
  requires_password: boolean;
  is_burn_after_reading: boolean;
  seconds_remaining: number;
}

// Countdown is anchored to the server's seconds_remaining plus locally elapsed time,
// so a visitor's skewed device clock can never mark an active file as expired.
interface CountdownClock {
  syncedAtMs: number;
  nowMs: number;
}

// Dedupes the view beacon per tab (React StrictMode re-runs effects, quick reloads).
const VIEW_DEDUP_MS = 10_000;
const recentViewPings = new Map<string, number>();

export const FileDownloadClient: React.FC<{ initialFile: FileInfo | null; fileId: string }> = ({
  initialFile,
  fileId,
}) => {
  const [file, setFile] = useState<FileInfo | null>(initialFile);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(!initialFile);
  const [password, setPassword] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [burnedAfterDownload, setBurnedAfterDownload] = useState<boolean>(false);

  // Abuse Report Modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);
  const [isReporting, setIsReporting] = useState<boolean>(false);
  const [clock, setClock] = useState<CountdownClock | null>(null);
  const reportCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeReportModal = useCallback(() => {
    if (reportCloseTimerRef.current) {
      clearTimeout(reportCloseTimerRef.current);
      reportCloseTimerRef.current = null;
    }
    setShowReportModal(false);
  }, []);

  const applyServerFile = useCallback((next: FileInfo) => {
    const syncedAtMs = Date.now();
    setFile(next);
    setClock({ syncedAtMs, nowMs: syncedAtMs });
  }, []);

  useEffect(() => {
    const mountedAtMs = Date.now();
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setClock(prev => (prev ? { ...prev, nowMs } : { syncedAtMs: mountedAtMs, nowMs }));
    }, 15000);
    return () => {
      clearInterval(timer);
      if (reportCloseTimerRef.current) {
        clearTimeout(reportCloseTimerRef.current);
      }
    };
  }, []);

  // Count a human visit (refreshes the 7-day idle window of forever shares).
  // Skips prerendered pages until they are actually shown; server ignores bots/prefetch.
  useEffect(() => {
    const sendViewPing = () => {
      const now = Date.now();
      const last = recentViewPings.get(fileId);
      if (last !== undefined && now - last < VIEW_DEDUP_MS) return;
      recentViewPings.set(fileId, now);

      const apiUrl = getApiBaseUrl();
      fetch(`${apiUrl}/api/hosting/view/${encodeURIComponent(fileId)}`, {
        method: 'POST',
        cache: 'no-store',
      })
        .then(async res => {
          if (res.status === 404) {
            setFile(null);
            setLoadingInfo(false);
            return;
          }
          if (!res.ok) return;
          const data = (await res.json()) as { file?: FileInfo };
          if (data.file) {
            applyServerFile(data.file);
            setLoadingInfo(false);
          }
        })
        .catch(() => {});
    };

    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) {
      document.addEventListener('prerenderingchange', sendViewPing, { once: true });
      return () => document.removeEventListener('prerenderingchange', sendViewPing);
    }
    sendViewPing();
  }, [fileId, applyServerFile]);

  useEffect(() => {
    if (!showReportModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReportModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showReportModal, closeReportModal]);

  useEffect(() => {
    if (!initialFile) {
      const apiUrl = getApiBaseUrl();
      fetch(`${apiUrl}/api/hosting/info/${encodeURIComponent(fileId)}`, { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.file) applyServerFile(data.file as FileInfo);
        })
        .catch(() => {})
        .finally(() => setLoadingInfo(false));
    }
  }, [initialFile, fileId, applyServerFile]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1) return `${bytes.toFixed(2)} B`;
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.max(0, Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${Math.max(1, mins)}m remaining`;
  };

  const handleDownload = async () => {
    if (!file || isDownloading || burnedAfterDownload) return;
    if (file.requires_password && !password.trim()) {
      setErrorMessage('Please enter the password to unlock this file.');
      return;
    }

    setErrorMessage(null);
    setIsDownloading(true);

    try {
      const apiUrl = getApiBaseUrl();
      const resp = await fetch(`${apiUrl}/api/hosting/download/${encodeURIComponent(fileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() ? password.trim() : null }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Download request failed.');
      }

      const contentType = resp.headers.get('content-type');
      let refreshedExpiry: { expires_at?: number; seconds_remaining?: number } = {};
      if (contentType && contentType.includes('application/json')) {
        const data = (await resp.json()) as {
          download_url?: string;
          filename?: string;
          expires_at?: number | null;
          seconds_remaining?: number | null;
        };
        if (!data.download_url) {
          throw new Error('Download URL was missing from server response.');
        }
        if (typeof data.expires_at === 'number' && typeof data.seconds_remaining === 'number') {
          refreshedExpiry = { expires_at: data.expires_at, seconds_remaining: data.seconds_remaining };
        }
        const resolvedUrl = data.download_url.startsWith('http')
          ? data.download_url
          : `${apiUrl}${data.download_url}`;
        const a = document.createElement('a');
        a.href = resolvedUrl;
        a.download = data.filename || file.filename || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename || 'downloaded_file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }

      setDownloadSuccess(true);
      setFile(prev =>
        prev ? { ...prev, ...refreshedExpiry, downloads_count: prev.downloads_count + 1 } : prev
      );
      if (refreshedExpiry.seconds_remaining !== undefined) {
        const syncedAtMs = Date.now();
        setClock({ syncedAtMs, nowMs: syncedAtMs });
      }
      if (file.is_burn_after_reading) {
        setBurnedAfterDownload(true);
        try {
          const raw = window.localStorage.getItem('tulusy_recent_shares');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.filter((s: { fileId?: string }) => s?.fileId !== fileId);
              window.localStorage.setItem('tulusy_recent_shares', JSON.stringify(updated));
            }
          }
        } catch {}
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error downloading file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmitReport = async () => {
    const trimmed = reportReason.trim();
    if (trimmed.length < 5) {
      setReportError('Please enter at least 5 characters describing the issue.');
      return;
    }
    setIsReporting(true);
    setReportError(null);
    try {
      const apiUrl = getApiBaseUrl();
      const resp = await fetch(`${apiUrl}/api/hosting/report/${encodeURIComponent(fileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!resp.ok) {
        let msg = `Report failed (status ${resp.status}).`;
        try {
          const errJson = (await resp.json()) as { detail?: unknown };
          if (typeof errJson.detail === 'string') {
            msg = errJson.detail;
          } else if (Array.isArray(errJson.detail) && errJson.detail[0]?.msg) {
            msg = String(errJson.detail[0].msg);
          }
        } catch {}
        throw new Error(msg);
      }
      setReportSuccess(true);
      if (reportCloseTimerRef.current) {
        clearTimeout(reportCloseTimerRef.current);
      }
      reportCloseTimerRef.current = setTimeout(() => {
        reportCloseTimerRef.current = null;
        setShowReportModal(false);
        setReportSuccess(false);
        setReportReason('');
        setReportError(null);
      }, 2000);
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : 'Failed to send report.');
    } finally {
      setIsReporting(false);
    }
  };

  const elapsedSec = clock ? Math.max(0, Math.floor((clock.nowMs - clock.syncedAtMs) / 1000)) : 0;
  const liveSecondsRemaining = file ? Math.max(0, file.seconds_remaining - elapsedSec) : 0;
  const isExpired = Boolean(file) && liveSecondsRemaining <= 0;
  const isForever = Boolean(file?.is_forever);
  const viewsCount = file?.views_count ?? 0;

  const ext = file?.filename.includes('.')
    ? file.filename.split('.').pop()?.toUpperCase() || 'FILE'
    : 'FILE';

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTopOnMount />
      <Navbar activeTool="file-host" />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10 sm:py-16 flex flex-col justify-center">
        {loadingInfo ? (
          <div className="panel rounded-xl p-10 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Checking file availability...</p>
          </div>
        ) : file ? (
          <div className="panel rounded-xl p-6 sm:p-8 space-y-6">
            {/* File Identity */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                {ext.slice(0, 5)}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-semibold uppercase">
                    {ext}
                  </span>
                  {file.is_burn_after_reading && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-[10px] font-medium flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Burn on read
                    </span>
                  )}
                  {isForever && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[10px] font-medium flex items-center gap-1">
                      <InfinityIcon className="w-3 h-3" /> Forever (7d idle)
                    </span>
                  )}
                  {file.requires_password && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Password protected
                    </span>
                  )}
                </div>

                <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white break-all">
                  {file.filename}
                </h1>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {formatBytes(file.file_size)} · {viewsCount} view{viewsCount === 1 ? '' : 's'} · {file.downloads_count} download{file.downloads_count === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
                {isForever ? (
                  <InfinityIcon className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                    {burnedAfterDownload
                      ? 'Purged after download'
                      : isForever && !isExpired
                      ? `${formatTimeRemaining(liveSecondsRemaining).replace(' remaining', '')} until idle deletion`
                      : formatTimeRemaining(liveSecondsRemaining)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isForever ? 'Forever · resets to 7 days on every view' : 'Retention window'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">Anonymous Storage</p>
                  <p className="text-[11px] text-slate-500">Cloudflare R2 encrypted</p>
                </div>
              </div>
            </div>

            {/* Password Input */}
            {file.requires_password && !burnedAfterDownload && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password Required</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter file password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDownload();
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {downloadSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {burnedAfterDownload
                    ? 'Download started. Because this was a burn-on-read link, the file has now been permanently deleted from storage.'
                    : 'Download started.'}
                </span>
              </div>
            )}

            {/* Primary Download Button */}
            <button
              type="button"
              disabled={isDownloading || burnedAfterDownload || isExpired}
              onClick={handleDownload}
              className={`w-full py-3 rounded-lg font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                burnedAfterDownload || isExpired
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : isDownloading
                  ? 'bg-slate-800 text-white cursor-wait'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                {burnedAfterDownload
                  ? 'Single-Use File Consumed'
                  : isExpired
                  ? 'File Expired'
                  : isDownloading
                  ? 'Preparing Download...'
                  : `Download File (${formatBytes(file.file_size)})`}
              </span>
            </button>

            {/* Footer actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <Link href="/share" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Upload a file
              </Link>
              <button
                type="button"
                onClick={() => {
                  setReportError(null);
                  setShowReportModal(true);
                }}
                className="hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Flag className="w-3 h-3" />
                <span>Report Abuse</span>
              </button>
            </div>
          </div>
        ) : (
          /* Expired or Not Found State */
          <div className="panel rounded-xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                File Unavailable or Expired
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                This file has either reached its automatic expiration window, gone 7 days without any views (Forever shares), was configured to self-destruct after a single download, or was deleted by its uploader.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/share"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs sm:text-sm transition-colors"
              >
                <span>Share a File</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Abuse Report Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={closeReportModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-abuse-title"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="report-abuse-title" className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-500" />
                <span>Report File Abuse / DMCA</span>
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeReportModal}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Describe why this file violates terms of service (copyright infringement, malware, or illegal content). For urgent DMCA notices, you can also email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`DMCA / Abuse Report for /f/${fileId}`)}`}
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>

            <textarea
              rows={4}
              value={reportReason}
              onChange={(e) => {
                setReportReason(e.target.value);
                if (reportError) setReportError(null);
              }}
              placeholder="Provide details (minimum 5 characters)..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />

            {reportError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{reportError}</span>
              </div>
            )}

            {reportSuccess ? (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs text-center font-medium">
                Report submitted. Thank you.
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportError(null);
                    closeReportModal();
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reportReason.trim().length < 5 || isReporting}
                  onClick={handleSubmitReport}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
