import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FileItem, ConversionSettings } from '../types';
import {
  DEFAULT_TARGET_FORMATS,
  getCompatibleTargets,
  ALL_FORMATS,
  normalizeFormatExt,
  inferFormatFromMime,
  isImageSourceExt,
} from '../lib/formatRegistry';
import { convertSingleFile, mergeImagesToPdf, downloadBlob } from '../lib/api';

const MAX_CONVERTER_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const LEGACY_UNSUPPORTED_EXTS = new Set(['doc', 'ppt', 'xls']);

function isItemConvertible(item: FileItem): boolean {
  return (
    item.size > 0 &&
    item.size <= MAX_CONVERTER_FILE_SIZE &&
    getCompatibleTargets(item.sourceExt).length > 0
  );
}

const BROWSER_PREVIEWABLE_IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'bmp',
  'gif',
  'ico',
  'svg',
]);

export const DEFAULT_CONVERSION_SETTINGS: ConversionSettings = {
  quality: 90,
  maintainAspectRatio: true,
  dpi: 300,
  grayscale: false,
  bgColor: '#FFFFFF',
};

export interface UseConversionQueueOptions {
  enabled?: boolean;
  initialSource?: string;
  initialTarget?: string;
  defaultSourceExt?: string;
  zipFileName?: string;
  lockTargetToInitial?: boolean;
}

