export type FormatCategory = 'image' | 'document' | 'vector' | 'icon';

export interface FormatOption {
  ext: string;
  name: string;
  category: FormatCategory;
  mime: string;
  description: string;
  lossless?: boolean;
  popular?: boolean;
  iconName?: string;
}

export interface ConversionSettings {
  quality: number; // 1 - 100
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
  dpi: number;
  grayscale: boolean;
  bgColor: string;
}

export type FileStatus = 'idle' | 'converting' | 'completed' | 'error';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  sourceExt: string;
  targetFormat: string;
  previewUrl?: string;
  status: FileStatus;
  progress: number;
  resultBlob?: Blob;
  downloadUrl?: string;
  resultFileName?: string;
  errorMessage?: string;
  settings: ConversionSettings;
}
