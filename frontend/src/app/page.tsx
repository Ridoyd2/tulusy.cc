'use client';

import React, { useState, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { Navbar, ActiveTool } from '../components/Navbar';
import { Dropzone } from '../components/Dropzone';
import { FileQueue } from '../components/FileQueue';
import { FormatModal } from '../components/FormatModal';
import { FormatPairSelector } from '../components/FormatPairSelector';
import { SettingsModal } from '../components/SettingsModal';
import { QuickTools } from '../components/QuickTools';
import { FeatureGrid } from '../components/FeatureGrid';
import { Footer } from '../components/Footer';
import { LoadTester } from '../components/LoadTester';
import { MyIpTool } from '../components/MyIpTool';
import { DaChecker } from '../components/DaChecker';
import { FileHostTool } from '../components/FileHostTool';
import { useConversionQueue } from '../hooks/useConversionQueue';

const VALID_TOOLS: ActiveTool[] = ['converter', 'file-host', 'load-tester', 'my-ip', 'da-checker'];

export default function Home() {
  const [activeTool, setActiveTool] = useState<ActiveTool>('converter');
  const dropzoneRef = React.useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedTool = params.get('tool') as ActiveTool | null;
      if (requestedTool && VALID_TOOLS.includes(requestedTool)) {
        setActiveTool(requestedTool);
      }
    }
  }, []);

  const handleSelectTool = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tool === 'converter') {
        url.searchParams.delete('tool');
      } else {
        url.searchParams.set('tool', tool);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

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
  } = useConversionQueue(activeTool === 'converter');

  const handlePresetTrigger = (target: string, label: string, accept?: string, source?: string) => {
    handleSelectTool('converter');
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
      {/* Global Drag Overlay */}
      {isGlobalDragging && activeTool === 'converter' && (
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

      {/* Global Navigation Bar */}
      <Navbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        onSelectQuickFilter={(targetFmt, accept, sourceFmt) => {
          const src = sourceFmt || heroSourceFormat;
          handlePresetTrigger(targetFmt, `${src.toUpperCase()} → ${targetFmt.toUpperCase()}`, accept, src);
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16 space-y-8 sm:space-y-10">
        {activeTool === 'converter' && (
          <div className="space-y-7 sm:space-y-9">
            {/* Header */}
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                File Conversion Engine
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Convert between raster images, vector graphics, PDFs, Word documents, presentations, and spreadsheets. Ephemeral processing with zero retention.
              </p>
            </div>

            {/* Unified Conversion Workspace (Selector + Dropzone + Batch Queue) */}
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

            {/* Quick Tools Presets */}
            <QuickTools
              onPresetSelected={(source, target, accept) => {
                handlePresetTrigger(target, `${source.toUpperCase()} → ${target.toUpperCase()}`, accept, source);
              }}
            />

            {/* Feature Grid */}
            <FeatureGrid />
          </div>
        )}

        {activeTool === 'file-host' && <FileHostTool />}
        {activeTool === 'load-tester' && <LoadTester />}
        {activeTool === 'my-ip' && <MyIpTool />}
        {activeTool === 'da-checker' && <DaChecker />}
      </main>

      <Footer onSelectTool={handleSelectTool} />

      {/* Batch All-In-One Format Picker Modal */}
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

      {/* Target Format Picker Modal (Queue Item) */}
      <FormatModal
        isOpen={Boolean(activeFormatFileId)}
        onClose={() => setActiveFormatFileId(null)}
        onSelect={handleSelectFormat}
        sourceExt={activeFormatFile?.sourceExt}
        currentSelected={activeFormatFile?.targetFormat}
        mode="target"
      />

      {/* Hero Source / Target Format Picker Modal */}
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

      {/* Conversion Settings Modal (Individual or Batch) */}
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
}
