'use client';

import React from 'react';
import {
  Download,
  Trash2,
  Sliders,
  AlertCircle,
  Play,
  FileArchive,
  RefreshCw,
  FileText,
  Layers,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { FileItem } from '../types';
import { downloadBlob } from '../lib/api';

interface FileQueueProps {
  items: FileItem[];
  onOpenFormatModal: (fileId: string) => void;
  onOpenSettingsModal: (fileId: string) => void;
  onConvertSingle: (fileId: string) => void;
  onRemoveItem: (fileId: string) => void;
  onConvertAll: () => void;
  onDownloadAllZip: () => void;
  onMergeToPdf?: () => void;
  onClearAll: () => void;
  isConvertingAny: boolean;
  onOpenBatchFormat?: () => void;
  onOpenBatchSettings?: () => void;
}

export const FileQueue: React.FC<FileQueueProps> = ({
  items,
  onOpenFormatModal,
  onOpenSettingsModal,
  onConvertSingle,
  onRemoveItem,
  onConvertAll,
  onDownloadAllZip,
  onMergeToPdf,
  onClearAll,
  isConvertingAny,
  onOpenBatchFormat,
  onOpenBatchSettings,
}) => {
  if (items.length === 0) return null;

  const completedCount = items.filter(i => i.status === 'completed').length;
  const allCompleted = completedCount === items.length && items.length > 0;
  const allImages = items.every(i =>
    ['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'tiff', 'gif', 'heic', 'heif'].includes(
      i.sourceExt.toLowerCase()
    )
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Top Batch Controls Header */}
      <div className="panel rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
            Batch Queue ({items.length})
          </span>
          {completedCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70 tabular-nums">
              {completedCount}/{items.length} done
            </span>
          )}

          {/* All-in-One Format & Settings Controls */}
          {items.length > 1 && !allCompleted && (
            <div className="flex items-center gap-1.5 ml-1">
              {onOpenBatchFormat && (
                <button
                  type="button"
                  onClick={onOpenBatchFormat}
                  disabled={isConvertingAny}
                  className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 dark:text-slate-200 text-xs font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Change output format for all files in queue"
                >
                  <span className="text-[10px] text-slate-400 font-sans font-normal">All to:</span>
                  <span>{items[0]?.targetFormat?.toUpperCase() || 'TARGET'}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              )}

              {onOpenBatchSettings && (
                <button
                  type="button"
                  onClick={onOpenBatchSettings}
                  disabled={isConvertingAny}
                  className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 dark:text-slate-300 text-xs transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
                  title="Configure all-in-one settings (quality, resolution, DPI) for all files"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {allImages && items.length > 1 && onMergeToPdf && (
            <button
              type="button"
              onClick={onMergeToPdf}
              disabled={isConvertingAny}
              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Merge into 1 PDF</span>
            </button>
          )}

          {completedCount > 1 && (
            <button
              type="button"
              onClick={onDownloadAllZip}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileArchive className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Download ZIP ({completedCount})</span>
            </button>
          )}

          {!allCompleted && (
            <button
              type="button"
              onClick={onConvertAll}
              disabled={isConvertingAny}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isConvertingAny ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span className="whitespace-nowrap">Convert All</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearAll}
            disabled={isConvertingAny}
            className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-red-950/30 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-400 text-xs transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
            title="Clear queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Item List */}
      <div className="space-y-2">
        {items.map(item => {
          const isImg = item.previewUrl;
          return (
            <div
              key={item.id}
              className={`panel rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.status === 'completed'
                  ? 'border-emerald-200/80 dark:border-emerald-900/60'
                  : item.status === 'error'
                  ? 'border-red-200/80 dark:border-red-900/60'
                  : ''
              }`}
            >
              {/* File Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {isImg ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : item.sourceExt.toLowerCase() === 'pdf' ? (
                    <span className="text-slate-700 dark:text-slate-200 font-mono font-bold text-[11px]">PDF</span>
                  ) : (
                    <FileText className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.name}
                  </p>

                  {item.status === 'completed' && item.resultBlob ? (
                    <div className="flex items-center gap-2 mt-0.5 text-xs tabular-nums">
                      <span className="font-mono text-slate-400 line-through text-[11px]">
                        {formatFileSize(item.size)}
                      </span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        {formatFileSize(item.resultBlob.size)}
                      </span>
                      {item.size > item.resultBlob.size && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium text-[10px]">
                          -{Math.round(((item.size - item.resultBlob.size) / item.size) * 100)}%
                        </span>
                      )}
                    </div>
                  ) : item.status === 'error' ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1 truncate">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.errorMessage || 'Conversion failed'}</span>
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-mono">{formatFileSize(item.size)}</span>
                      <span>·</span>
                      <span className="uppercase font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {item.sourceExt}
                      </span>
                    </div>
                  )}

                  {item.status === 'converting' && (
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(15, item.progress || 25)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Output</span>
                  <button
                    type="button"
                    onClick={() => onOpenFormatModal(item.id)}
                    disabled={item.status === 'converting'}
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-200 font-semibold text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <span>{item.targetFormat.toUpperCase()}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSettingsModal(item.id)}
                  disabled={item.status === 'converting'}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  title="Output parameters"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                {item.status === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.resultBlob) return;
                      const dotIdx = item.name.lastIndexOf('.');
                      const base = dotIdx > 0 ? item.name.substring(0, dotIdx) : item.name;
                      const fallbackName = `${base}.${item.targetFormat}`;
                      downloadBlob(item.resultBlob, item.resultFileName || fallbackName);
                    }}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                ) : item.status === 'converting' ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Working</span>
                  </div>
                ) : item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => onConvertSingle(item.id)}
                    disabled={isConvertingAny}
                    className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:hover:bg-red-950/60 dark:border-red-800/70 dark:text-red-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConvertSingle(item.id)}
                    disabled={isConvertingAny}
                    className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Convert</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  disabled={item.status === 'converting'}
                  className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
