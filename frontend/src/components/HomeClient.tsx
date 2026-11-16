'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { Navbar } from './Navbar';
import { Dropzone, DropzoneHandle } from './Dropzone';
import { FileQueue } from './FileQueue';
import { FormatModal } from './FormatModal';
import { FormatPairSelector } from './FormatPairSelector';
import { SettingsModal } from './SettingsModal';
import { QuickTools } from './QuickTools';
import { FeatureGrid } from './FeatureGrid';
import { Footer } from './Footer';
import { useConversionQueue } from '../hooks/useConversionQueue';
import { ActiveTool, DEDICATED_TOOL_IDS, TOOL_ROUTES, getToolHref } from '@/lib/toolsConfig';

const LEGACY_TOOL_PARAMS: ActiveTool[] = ['file-host', 'load-tester', 'my-ip', 'da-checker'];

export const HomeClient: React.FC = () => {
  const router = useRouter();
  const dropzoneRef = React.useRef<DropzoneHandle>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTool = params.get('tool') as ActiveTool | null;
    if (requestedTool && LEGACY_TOOL_PARAMS.includes(requestedTool)) {
      router.replace(getToolHref(requestedTool));
    }
  }, [router]);

  const [heroPickerMode, setHeroPickerMode] = useState<'source' | 'target' | null>(null);

  const {
    files, setFiles, isConvertingAny, activePreset, setActivePreset,
    activeFormatFileId, setActiveFormatFileId, activeSettingsFileId, setActiveSettingsFileId,
    isBatchSettingsOpen, setIsBatchSettingsOpen, isBatchFormatOpen, setIsBatchFormatOpen,
    isGlobalDragging, setIsGlobalDragging, handleFilesAdded, handleSelectFormat, handleSelectAllFormat, handleSaveSettings,
    handleRemoveFile, handleClearAll, handleConvertSingle, handleConvertAll,
    handleDownloadAllZip, handleMergeToPdf,
    heroSourceFormat, setHeroSourceFormat, heroTargetFormat, setHeroTargetFormat,
    handleSelectHeroSource, handleSelectHeroTarget, handleSwapHeroFormats,
    activeFormatFile, activeSettingsFile
  } = useConversionQueue(true);

  const handlePresetTrigger = (target: string, label: string, accept?: string, source?: string) => {
    if (source) {
      setHeroSourceFormat(source.toLowerCase());
    }
    setHeroTargetFormat(target.toLowerCase());
    if (files.length > 0) {
      setFiles(prev =>
        prev.map(f => ({
          ...f,
          targetFormat: target,
          status: 'idle',
          progress: 0,
          resultBlob: undefined,
          resultFileName: undefined,
          errorMessage: undefined,
        }))
      );
    } else {
      setActivePreset({ target, label, accept });
      setTimeout(() => {
        dropzoneRef.current?.openPicker();
      }, 50);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {isGlobalDragging && (
        <div
          onClick={() => setIsGlobalDragging(false)}
          className="fixed inset-0 z-50 bg-slate-900/20 dark:bg-black/50 backdrop-blur-xs border-2 border-dashed border-blue-600 rounded-xl m-3 flex flex-col items-center justify-center animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="p-6 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 cursor-default"
          >
            <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Release files to add to conversion queue
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supports images, documents, PDFs, and spreadsheets
            </p>
          </div>
        </div>
      )}

      <Navbar
        activeTool="converter"
        onSelectQuickFilter={(targetFmt, accept, sourceFmt) => {
          const src = sourceFmt || heroSourceFormat;
          handlePresetTrigger(targetFmt, `${src.toUpperCase()} → ${targetFmt.toUpperCase()}`, accept, src);
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16 space-y-8 sm:space-y-10">
        <div className="space-y-7 sm:space-y-9">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Free Universal File Converter
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Convert between raster images, vector graphics, PDFs, Word documents, presentations, and spreadsheets. Ephemeral processing with zero retention.
            </p>
          </div>

          <div className="space-y-3">
            <div className="panel rounded-xl p-3 sm:p-4 space-y-3">
              <FormatPairSelector
                sourceFormat={heroSourceFormat}
                targetFormat={heroTargetFormat}
                onClickSource={() => setHeroPickerMode('source')}
                onClickTarget={() => setHeroPickerMode('target')}
                onSwap={handleSwapHeroFormats}
              />

              <Dropzone
                ref={dropzoneRef}
                onFilesAdded={handleFilesAdded}
                isCompact={files.length > 0}
                acceptFilter={activePreset?.accept || `.${heroSourceFormat}`}
                activePresetLabel={`${heroSourceFormat.toUpperCase()} → ${heroTargetFormat.toUpperCase()}`}
              />
            </div>

            <FileQueue
              items={files}
              onOpenFormatModal={id => setActiveFormatFileId(id)}
              onOpenSettingsModal={id => setActiveSettingsFileId(id)}
              onOpenBatchFormat={() => setIsBatchFormatOpen(true)}
              onOpenBatchSettings={() => setIsBatchSettingsOpen(true)}
              onConvertSingle={handleConvertSingle}
              onRemoveItem={handleRemoveFile}
              onConvertAll={handleConvertAll}
              onDownloadAllZip={handleDownloadAllZip}
              onMergeToPdf={handleMergeToPdf}
              onClearAll={handleClearAll}
              isConvertingAny={isConvertingAny}
            />
          </div>

          <QuickTools
            onPresetSelected={(source, target, accept) => {
              handlePresetTrigger(target, `${source.toUpperCase()} → ${target.toUpperCase()}`, accept, source);
            }}
          />

          <FeatureGrid />

          <section className="space-y-3.5 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                More Free Utilities
              </h2>
              <Link
                href="/convert"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Browse All Converters</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {DEDICATED_TOOL_IDS.map(id => {
                const tool = TOOL_ROUTES[id];
                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="p-3.5 rounded-xl panel panel-hover flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <span>{tool.footerLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <FormatModal
        isOpen={isBatchFormatOpen}
        onClose={() => setIsBatchFormatOpen(false)}
        onSelect={fmt => {
          handleSelectAllFormat(fmt);
          setIsBatchFormatOpen(false);
        }}
        sourceExt={undefined}
        currentSelected={files[0]?.targetFormat || heroTargetFormat}
        mode="target"
      />

      <FormatModal
        isOpen={Boolean(activeFormatFileId)}
        onClose={() => setActiveFormatFileId(null)}
        onSelect={handleSelectFormat}
        sourceExt={activeFormatFile?.sourceExt}
        currentSelected={activeFormatFile?.targetFormat}
        mode="target"
      />

      <FormatModal
        isOpen={Boolean(heroPickerMode)}
        onClose={() => setHeroPickerMode(null)}
        onSelect={fmt => {
          if (heroPickerMode === 'source') {
            handleSelectHeroSource(fmt);
          } else {
            handleSelectHeroTarget(fmt);
          }
        }}
        sourceExt={heroPickerMode === 'target' ? heroSourceFormat : undefined}
        currentSelected={heroPickerMode === 'source' ? heroSourceFormat : heroTargetFormat}
        mode={heroPickerMode || 'target'}
      />

      {(activeSettingsFile || isBatchSettingsOpen) && (
        <SettingsModal
          isOpen={Boolean(activeSettingsFileId) || isBatchSettingsOpen}
          onClose={() => {
            setActiveSettingsFileId(null);
            setIsBatchSettingsOpen(false);
          }}
          settings={activeSettingsFile?.settings || files[0]?.settings || {
            quality: 90,
            maintainAspectRatio: true,
            dpi: 300,
            grayscale: false,
            bgColor: '#FFFFFF',
          }}
          onSave={handleSaveSettings}
          fileName={activeSettingsFile?.name}
          targetFormat={activeSettingsFile?.targetFormat || files[0]?.targetFormat}
          isBatch={isBatchSettingsOpen}
          totalFiles={files.length}
        />
      )}
    </div>
  );
};
