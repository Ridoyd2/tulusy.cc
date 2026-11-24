'use client';

import React, { useState, useRef, useMemo, useSyncExternalStore, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  HardDriveUpload,
  Shield,
  Clock,
  Lock,
  Copy,
  Check,
  Trash2,
  QrCode,
  FileText,
  AlertCircle,
  ExternalLink,
  Flame,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
  Infinity as InfinityIcon
} from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';
import { SITE_URL } from '../lib/site';
import { HostingExpiryMode, UploadSessionData } from '../types';

const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const MULTIPART_CONCURRENCY = 3;

function LocalQrSvg({ value }: { value: string }) {
  const { size, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let d = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          d += `M${c} ${r}h1v1h-1z`;
        }
      }
    }
    return { size: count + 4, path: d };
  }, [value]);

  return (
    <svg
      viewBox={`-2 -2 ${size} ${size}`}
      className="w-36 h-36 rounded-lg bg-white p-2 border border-slate-200"
      role="img"
      aria-label="Download QR Code"
    >
      <path d={path} fill="#0f172a" />
    </svg>
  );
}

function uploadBlobViaXhr(
  method: 'PUT' | 'POST',
  url: string,
  body: XMLHttpRequestBodyInit,
  options?: {
    contentType?: string;
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    if (options?.signal?.aborted) {
      reject(new Error('Upload aborted.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      xhr.abort();
      cleanup();
      reject(new Error('Upload aborted.'));
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.open(method, url);
    if (options?.contentType) {
      xhr.setRequestHeader('Content-Type', options.contentType);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options?.onProgress) {
        options.onProgress(e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag'));
      } else {
        let msg = `Upload failed with status ${xhr.status}`;
        try {
          const parsed = JSON.parse(xhr.responseText) as { detail?: string };
          if (parsed.detail) msg = parsed.detail;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Network error during file upload.'));
    };
    xhr.ontimeout = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Upload timed out.'));
    };
    xhr.onabort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Upload aborted.'));
    };
    xhr.send(body);
  });
}

interface UploadResult {
  fileId: string;
  filename: string;
  fileSize: number;
  shareUrl: string;
  deleteToken: string;
  expiresAt: number;
  expiryLabel: string;
  isBurn: boolean;
  expiryMode?: HostingExpiryMode;
}

const RECENT_SHARES_KEY = 'tulusy_recent_shares';
const BLOCKED_HOSTING_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'msi', 'scr', 'com', 'pif',
  'jar', 'ps1', 'app', 'dmg', 'deb', 'rpm', 'apk',
]);
const EMPTY_SHARES: UploadResult[] = [];
const shareListeners = new Set<() => void>();
let cachedSharesRaw: string | null = null;
let cachedSharesList: UploadResult[] = EMPTY_SHARES;

// Forever shares outlive their cached expiresAt whenever they get views; keep them locally
// (with their delete token) until the server confirms they were purged for inactivity.
function isShareLocallyActive(item: UploadResult, nowSec: number): boolean {
  return item.expiryMode === 'forever_idle_7d' || item.expiresAt > nowSec;
}

function subscribeRecentShares(callback: () => void) {
  shareListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECENT_SHARES_KEY) callback();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    shareListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getRecentSharesSnapshot(): UploadResult[] {
  if (typeof window === 'undefined') return EMPTY_SHARES;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const raw = window.localStorage.getItem(RECENT_SHARES_KEY);
    if (raw === cachedSharesRaw) {
      if (cachedSharesList.some(item => !isShareLocallyActive(item, nowSec))) {
        cachedSharesList = cachedSharesList.filter(item => isShareLocallyActive(item, nowSec));
      }
      return cachedSharesList;
    }
    cachedSharesRaw = raw;
    if (!raw) {
      cachedSharesList = EMPTY_SHARES;
      return cachedSharesList;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedSharesList = EMPTY_SHARES;
      return cachedSharesList;
    }
    cachedSharesList = parsed
      .filter(
        (item): item is UploadResult =>
          Boolean(item?.fileId && item?.deleteToken && item?.shareUrl) &&
          typeof item.expiresAt === 'number' &&
          isShareLocallyActive(item, nowSec)
      )
      .slice(0, 10);
    return cachedSharesList;
  } catch {
    return EMPTY_SHARES;
  }
}