export function useConversionQueue(
  enabledOrOptions: boolean | UseConversionQueueOptions = true
) {
  const options: UseConversionQueueOptions =
    typeof enabledOrOptions === 'boolean'
      ? { enabled: enabledOrOptions }
      : enabledOrOptions;

  const enabled = options.enabled ?? true;
  const initialSource = (options.initialSource || 'png').toLowerCase().replace('.', '');
  const initialTarget = (options.initialTarget || 'webp').toLowerCase().replace('.', '');
  const defaultSourceExt = options.defaultSourceExt?.toLowerCase().replace('.', '');
  const zipFileName = options.zipFileName || 'Tulusy_Conversions.zip';
  const lockTargetToInitial = options.lockTargetToInitial ?? false;

  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);
  const [isConvertingAny, setIsConvertingAny] = useState(false);
  const [isMergingPdf, setIsMergingPdf] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<{ target: string; label: string; accept?: string } | null>(null);
  const [heroSourceFormat, setHeroSourceFormat] = useState<string>(initialSource);
  const [heroTargetFormat, setHeroTargetFormat] = useState<string>(initialTarget);
  
  const [activeFormatFileId, setActiveFormatFileId] = useState<string | null>(null);
  const [activeSettingsFileId, setActiveSettingsFileId] = useState<string | null>(null);
  const [isBatchSettingsOpen, setIsBatchSettingsOpen] = useState(false);
  const [isBatchFormatOpen, setIsBatchFormatOpen] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const itemGenerationRef = useRef<Map<string, number>>(new Map());
  const inFlightConversionsRef = useRef<Map<string, number>>(new Map());
  const batchRunningRef = useRef(false);

  const bumpItemGeneration = useCallback((id: string) => {
    itemGenerationRef.current.set(id, (itemGenerationRef.current.get(id) ?? 0) + 1);
  }, []);

  const handleSelectHeroSource = useCallback((newSource: string) => {
    const cleanSrc = normalizeFormatExt(newSource);
    setHeroSourceFormat(cleanSrc);
    setActivePreset(null);
    const compatible = getCompatibleTargets(cleanSrc);
    const isCurrentTargetValid = compatible.some(f => f.ext === heroTargetFormat);
    const nextTarget = isCurrentTargetValid
      ? heroTargetFormat
      : DEFAULT_TARGET_FORMATS[cleanSrc] || compatible[0]?.ext || 'webp';
    setHeroTargetFormat(nextTarget);
  }, [heroTargetFormat]);

  const handleSelectHeroTarget = useCallback((newTarget: string) => {
    const cleanTgt = normalizeFormatExt(newTarget);
    setHeroTargetFormat(cleanTgt);
    setActivePreset(null);
    setFiles(prev =>
      prev.map(item => {
        const compatible = getCompatibleTargets(item.sourceExt);
        if (item.status === 'idle' && compatible.some(f => f.ext === cleanTgt)) {
          bumpItemGeneration(item.id);
          return { ...item, targetFormat: cleanTgt };
        }
        return item;
      })
    );
  }, [bumpItemGeneration]);

  const handleSwapHeroFormats = useCallback(() => {
    const compatible = getCompatibleTargets(heroTargetFormat);
    if (!compatible.some(f => f.ext === heroSourceFormat)) return;
    const nextSource = heroTargetFormat;
    const nextTarget = heroSourceFormat;
    setHeroSourceFormat(nextSource);
    setHeroTargetFormat(nextTarget);
    setActivePreset(null);
    setFiles(prev =>
      prev.map(item => {
        const itemCompat = getCompatibleTargets(item.sourceExt);
        if (item.status === 'idle' && itemCompat.some(f => f.ext === nextTarget)) {
          bumpItemGeneration(item.id);
          return { ...item, targetFormat: nextTarget };
        }
        return item;
      })
    );
  }, [heroSourceFormat, heroTargetFormat, bumpItemGeneration]);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setQueueError(null);
    const newItems: FileItem[] = newFiles.map(file => {
      const dotIdx = file.name.lastIndexOf('.');
      const rawExt = dotIdx > 0 ? file.name.substring(dotIdx + 1).toLowerCase().trim() : '';
      const inferredMimeExt = !rawExt ? inferFormatFromMime(file.type) : '';
      const ext = rawExt || inferredMimeExt;
      const normExt = ext ? normalizeFormatExt(ext) : '';
      const isImg = Boolean(normExt && BROWSER_PREVIEWABLE_IMAGE_EXTS.has(normExt));

      const effectiveSource = normExt || defaultSourceExt || 'bin';
      const isLegacy = LEGACY_UNSUPPORTED_EXTS.has(normExt || ext);
      const compatible =
        effectiveSource !== 'bin' && !isLegacy ? getCompatibleTargets(effectiveSource) : [];
      const fallbackTarget = DEFAULT_TARGET_FORMATS[effectiveSource] || compatible[0]?.ext || '';

      const pickCompatibleOrFallback = (preferred?: string) => {
        if (!preferred) return fallbackTarget;
        const cleanPref = normalizeFormatExt(preferred);
        return compatible.some(f => f.ext === cleanPref) ? cleanPref : fallbackTarget;
      };

      const targetFmt = lockTargetToInitial
        ? pickCompatibleOrFallback(initialTarget)
        : activePreset?.target
        ? pickCompatibleOrFallback(activePreset.target)
        : pickCompatibleOrFallback(heroTargetFormat);

      let validationError: string | undefined;
      if (file.size === 0) {
        validationError = 'Cannot convert an empty (0 byte) file.';
      } else if (file.size > MAX_CONVERTER_FILE_SIZE) {
        validationError = 'File exceeds the 100 MB converter upload limit.';
      } else if (isLegacy) {
        validationError = `Legacy .${ext} files are unsupported. Please re-save as .${ext}x.`;
      } else if (compatible.length === 0) {
        validationError =
          effectiveSource === 'bin'
            ? 'Unrecognized file format. Please check the file extension.'
            : `Unsupported source format (.${effectiveSource}).`;
      }

      return {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        file,
        name: file.name,
        size: file.size,
        sourceExt: ext || defaultSourceExt || 'bin',
        targetFormat: targetFmt || 'webp',
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        status: validationError ? 'error' : 'idle',
        progress: 0,
        errorMessage: validationError,
        settings: { ...DEFAULT_CONVERSION_SETTINGS },
      };
    });

    const firstValid = newItems.find(isItemConvertible);
    if (firstValid && filesRef.current.length === 0) {
      const firstNorm = normalizeFormatExt(firstValid.sourceExt);
      if (ALL_FORMATS.some(f => f.ext === firstNorm)) {
        setHeroSourceFormat(firstNorm);
        setHeroTargetFormat(firstValid.targetFormat);
      }
    }

    setFiles(prev => [...prev, ...newItems]);
    setActivePreset(null);
    dragCounterRef.current = 0;
    setIsGlobalDragging(false);
  }, [activePreset, heroTargetFormat, defaultSourceExt, initialTarget, lockTargetToInitial]);

  const handleSelectFormat = (formatExt: string) => {
    if (!activeFormatFileId) return;
    const cleanFmt = normalizeFormatExt(formatExt);
    bumpItemGeneration(activeFormatFileId);
    setFiles(prev =>
      prev.map(item =>
        item.id === activeFormatFileId && item.status !== 'converting'
          ? {
              ...item,
              targetFormat: cleanFmt,
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

  const handleSelectAllFormat = useCallback((formatExt: string) => {
    const cleanFmt = normalizeFormatExt(formatExt);
    if (getCompatibleTargets(heroSourceFormat).some(f => f.ext === cleanFmt)) {
      setHeroTargetFormat(cleanFmt);
    }
    setFiles(prev =>
      prev.map(item => {
        if (item.status === 'converting' || !isItemConvertible(item)) return item;
        const compatible = getCompatibleTargets(item.sourceExt);
        if (compatible.some(f => f.ext === cleanFmt)) {
          bumpItemGeneration(item.id);
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
  }, [bumpItemGeneration, heroSourceFormat]);

  const handleSaveSettings = useCallback((newSettings: ConversionSettings, applyToAll: boolean = false) => {
    if (applyToAll || isBatchSettingsOpen) {
      setFiles(prev =>
        prev.map(item => {
          if (item.status === 'converting') return item;
          bumpItemGeneration(item.id);
          return {
            ...item,
            settings: { ...newSettings },
            status: 'idle',
            progress: 0,
            resultBlob: undefined,
            resultFileName: undefined,
            errorMessage: undefined,
          };
        })
      );
      setIsBatchSettingsOpen(false);
      return;
    }

    if (!activeSettingsFileId) return;
    bumpItemGeneration(activeSettingsFileId);
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
  }, [activeSettingsFileId, isBatchSettingsOpen, bumpItemGeneration]);

  const handleRemoveFile = (id: string) => {
    bumpItemGeneration(id);
    inFlightConversionsRef.current.delete(id);
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const toRemove = prev.find(f => f.id === id);
      if (toRemove?.previewUrl) URL.revokeObjectURL(toRemove.previewUrl);
      return filtered;
    });
  };

  const handleClearAll = () => {
    files.forEach(f => {
      bumpItemGeneration(f.id);
      inFlightConversionsRef.current.delete(f.id);
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
  };

  useEffect(() => {
    if (!enabled) {
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      return;
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounterRef.current++;
      setIsGlobalDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0 || (e.clientX === 0 && e.clientY === 0)) {
        dragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        handleFilesAdded(droppedFiles);
      }
    };

    const handleDragEnd = () => {
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
    };

    // Use capture phase so window reliably intercepts drop & dragleave without double-firing Dropzone
    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragleave', handleDragLeave, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('drop', handleDrop, true);
    window.addEventListener('dragend', handleDragEnd, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('drop', handleDrop, true);
      window.removeEventListener('dragend', handleDragEnd, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleFilesAdded]);

  const handleConvertSingle = async (id: string) => {
    const targetItem = filesRef.current.find(f => f.id === id);
    if (
      !targetItem ||
      !isItemConvertible(targetItem) ||
      targetItem.status === 'converting' ||
      inFlightConversionsRef.current.has(id)
    ) {
      return;
    }

    const myGen = (itemGenerationRef.current.get(id) ?? 0) + 1;
    itemGenerationRef.current.set(id, myGen);
    inFlightConversionsRef.current.set(id, myGen);
    setIsConvertingAny(true);

    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, status: 'converting', progress: 10, errorMessage: undefined } : f))
    );

    try {
      const result = await convertSingleFile(
        targetItem.file,
        targetItem.targetFormat,
        targetItem.settings,
        percent => {
          if (itemGenerationRef.current.get(id) !== myGen) return;
          setFiles(prev =>
            prev.map(f => (f.id === id ? { ...f, progress: percent } : f))
          );
        }
      );

      if (itemGenerationRef.current.get(id) !== myGen) return;
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
    } catch (err: unknown) {
      if (itemGenerationRef.current.get(id) !== myGen) return;
      setFiles(prev =>
        prev.map(f =>
          f.id === id
            ? {
                ...f,
                status: 'error',
                progress: 0,
                errorMessage: err instanceof Error ? err.message : 'Conversion failed',
              }
            : f
        )
      );
    } finally {
      if (inFlightConversionsRef.current.get(id) === myGen) {
        inFlightConversionsRef.current.delete(id);
      }
      if (!batchRunningRef.current && inFlightConversionsRef.current.size === 0) {
        setIsConvertingAny(false);
      }
    }
  };

  const handleConvertAll = async () => {
    batchRunningRef.current = true;
    setIsConvertingAny(true);
    try {
      const pendingItems = filesRef.current.filter(
        f => (f.status === 'idle' || f.status === 'error') && isItemConvertible(f)
      );
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
    } finally {
      batchRunningRef.current = false;
      if (inFlightConversionsRef.current.size === 0) {
        setIsConvertingAny(false);
      }
    }
  };

  const handleDownloadAllZip = async () => {
    const completedItems = files.filter(f => f.status === 'completed' && f.resultBlob);
    
    if (completedItems.length === 0) return;

    const getCleanName = (item: FileItem) => {
      if (item.resultFileName) return item.resultFileName;
      const dotIdx = item.name.lastIndexOf('.');
      const baseName = dotIdx > 0 ? item.name.substring(0, dotIdx) : item.name;
      return `${baseName}.${item.targetFormat}`;
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
      downloadBlob(zipBlob, zipFileName);
    } catch {
      setQueueError('Failed to create ZIP archive.');
    }
  };

  const handleMergeToPdf = async () => {
    if (isConvertingAny || isMergingPdf || files.length === 0) return;
    setQueueError(null);
    const imageFiles = files
      .filter(f => f.size > 0 && f.size <= MAX_CONVERTER_FILE_SIZE && isImageSourceExt(f.sourceExt))
      .map(f => f.file);
    if (imageFiles.length === 0) {
      setQueueError('No valid images in queue to merge.');
      return;
    }
    setIsMergingPdf(true);
    try {
      const res = await mergeImagesToPdf(imageFiles, 'combined_document.pdf');
      downloadBlob(res.blob, res.fileName);
    } catch (err: unknown) {
      setQueueError(`Merge failed: ${err instanceof Error ? err.message : 'Merge error'}`);
    } finally {
      setIsMergingPdf(false);
    }
  };

  const batchAllowedTargets = useMemo(() => {
    const valid = files.filter(isItemConvertible);
    if (valid.length === 0) return [];
    let common = getCompatibleTargets(valid[0].sourceExt).map(f => f.ext);
    for (let i = 1; i < valid.length; i++) {
      const allowedSet = new Set(getCompatibleTargets(valid[i].sourceExt).map(f => f.ext));
      common = common.filter(ext => allowedSet.has(ext));
    }
    return common;
  }, [files]);

  const activeFormatFile = files.find(f => f.id === activeFormatFileId);
  const activeSettingsFile = files.find(f => f.id === activeSettingsFileId);

  return {
    files,
    setFiles,
    isConvertingAny,
    isMergingPdf,
    queueError,
    setQueueError,
    batchAllowedTargets,
    activePreset,
    setActivePreset,
    activeFormatFileId,
    setActiveFormatFileId,
    activeSettingsFileId,
    setActiveSettingsFileId,
    isBatchSettingsOpen,
    setIsBatchSettingsOpen,
    isBatchFormatOpen,
    setIsBatchFormatOpen,
    isGlobalDragging,
    setIsGlobalDragging,
    handleFilesAdded,
    handleSelectFormat,
    handleSelectAllFormat,
    handleSaveSettings,
    handleRemoveFile,
    handleClearAll,
    handleConvertSingle,
    handleConvertAll,
    handleDownloadAllZip,
    handleMergeToPdf,
    heroSourceFormat,
    setHeroSourceFormat,
    heroTargetFormat,
    setHeroTargetFormat,
    handleSelectHeroSource,
    handleSelectHeroTarget,
    handleSwapHeroFormats,
    activeFormatFile,
    activeSettingsFile,
  };
}
