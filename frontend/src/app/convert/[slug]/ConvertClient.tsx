'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { Dropzone } from '@/components/Dropzone';
import { FileQueue } from '@/components/FileQueue';
import { FormatModal } from '@/components/FormatModal';
import { FormatPairSelector } from '@/components/FormatPairSelector';
import { SettingsModal } from '@/components/SettingsModal';
import { Footer } from '@/components/Footer';
import { FileItem, ConversionSettings } from '@/types';
import { convertSingleFile, mergeImagesToPdf, downloadBlob } from '@/lib/api';
import { DEFAULT_TARGET_FORMATS, getCompatibleTargets } from '@/lib/formatRegistry';
import { FormatPairSEO, POPULAR_SEO_PAIRS } from '@/lib/seoData';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ConvertClientProps {
  seoData: FormatPairSEO;
}

export const ConvertClient: React.FC<ConvertClientProps> = ({ seoData }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>([]);
  filesRef.current = files;

  useEffect(() => {
    return () => {
      filesRef.current.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);
  const [isConvertingAny, setIsConvertingAny] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const dropzoneRef = React.useRef<any>(null);

  const router = useRouter();
  const [activeFormatFileId, setActiveFormatFileId] = useState<string | null>(null);
  const [activeSettingsFileId, setActiveSettingsFileId] = useState<string | null>(null);
  const [isBatchSettingsOpen, setIsBatchSettingsOpen] = useState(false);
  const [isBatchFormatOpen, setIsBatchFormatOpen] = useState(false);
  const [heroPickerMode, setHeroPickerMode] = useState<'source' | 'target' | null>(null);

  const defaultSettings: ConversionSettings = {
    quality: 90,
    maintainAspectRatio: true,
    dpi: 300,
    grayscale: false,
    bgColor: '#FFFFFF',
  };

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const newItems: FileItem[] = newFiles.map(file => {
        const dotIdx = file.name.lastIndexOf('.');
        const ext = dotIdx > 0 ? file.name.substring(dotIdx + 1).toLowerCase() : '';
        const isImg =
          file.type.startsWith('image/') ||
          ['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'tiff', 'gif', 'heic', 'ico', 'svg'].includes(ext);

        return {
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          file,
          name: file.name,
          size: file.size,
          sourceExt: ext || seoData.source,
          targetFormat: seoData.target,
          previewUrl: isImg ? URL.createObjectURL(file) : undefined,
          status: 'idle',
          progress: 0,
          settings: { ...defaultSettings },
        };
      });

      setFiles(prev => [...prev, ...newItems]);
    },
    [seoData]
  );

  const handleSelectFormat = (formatExt: string) => {
    if (!activeFormatFileId) return;
    setFiles(prev =>
      prev.map(item =>
        item.id === activeFormatFileId
          ? {
              ...item,
              targetFormat: formatExt.toLowerCase(),
              status: 'idle',
              progress: 0,
              resultBlob: undefined,
              resultFileName: undefined,
              errorMessage: undefined,
            }
          : item
      )
    );
  };

  const handleSelectAllFormat = (formatExt: string) => {
    const cleanFmt = formatExt.toLowerCase();
    setFiles(prev =>
      prev.map(item => {
        const compatible = getCompatibleTargets(item.sourceExt);
        if (compatible.some(f => f.ext === cleanFmt)) {
          return {
            ...item,
            targetFormat: cleanFmt,
            status: 'idle',
            progress: 0,
            resultBlob: undefined,
            resultFileName: undefined,
            errorMessage: undefined,
          };
        }
        return item;
      })
    );
  };

  const handleSaveSettings = (newSettings: ConversionSettings, applyToAll: boolean = false) => {
    if (applyToAll || isBatchSettingsOpen) {
      setFiles(prev =>
        prev.map(item => ({
          ...item,
          settings: { ...newSettings },
        }))
      );
      setIsBatchSettingsOpen(false);
      return;
    }

    if (!activeSettingsFileId) return;
    setFiles(prev =>
      prev.map(item =>
        item.id === activeSettingsFileId
          ? {
              ...item,
              settings: newSettings,
              status: 'idle',
              progress: 0,
              resultBlob: undefined,
              resultFileName: undefined,
              errorMessage: undefined,
            }
          : item
      )
    );
  };

  const handleRemoveFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const toRemove = prev.find(f => f.id === id);
      if (toRemove?.previewUrl) URL.revokeObjectURL(toRemove.previewUrl);
      return filtered;
    });
  };

  const handleClearAll = () => {
    files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
  };

  const handleConvertSingle = async (id: string) => {
    const targetItem = filesRef.current.find(f => f.id === id);
    if (!targetItem) return;

    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, status: 'converting', progress: 15, errorMessage: undefined } : f))
    );

    try {
      const result = await convertSingleFile(
        targetItem.file,
        targetItem.targetFormat,
        targetItem.settings,
        percent => {
          setFiles(prev =>
            prev.map(f => (f.id === id ? { ...f, progress: percent } : f))
          );
        }
      );

      setFiles(prev =>
        prev.map(f =>
          f.id === id
            ? {
                ...f,
                status: 'completed',
                progress: 100,
                resultBlob: result.blob,
                resultFileName: result.fileName,
              }
            : f
        )
      );
    } catch (err: any) {
      setFiles(prev =>
        prev.map(f =>
          f.id === id
            ? {
                ...f,
                status: 'error',
                progress: 0,
                errorMessage: err.message || 'Conversion failed',
              }
            : f
        )
      );
    }
  };

  const handleConvertAll = async () => {
    setIsConvertingAny(true);
    const pendingItems = filesRef.current.filter(f => f.status === 'idle' || f.status === 'error');

    const CONCURRENCY = 3;
    const queue = [...pendingItems];

    const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) {
          await handleConvertSingle(item.id);
        }
      }
    });

    await Promise.all(workers);
    setIsConvertingAny(false);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter(f => f.status === 'completed' && f.resultBlob);
    if (completedItems.length === 0) return;

    const getCleanName = (item: FileItem) => {
      if (item.resultFileName) return item.resultFileName;
      const dotIdx = item.name.lastIndexOf('.');
      const base = dotIdx > 0 ? item.name.substring(0, dotIdx) : item.name;
      return `${base}.${item.targetFormat}`;
    };

    if (completedItems.length === 1) {
      const item = completedItems[0];
      downloadBlob(item.resultBlob!, getCleanName(item));
      return;
    }

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      completedItems.forEach(item => {
        const rawName = getCleanName(item);
        const count = usedNames.get(rawName) || 0;
        usedNames.set(rawName, count + 1);

        let finalName = rawName;
        if (count > 0) {
          const dotIdx = rawName.lastIndexOf('.');
          if (dotIdx > 0) {
            finalName = `${rawName.substring(0, dotIdx)} (${count})${rawName.substring(dotIdx)}`;
          } else {
            finalName = `${rawName} (${count})`;
          }
        }
        zip.file(finalName, item.resultBlob!);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${seoData.slug}_conversions.zip`);
    } catch {
      alert('Failed to bundle ZIP');
    }
  };

  const handleMergeToPdf = async () => {
    const imageFiles = files.map(f => f.file);
    setIsConvertingAny(true);
    try {
      const res = await mergeImagesToPdf(imageFiles, 'combined_document.pdf');
      downloadBlob(res.blob, res.fileName);
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    } finally {
      setIsConvertingAny(false);
    }
  };

  const activeFormatFile = files.find(f => f.id === activeFormatFileId);
  const activeSettingsFile = files.find(f => f.id === activeSettingsFileId);
  const otherPairs = POPULAR_SEO_PAIRS.filter(p => p.slug !== seoData.slug);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-400">Convert</span>
          <span>/</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {seoData.source.toUpperCase()} to {seoData.target.toUpperCase()}
          </span>
        </nav>

        {/* Hero Section */}
        <div className="text-center space-y-2.5 max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Convert {seoData.source.toUpperCase()} to {seoData.target.toUpperCase()}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {seoData.description}
          </p>
        </div>

        {/* Tool Widget */}
        <div className="space-y-3">
          <div className="panel rounded-xl p-3 sm:p-4 space-y-3">
            <FormatPairSelector
              sourceFormat={seoData.source}
              targetFormat={seoData.target}
              onClickSource={() => setHeroPickerMode('source')}
              onClickTarget={() => setHeroPickerMode('target')}
              onSwap={() => router.push(`/convert/${seoData.target}-to-${seoData.source}`)}
            />

            <Dropzone
              ref={dropzoneRef}
              onFilesAdded={handleFilesAdded}
              isCompact={files.length > 0}
              acceptFilter={seoData.accept}
              activePresetLabel={`${seoData.source.toUpperCase()} → ${seoData.target.toUpperCase()}`}
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

        {/* 3-Step Guide */}
        <section className="panel rounded-xl p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              How to Convert {seoData.source.toUpperCase()} to {seoData.target.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Three steps to convert your files with full fidelity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Select .{seoData.source.toUpperCase()} Files</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Click &ldquo;Select Files&rdquo; or drop your .{seoData.source.toLowerCase()} files into the conversion area above.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Configure & Process</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Adjust resolution, DPI, or compression settings if needed, then click &ldquo;Convert&rdquo;.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="w-6 h-6 rounded-md bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Save .{seoData.target.toUpperCase()} Output</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Save converted .{seoData.target.toLowerCase()} files individually or download the batch as a single ZIP archive.
              </p>
            </div>
          </div>
        </section>

        {/* Format Comparison Specs Table */}
        <section className="space-y-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              {seoData.source.toUpperCase()} vs {seoData.target.toUpperCase()} Technical Specifications
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Property</th>
                  <th className="p-3.5">{seoData.source.toUpperCase()}</th>
                  <th className="p-3.5">{seoData.target.toUpperCase()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                <tr className="bg-white dark:bg-slate-950">
                  <td className="p-3.5 font-medium text-slate-500">Full Name</td>
                  <td className="p-3.5 text-slate-900 dark:text-slate-100">{seoData.sourceName}</td>
                  <td className="p-3.5 text-slate-900 dark:text-slate-100">{seoData.targetName}</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-900/40">
                  <td className="p-3.5 font-medium text-slate-500">Standard / Developer</td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">{seoData.sourceSpecs.developer}</td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">{seoData.targetSpecs.developer}</td>
                </tr>
                <tr className="bg-white dark:bg-slate-950">
                  <td className="p-3.5 font-medium text-slate-500">MIME Type</td>
                  <td className="p-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">{seoData.sourceSpecs.mime}</td>
                  <td className="p-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">{seoData.targetSpecs.mime}</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-900/40">
                  <td className="p-3.5 font-medium text-slate-500">Compression Profile</td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">{seoData.sourceSpecs.compression}</td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">{seoData.targetSpecs.compression}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="space-y-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-2">
            {seoData.faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className="panel rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-medium text-xs sm:text-sm text-slate-900 dark:text-white cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180 text-slate-900 dark:text-white' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Related Conversions Grid */}
        <section className="space-y-3.5 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Related Format Converters
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {otherPairs.slice(0, 8).map(p => (
              <Link
                key={p.slug}
                href={`/convert/${p.slug}`}
                className="p-3 rounded-lg panel panel-hover text-xs font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <span>{p.source.toUpperCase()} → {p.target.toUpperCase()}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      {/* Batch Format Modal */}
      <FormatModal
        isOpen={isBatchFormatOpen}
        onClose={() => setIsBatchFormatOpen(false)}
        onSelect={fmt => {
          handleSelectAllFormat(fmt);
          setIsBatchFormatOpen(false);
        }}
        sourceExt={undefined}
        currentSelected={files[0]?.targetFormat || seoData.target}
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
          const cleanFmt = fmt.toLowerCase().replace('.', '');
          if (heroPickerMode === 'source') {
            const compat = getCompatibleTargets(cleanFmt);
            const nextTarget = compat.some(f => f.ext === seoData.target)
              ? seoData.target
              : DEFAULT_TARGET_FORMATS[cleanFmt] || compat[0]?.ext || 'webp';
            router.push(`/convert/${cleanFmt}-to-${nextTarget}`);
          } else {
            router.push(`/convert/${seoData.source}-to-${cleanFmt}`);
          }
        }}
        sourceExt={heroPickerMode === 'target' ? seoData.source : undefined}
        currentSelected={heroPickerMode === 'source' ? seoData.source : seoData.target}
        mode={heroPickerMode || 'target'}
      />

      {(activeSettingsFile || isBatchSettingsOpen) && (
        <SettingsModal
          isOpen={Boolean(activeSettingsFileId) || isBatchSettingsOpen}
          onClose={() => {
            setActiveSettingsFileId(null);
            setIsBatchSettingsOpen(false);
          }}
          settings={activeSettingsFile?.settings || files[0]?.settings || defaultSettings}
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
