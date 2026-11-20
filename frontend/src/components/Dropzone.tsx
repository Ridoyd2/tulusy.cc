'use client';

import React, { forwardRef, useState, useEffect, useImperativeHandle, useRef } from 'react';
import { UploadCloud, FileUp, Plus } from 'lucide-react';

export interface DropzoneHandle {
  openPicker: () => void;
}

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  isCompact?: boolean;
  acceptFilter?: string;
  activePresetLabel?: string | null;
}

export const Dropzone = forwardRef<DropzoneHandle, DropzoneProps>(({
  onFilesAdded,
  isCompact,
  acceptFilter,
  activePresetLabel,
}, ref) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openPicker: () => {
      inputRef.current?.click();
    },
  }));

  // Single Clipboard Paste Listener (Ctrl+V) active only while Dropzone is mounted
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (!e.clipboardData) return;

      const pastedFiles: File[] = [];
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        pastedFiles.push(...Array.from(e.clipboardData.files));
      } else if (e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) pastedFiles.push(f);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        onFilesAdded(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesAdded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(Array.from(e.target.files));
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  if (isCompact) {
    return (
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full py-3 px-4 rounded-lg border border-dashed transition-all cursor-pointer flex items-center justify-between gap-3 ${
          isDragOver
            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptFilter}
          onClick={e => e.stopPropagation()}
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-medium truncate">
            Add more files to queue or drop anywhere
          </span>
        </div>
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
          Browse
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative w-full rounded-lg p-6 sm:p-8 transition-all border border-dashed cursor-pointer ${
        isDragOver
          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
          : 'border-slate-300 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-950/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptFilter}
        onClick={e => e.stopPropagation()}
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mt-4">
          {activePresetLabel ? `Drop files for ${activePresetLabel}` : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {activePresetLabel
            ? `Files added will automatically target ${activePresetLabel}.`
            : 'Images (PNG, JPG, WebP, AVIF, SVG, HEIC, ICO, PSD) & Documents (PDF, DOCX, PPTX, XLSX, CSV, TXT).'}
        </p>

        <div className="mt-5 w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            Select Files
          </button>

          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span>or press</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300">Ctrl+V</kbd>
          </div>
        </div>
      </div>
    </div>
  );
});

Dropzone.displayName = 'Dropzone';
