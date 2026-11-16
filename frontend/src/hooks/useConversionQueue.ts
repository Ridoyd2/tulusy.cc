import { useState, useCallback, useEffect, useRef } from 'react';
import { FileItem, ConversionSettings } from '../types';
import { DEFAULT_TARGET_FORMATS, getCompatibleTargets, ALL_FORMATS } from '../lib/formatRegistry';
import { convertSingleFile, mergeImagesToPdf, downloadBlob } from '../lib/api';

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
  const [activePreset, setActivePreset] = useState<{ target: string; label: string; accept?: string } | null>(null);
  const [heroSourceFormat, setHeroSourceFormat] = useState<string>(initialSource);
  const [heroTargetFormat, setHeroTargetFormat] = useState<string>(initialTarget);
  
  const [activeFormatFileId, setActiveFormatFileId] = useState<string | null>(null);
  const [activeSettingsFileId, setActiveSettingsFileId] = useState<string | null>(null);
  const [isBatchSettingsOpen, setIsBatchSettingsOpen] = useState(false);
  const [isBatchFormatOpen, setIsBatchFormatOpen] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleSelectHeroSource = useCallback((newSource: string) => {
    const cleanSrc = newSource.toLowerCase().replace('.', '');
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
    const cleanTgt = newTarget.toLowerCase().replace('.', '');
    setHeroTargetFormat(cleanTgt);
    setActivePreset(null);
    setFiles(prev =>
      prev.map(item => {
        const compatible = getCompatibleTargets(item.sourceExt);
        if (item.status === 'idle' && compatible.some(f => f.ext === cleanTgt)) {
          return { ...item, targetFormat: cleanTgt };
        }
        return item;
      })
    );
  }, []);

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
          return { ...item, targetFormat: nextTarget };
        }
        return item;
      })
    );
  }, [heroSourceFormat, heroTargetFormat]);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const newItems: FileItem[] = newFiles.map(file => {
      const dotIdx = file.name.lastIndexOf('.');
      const ext = dotIdx > 0 ? file.name.substring(dotIdx + 1).toLowerCase() : '';
      const isImg = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'tiff', 'gif', 'heic', 'ico', 'svg'].includes(ext);
      
      const compatible = ext ? getCompatibleTargets(ext) : ALL_FORMATS;
      const canUseHeroTarget = compatible.some(f => f.ext === heroTargetFormat);
      const targetFmt = lockTargetToInitial
        ? initialTarget
        : activePreset?.target ||
          (canUseHeroTarget ? heroTargetFormat : DEFAULT_TARGET_FORMATS[ext]) ||
          'webp';

      return {
        id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        file,
        name: file.name,
        size: file.size,
        sourceExt: ext || defaultSourceExt || 'bin',
        targetFormat: targetFmt,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
        status: 'idle',
        progress: 0,
        settings: { ...DEFAULT_CONVERSION_SETTINGS },
      };
    });

    if (newItems.length > 0 && filesRef.current.length === 0) {
      const firstExt = newItems[0].sourceExt;
      if (ALL_FORMATS.some(f => f.ext === firstExt)) {
        setHeroSourceFormat(firstExt);
        setHeroTargetFormat(newItems[0].targetFormat);
      }
    }

    setFiles(prev => [...prev, ...newItems]);
    setActivePreset(null);
    dragCounterRef.current = 0;
    setIsGlobalDragging(false);
  }, [activePreset, heroTargetFormat, defaultSourceExt, initialTarget, lockTargetToInitial]);

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

  const handleSelectAllFormat = useCallback((formatExt: string) => {
    const cleanFmt = formatExt.toLowerCase().replace('.', '');
    setHeroTargetFormat(cleanFmt);
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
  }, []);

  const handleSaveSettings = useCallback((newSettings: ConversionSettings, applyToAll: boolean = false) => {
    if (applyToAll || isBatchSettingsOpen) {
      setFiles(prev =>
        prev.map(item => ({
          ...item,
          settings: { ...newSettings },
          status: 'idle',
          progress: 0,
          resultBlob: undefined,
          resultFileName: undefined,
          errorMessage: undefined,
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
  }, [activeSettingsFileId, isBatchSettingsOpen]);

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

    // Use capture phase so window reliably intercepts drop & dragleave
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
    if (!targetItem) return;

    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, status: 'converting', progress: 10, errorMessage: undefined } : f))
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
    } catch (err: unknown) {
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
      alert("Failed to create ZIP archive.");
    }
  };

  const handleMergeToPdf = async () => {
    const imageFiles = files.map(f => f.file);
    setIsConvertingAny(true);
    try {
      const res = await mergeImagesToPdf(imageFiles, 'combined_document.pdf');
      downloadBlob(res.blob, res.fileName);
    } catch (err: unknown) {
      alert(`Merge failed: ${err instanceof Error ? err.message : 'Merge error'}`);
    } finally {
      setIsConvertingAny(false);
    }
  };

  const activeFormatFile = files.find(f => f.id === activeFormatFileId);
  const activeSettingsFile = files.find(f => f.id === activeSettingsFileId);

  return {
    files,
    setFiles,
    isConvertingAny,
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