function getRecentSharesServerSnapshot(): UploadResult[] {
  return EMPTY_SHARES;
}

function saveRecentShares(shares: UploadResult[]) {
  if (typeof window === 'undefined') return;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const active = shares
      .filter(s => typeof s.expiresAt === 'number' && isShareLocallyActive(s, nowSec))
      .slice(0, 10);
    const raw = JSON.stringify(active);
    window.localStorage.setItem(RECENT_SHARES_KEY, raw);
    cachedSharesRaw = raw;
    cachedSharesList = active;
    shareListeners.forEach(listener => listener());
  } catch {}
}

type ExpiryChoice =
  | { id: '1h'; label: '1 Hour'; days: 1; hours: 1; mode: 'fixed'; burn: false }
  | { id: '24h'; label: '24 Hours'; days: 1; hours?: undefined; mode: 'fixed'; burn: false }
  | { id: '3d'; label: '3 Days'; days: 3; hours?: undefined; mode: 'fixed'; burn: false }
  | { id: '7d'; label: '7 Days'; days: 7; hours?: undefined; mode: 'fixed'; burn: false }
  | { id: 'forever'; label: 'Forever (7d idle)'; days: 7; hours?: undefined; mode: 'forever_idle_7d'; burn: false }
  | { id: 'burn'; label: 'Burn on Read'; days: 1; hours?: undefined; mode: 'fixed'; burn: true };

const EXPIRY_OPTIONS: ExpiryChoice[] = [
  { id: '1h', label: '1 Hour', days: 1, hours: 1, mode: 'fixed', burn: false },
  { id: '24h', label: '24 Hours', days: 1, mode: 'fixed', burn: false },
  { id: '3d', label: '3 Days', days: 3, mode: 'fixed', burn: false },
  { id: '7d', label: '7 Days', days: 7, mode: 'fixed', burn: false },
  { id: 'forever', label: 'Forever (7d idle)', days: 7, mode: 'forever_idle_7d', burn: false },
  { id: 'burn', label: 'Burn on Read', days: 1, mode: 'fixed', burn: true },
];

export const FileHostTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryChoice>(EXPIRY_OPTIONS[1]);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Upload status states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<UploadResult | null>(null);
  const recentShares = useSyncExternalStore(
    subscribeRecentShares,
    getRecentSharesSnapshot,
    getRecentSharesServerSnapshot
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedRecentId, setCopiedRecentId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [confirmRecentDeleteId, setConfirmRecentDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletingShareId, setDeletingShareId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  // Revalidate forever shares whose cached expiry passed: refresh it if views kept the link alive,
  // or drop the entry if the server purged it after 7 idle days.
  useEffect(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const overdue = getRecentSharesSnapshot().filter(
      s => s.expiryMode === 'forever_idle_7d' && s.expiresAt <= nowSec
    );
    if (overdue.length === 0) return;

    let cancelled = false;
    const apiUrl = getApiBaseUrl();
    void (async () => {
      const updates = new Map<string, number | null>();
      await Promise.all(
        overdue.map(async share => {
          try {
            const resp = await fetch(`${apiUrl}/api/hosting/info/${encodeURIComponent(share.fileId)}`, {
              cache: 'no-store',
            });
            if (resp.status === 404) {
              updates.set(share.fileId, null);
              return;
            }
            if (!resp.ok) return;
            const data = (await resp.json()) as { file?: { expires_at?: number } };
            if (typeof data.file?.expires_at === 'number') {
              updates.set(share.fileId, data.file.expires_at);
            }
          } catch {}
        })
      );
      if (cancelled || updates.size === 0) return;
      const next = getRecentSharesSnapshot().flatMap(s => {
        if (!updates.has(s.fileId)) return [s];
        const exp = updates.get(s.fileId);
        return exp == null ? [] : [{ ...s, expiresAt: exp }];
      });
      saveRecentShares(next);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1) return `${bytes.toFixed(2)} B`;
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.max(0, Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k))));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (selectedFile: File) => {
    if (isUploading) return;
    setErrorMessage(null);
    const maxBytes = 5 * 1024 * 1024 * 1024; // 5 GB
    if (selectedFile.size > maxBytes) {
      setErrorMessage('File size exceeds the 5 GB maximum limit.');
      return;
    }
    if (selectedFile.size === 0) {
      setErrorMessage('Cannot upload an empty (0 byte) file.');
      return;
    }
    const cleanedName = selectedFile.name.trim().replace(/\.+$/, '');
    const ext = cleanedName.includes('.') ? cleanedName.split('.').pop()?.toLowerCase() || '' : '';
    if (ext && BLOCKED_HOSTING_EXTENSIONS.has(ext)) {
      setErrorMessage(`Executable file type (.${ext}) is restricted for security.`);
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!file || isUploading) return;

    const chosenExpiry = selectedExpiry;
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setIsUploading(true);
    setProgress(0);
    setUploadSpeed('');
    setErrorMessage(null);
    setStatusMessage('Initializing upload session...');

    try {
      const apiUrl = getApiBaseUrl();

      // 1. Initialize upload session
      const initResp = await fetch(`${apiUrl}/api/hosting/init-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          filename: file.name,
          file_size: file.size,
          content_type: file.type || 'application/octet-stream',
          expiry_days: chosenExpiry.days,
          expiry_hours: chosenExpiry.hours ?? null,
          expiry_mode: chosenExpiry.mode,
          max_downloads: chosenExpiry.burn ? 1 : 0,
          password: password.trim() ? password.trim() : null,
          use_multipart: file.size > MULTIPART_THRESHOLD_BYTES,
        }),
      });

      if (!initResp.ok) {
        const errData = (await initResp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(errData.detail || 'Failed to initialize upload session');
      }

      const initData = (await initResp.json()) as { data: UploadSessionData };
      const session = initData.data;
      // Forever shares restart their 7-day idle window at confirmation, so prefer the confirmed expiry
      let confirmedExpiresAt = session.expires_at;
      const readConfirmedExpiry = async (resp: Response) => {
        try {
          const data = (await resp.json()) as { file?: { expires_at?: number } };
          if (typeof data.file?.expires_at === 'number') {
            confirmedExpiresAt = data.file.expires_at;
          }
        } catch {}
      };

      // 2. Perform direct upload with real-time progress
      setStatusMessage(
        session.storage_type === 'r2' ? 'Uploading directly to Cloudflare R2...' : 'Uploading file...'
      );

      let lastLoaded = 0;
      let lastTime = Date.now();
      const reportProgress = (loadedBytes: number) => {
        const percent = Math.min(100, Math.round((loadedBytes / file.size) * 100));
        setProgress(percent);
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        if (timeDiff >= 0.4) {
          const speedBytesPerSec = (loadedBytes - lastLoaded) / timeDiff;
          if (speedBytesPerSec > 0) {
            setUploadSpeed(`${formatBytes(speedBytesPerSec)}/s`);
          }
          lastLoaded = loadedBytes;
          lastTime = now;
        }
      };

      if (
        session.upload_mode === 'multipart' &&
        session.upload_id &&
        session.part_size &&
        session.parts?.length
      ) {
        const parts = session.parts;
        const partSize = session.part_size;
        const uploadId = session.upload_id;
        const loadedByPart = new Array<number>(parts.length).fill(0);
        const completedParts: Array<{ PartNumber: number; ETag: string }> = new Array(parts.length);
        let cursor = 0;

        const sleepAbortable = (ms: number, signal: AbortSignal) =>
          new Promise<void>((resolve, reject) => {
            if (signal.aborted) {
              reject(new Error('Upload aborted.'));
              return;
            }
            const onAbort = () => {
              clearTimeout(timer);
              reject(new Error('Upload aborted.'));
            };
            const timer = setTimeout(() => {
              signal.removeEventListener('abort', onAbort);
              resolve();
            }, ms);
            signal.addEventListener('abort', onAbort, { once: true });
          });

        const uploadSinglePart = async (partIdx: number) => {
          const part = parts[partIdx];
          const start = (part.part_number - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          for (let attempt = 0; attempt < 3; attempt++) {
            if (controller.signal.aborted) {
              throw new Error('Upload aborted.');
            }
            try {
              const etag = await uploadBlobViaXhr('PUT', part.upload_url, chunk, {
                signal: controller.signal,
                onProgress: (loaded) => {
                  loadedByPart[partIdx] = loaded;
                  reportProgress(loadedByPart.reduce((a, b) => a + b, 0));
                },
              });
              if (!etag) {
                throw new Error('R2 upload response missing ETag header.');
              }
              loadedByPart[partIdx] = chunk.size;
              reportProgress(loadedByPart.reduce((a, b) => a + b, 0));
              completedParts[partIdx] = { PartNumber: part.part_number, ETag: etag };
              return;
            } catch (partErr) {
              if (controller.signal.aborted || attempt === 2) throw partErr;
              loadedByPart[partIdx] = 0;
              await sleepAbortable(600 * (attempt + 1), controller.signal);
            }
          }
        };

        try {
          const workers = Array.from(
            { length: Math.min(MULTIPART_CONCURRENCY, parts.length) },
            async () => {
              while (cursor < parts.length && !controller.signal.aborted) {
                const idx = cursor++;
                await uploadSinglePart(idx);
              }
            }
          );
          await Promise.all(workers);

          if (controller.signal.aborted) {
            throw new Error('Upload aborted.');
          }

          setStatusMessage('Finalizing multipart upload...');
          const completeResp = await fetch(`${apiUrl}/api/hosting/complete-multipart/${encodeURIComponent(session.file_id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ upload_id: uploadId, parts: completedParts }),
          });
          if (!completeResp.ok) {
            const errData = (await completeResp.json().catch(() => ({}))) as { detail?: string };
            throw new Error(errData.detail || 'Could not finalize multipart upload');
          }
          await readConfirmedExpiry(completeResp);
        } catch (mpErr) {
          controller.abort();
          await fetch(`${apiUrl}/api/hosting/abort-multipart/${encodeURIComponent(session.file_id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ upload_id: uploadId }),
          }).catch(() => {});
          throw mpErr;
        }
      } else {
        const uploadUrl = session.upload_url.startsWith('http')
          ? session.upload_url
          : `${apiUrl}${session.upload_url}`;

        const method = session.storage_type === 'r2' ? 'PUT' : 'POST';
        let body: XMLHttpRequestBodyInit;
        if (session.storage_type === 'r2') {
          body = file;
        } else {
          const formData = new FormData();
          formData.append('file', file);
          body = formData;
        }

        await uploadBlobViaXhr(method, uploadUrl, body, {
          contentType:
            session.storage_type === 'r2'
              ? session.content_type || file.type || 'application/octet-stream'
              : undefined,
          signal: controller.signal,
          onProgress: (loaded) => reportProgress(loaded),
        });

        // 3. Confirm upload
        setStatusMessage('Finalizing metadata...');
        const confirmResp = await fetch(`${apiUrl}/api/hosting/confirm-upload/${encodeURIComponent(session.file_id)}`, {
          method: 'POST',
        });
        if (!confirmResp.ok) {
          const errData = (await confirmResp.json().catch(() => ({}))) as { detail?: string };
          throw new Error(errData.detail || 'Could not verify uploaded file');
        }
        await readConfirmedExpiry(confirmResp);
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL;
      const shareUrl = `${origin}/f/${encodeURIComponent(session.file_id)}`;

      const uploadResult: UploadResult = {
        fileId: session.file_id,
        filename: session.filename || file.name,
        fileSize: file.size,
        shareUrl,
        deleteToken: session.delete_token,
        expiresAt: confirmedExpiresAt,
        expiryLabel: chosenExpiry.label,
        isBurn: chosenExpiry.burn,
        expiryMode: chosenExpiry.mode,
      };

      setResult(uploadResult);
      const nextShares = [
        uploadResult,
        ...getRecentSharesSnapshot().filter(s => s.fileId !== uploadResult.fileId),
      ].slice(0, 10);
      saveRecentShares(nextShares);

      setFile(null);
      setConfirmDelete(false);
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'Upload aborted.')) {
        setErrorMessage('Upload cancelled.');
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during upload.'
        );
      }
    } finally {
      uploadAbortRef.current = null;
      setIsUploading(false);
    }
  };

  const copyTextSafe = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    if (!result) return;
    if (await copyTextSafe(result.shareUrl)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const deleteShareById = async (fileId: string, deleteToken: string) => {
    setIsDeleting(true);
    setDeletingShareId(fileId);
    setErrorMessage(null);
    try {
      const apiUrl = getApiBaseUrl();
      const resp = await fetch(
        `${apiUrl}/api/hosting/delete/${encodeURIComponent(fileId)}?token=${encodeURIComponent(deleteToken)}`,
        { method: 'DELETE' }
      );
      if (resp.ok || resp.status === 404) {
        const nextShares = getRecentSharesSnapshot().filter(s => s.fileId !== fileId);
        saveRecentShares(nextShares);
        if (result?.fileId === fileId) {
          setResult(null);
          setPassword('');
          setConfirmDelete(false);
        }
        setConfirmRecentDeleteId(null);
      } else {
        setErrorMessage('Failed to delete file from storage.');
      }
    } catch {
      setErrorMessage('Network error while deleting file.');
    } finally {
      setIsDeleting(false);
      setDeletingShareId(null);
    }
  };

  const handleDeleteNow = async () => {
    if (!result) return;
    await deleteShareById(result.fileId, result.deleteToken);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Anonymous File Share
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Upload files up to <span className="font-semibold text-slate-900 dark:text-white">5 GB</span> backed by Cloudflare R2 object storage. Default 24-hour auto-deletion, fixed windows up to 7 days, or Forever hosting that only deletes a file after 7 days without views. Zero account requirements and no IP logging.
        </p>
      </div>

      {/* Specs Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-3xl mx-auto text-xs">
        <div className="panel rounded-xl p-3 flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Up to 5 GB</p>
            <p className="text-[11px] text-slate-500">Per-file capacity</p>
          </div>
        </div>
        <div className="panel rounded-xl p-3 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">24h Default</p>
            <p className="text-[11px] text-slate-500">Up to 7d or Forever</p>
          </div>
        </div>
        <div className="panel rounded-xl p-3 flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Zero Telemetry</p>
            <p className="text-[11px] text-slate-500">No IP or user logs</p>
          </div>
        </div>
        <div className="panel rounded-xl p-3 flex items-center gap-2.5">
          <Flame className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Burn on Read</p>
            <p className="text-[11px] text-slate-500">Optional 1-time link</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-3xl mx-auto">
        {!result ? (
          <div className="panel rounded-xl p-5 sm:p-7 space-y-6">
            {/* Dropzone */}
            <div
              role="button"
              tabIndex={isUploading ? -1 : 0}
              aria-disabled={isUploading}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => {
                if (!isUploading) fileInputRef.current?.click();
              }}
              className={`border border-dashed rounded-xl p-6 sm:p-10 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                isUploading
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 cursor-not-allowed opacity-75'
                  : isDragging
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={isUploading}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />

              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                <HardDriveUpload className="w-6 h-6" />
              </div>

              {file ? (
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2 break-all">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{file.name}</span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                    {formatBytes(file.size)} · Ready for transfer
                  </p>
                  <p className="text-[11px] text-slate-400">Click or drop another file to replace</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                    Drop a file here or click to select
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Archives, videos, datasets, documents, or images up to 5 GB
                  </p>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Configuration Controls */}
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expire After</span>
                </label>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-end items-center gap-1.5 w-full sm:w-auto">
                  {EXPIRY_OPTIONS.map((opt) => {
                    const isSelected = selectedExpiry.id === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isUploading}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedExpiry(opt)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 min-w-0 ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.burn && <Flame className="w-3 h-3 shrink-0" />}
                        {opt.mode === 'forever_idle_7d' && <InfinityIcon className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedExpiry.mode === 'forever_idle_7d' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed sm:text-right">
                  Stays hosted forever while people use the link. It is deleted automatically only after 7 days in a row with no views or downloads.
                </p>
              )}
              </div>

              {/* Password Protection */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Password Protection</p>
                    <p className="text-[11px] text-slate-500">Optional passphrase required before download</p>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Optional password"
                    value={password}
                    disabled={isUploading}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 disabled:opacity-50"
                  />
                  {password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    <span className="truncate">{statusMessage}</span>
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono tabular-nums">{progress}%</span>
                    <button
                      type="button"
                      onClick={() => uploadAbortRef.current?.abort()}
                      className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {uploadSpeed && (
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Throughput: {uploadSpeed}</span>
                    <span>Encrypted stream</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              disabled={!file || isUploading}
              onClick={handleStartUpload}
              className={`w-full px-4 py-3 rounded-lg font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                !file || isUploading
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900'
              }`}
            >
              <HardDriveUpload className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isUploading
                  ? 'Uploading...'
                  : file
                  ? `Upload ${file.name} (${formatBytes(file.size)})`
                  : 'Select a file to upload'}
              </span>
            </button>
          </div>
        ) : (
          /* Upload Result View */
          <div className="panel rounded-xl p-5 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {result.filename}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {formatBytes(result.fileSize)} ·{' '}
                    {result.isBurn
                      ? 'Single-download burn'
                      : result.expiryMode === 'forever_idle_7d'
                      ? 'Forever · deleted after 7 days without views'
                      : `Expires in ${result.expiryLabel}`}
                  </p>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Share URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Shareable Download Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.shareUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'Hide QR Code' : 'QR Code'}</span>
                </button>

                <a
                  href={result.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Download Page</span>
                </a>
              </div>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete File</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Confirm permanent delete?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteNow}
                    className="px-2.5 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {showQr && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 text-center">
                <LocalQrSvg value={result.shareUrl} />
                <p className="text-[11px] text-slate-500">Scan to open download link on mobile</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setPassword('');
                  setConfirmDelete(false);
                }}
                className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}

        {/* Recent Active Shares persisted in browser localStorage */}
        {recentShares.filter(s => s.fileId !== result?.fileId).length > 0 && (
          <div className="mt-5 panel rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                Recent Active Shares (This Browser)
              </h2>
              <span className="text-[11px] text-slate-500">
                Stored locally for quick link &amp; delete access
              </span>
            </div>

            <div className="space-y-2">
              {recentShares
                .filter(s => s.fileId !== result?.fileId)
                .map(share => (
                  <div
                    key={share.fileId}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {share.filename}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {formatBytes(share.fileSize)} ·{' '}
                        {share.isBurn
                          ? 'Burn on read'
                          : share.expiryMode === 'forever_idle_7d'
                          ? 'Forever (7d idle)'
                          : share.expiryLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs">
                      <button
                        type="button"
                        onClick={async () => {
                          const safeHref = `${window.location.origin}/f/${encodeURIComponent(share.fileId)}`;
                          if (await copyTextSafe(safeHref)) {
                            setCopiedRecentId(share.fileId);
                            setTimeout(() => setCopiedRecentId(null), 1800);
                          }
                        }}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {copiedRecentId === share.fileId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedRecentId === share.fileId ? 'Copied' : 'Copy'}</span>
                      </button>

                      <a
                        href={`/f/${encodeURIComponent(share.fileId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </a>

                      {confirmRecentDeleteId === share.fileId ? (
                        <>
                          <button
                            type="button"
                            disabled={deletingShareId === share.fileId}
                            onClick={() => deleteShareById(share.fileId, share.deleteToken)}
                            className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer disabled:opacity-50"
                          >
                            {deletingShareId === share.fileId ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRecentDeleteId(null)}
                            className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRecentDeleteId(share.fileId)}
                          className="px-2.5 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
