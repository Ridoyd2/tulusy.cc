import { FormatOption } from '../types';

export const ALL_FORMATS: FormatOption[] = [
  // Images
  {
    ext: 'webp',
    name: 'WebP Image',
    category: 'image',
    mime: 'image/webp',
    description: 'Modern, highly compressed web format with transparency & animation support.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'png',
    name: 'PNG (Portable Network Graphics)',
    category: 'image',
    mime: 'image/png',
    description: 'Lossless raster image with crystal clear alpha transparency.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'jpg',
    name: 'JPG / JPEG Image',
    category: 'image',
    mime: 'image/jpeg',
    description: 'Universal standard photo format with high compression efficiency.',
    popular: true,
    lossless: false,
  },
  {
    ext: 'avif',
    name: 'AVIF Next-Gen Image',
    category: 'image',
    mime: 'image/avif',
    description: 'Next-generation image compression offering 50% smaller sizes than JPEG.',
    popular: true,
    lossless: false,
  },
  {
    ext: 'svg',
    name: 'SVG Vector Graphic',
    category: 'vector',
    mime: 'image/svg+xml',
    description: 'Scalable SVG vector input rasterization and embedded SVG container export.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'ico',
    name: 'ICO Windows Icon / Favicon',
    category: 'icon',
    mime: 'image/x-icon',
    description: 'Multi-resolution icon format optimized for web favicons and desktop apps.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'bmp',
    name: 'BMP Bitmap Image',
    category: 'image',
    mime: 'image/bmp',
    description: 'Uncompressed raw raster image format preserving pure pixel fidelity.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'tiff',
    name: 'TIFF High-Res Image',
    category: 'image',
    mime: 'image/tiff',
    description: 'Professional high-depth image container for publishing and photography.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'gif',
    name: 'GIF Animated Graphic',
    category: 'image',
    mime: 'image/gif',
    description: 'Standard 8-bit palette format with multi-frame animation support.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'heic',
    name: 'HEIC Apple High Efficiency',
    category: 'image',
    mime: 'image/heic',
    description: 'Apple iOS camera format delivering high quality with reduced storage.',
    popular: true,
    lossless: false,
  },
  {
    ext: 'psd',
    name: 'PSD Adobe Photoshop',
    category: 'image',
    mime: 'image/vnd.adobe.photoshop',
    description: 'Layered Adobe Photoshop design document format.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'tga',
    name: 'TGA Truevision Graphic',
    category: 'image',
    mime: 'image/x-tga',
    description: 'Raster format widely used in 3D gaming textures and animation.',
    popular: false,
    lossless: true,
  },

  // Documents & Spreadsheets
  {
    ext: 'docx',
    name: 'DOCX Word Document',
    category: 'document',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Editable Microsoft Word document with preserved typography & layouts.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'pptx',
    name: 'PPTX PowerPoint Presentation',
    category: 'document',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    description: 'Editable Microsoft PowerPoint slides with extracted text & media.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'xlsx',
    name: 'XLSX Excel Spreadsheet',
    category: 'document',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Microsoft Excel spreadsheet workbook with structured table data & sheets.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'csv',
    name: 'CSV Delimited Data',
    category: 'document',
    mime: 'text/csv',
    description: 'Universal comma-separated tabular data file for databases & spreadsheets.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'pdf',
    name: 'PDF Portable Document',
    category: 'document',
    mime: 'application/pdf',
    description: 'Universal read-only standard document format suitable for print & viewing.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'txt',
    name: 'TXT Plain Text',
    category: 'document',
    mime: 'text/plain',
    description: 'Simple unformatted UTF-8 text file.',
    popular: false,
    lossless: true,
  }
];

export const FORMAT_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  heif: 'heic',
  tif: 'tiff',
};

export function normalizeFormatExt(ext: string): string {
  const clean = ext.toLowerCase().replace('.', '').trim();
  return FORMAT_ALIASES[clean] || clean;
}

const ACCEPT_BY_FORMAT: Record<string, string> = {
  png: '.png,image/png',
  jpg: '.jpg,.jpeg,image/jpeg',
  webp: '.webp,image/webp',
  avif: '.avif,image/avif',
  svg: '.svg,image/svg+xml',
  ico: '.ico,image/x-icon',
  bmp: '.bmp,image/bmp',
  tiff: '.tiff,.tif,image/tiff',
  gif: '.gif,image/gif',
  heic: '.heic,.heif,image/heic,image/heif',
  psd: '.psd,image/vnd.adobe.photoshop',
  tga: '.tga,image/x-tga',
  pdf: '.pdf,application/pdf',
  docx: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: '.csv,text/csv',
  txt: '.txt,text/plain',
};

export function getAcceptForFormat(ext: string): string {
  const norm = normalizeFormatExt(ext);
  return ACCEPT_BY_FORMAT[norm] || `.${norm}`;
}

export const DEFAULT_TARGET_FORMATS: Record<string, string> = {
  // Image mappings
  png: 'webp',
  jpg: 'webp',
  jpeg: 'webp',
  webp: 'png',
  avif: 'jpg',
  svg: 'png',
  ico: 'png',
  bmp: 'png',
  tiff: 'jpg',
  tif: 'jpg',
  gif: 'webp',
  heic: 'jpg',
  heif: 'jpg',
  psd: 'png',
  tga: 'png',

  // Document & Spreadsheet mappings
  pdf: 'docx', // Default for PDF is editable Word
  docx: 'pdf',
  pptx: 'pdf',
  xlsx: 'pdf',
  csv: 'xlsx',
  txt: 'pdf',
};

export function getCompatibleTargets(sourceExt: string): FormatOption[] {
  const ext = normalizeFormatExt(sourceExt);

  if (['png', 'jpg', 'webp', 'avif', 'bmp', 'tiff', 'gif', 'heic', 'psd', 'tga', 'svg', 'ico'].includes(ext)) {
    // Images convert to any other supported output image, vector, icon, or PDF (PSD is input-only)
    return ALL_FORMATS.filter(
      f => f.ext !== ext && f.ext !== 'psd' && (['image', 'vector', 'icon'].includes(f.category) || f.ext === 'pdf')
    );
  }

  if (ext === 'pdf') {
    // PDF can convert to DOCX, PPTX, XLSX, CSV, TXT, or output Image formats (PSD is input-only)
    return ALL_FORMATS.filter(f => f.ext !== 'pdf' && f.ext !== 'psd');
  }

  if (ext === 'xlsx') {
    // Excel converts to PDF or CSV
    return ALL_FORMATS.filter(f => f.ext === 'pdf' || f.ext === 'csv');
  }

  if (ext === 'csv') {
    // CSV converts to XLSX or PDF
    return ALL_FORMATS.filter(f => f.ext === 'xlsx' || f.ext === 'pdf');
  }

  if (['docx', 'pptx'].includes(ext)) {
    // Word and PowerPoint documents convert to PDF or TXT
    return ALL_FORMATS.filter(f => f.ext === 'pdf' || f.ext === 'txt');
  }

  if (ext === 'txt') {
    // Plain text converts to PDF
    return ALL_FORMATS.filter(f => f.ext === 'pdf');
  }

  if (['doc', 'ppt', 'xls'].includes(ext)) {
    return [];
  }

  return [];
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/x-tga': 'tga',
  'image/vnd.adobe.photoshop': 'psd',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export function inferFormatFromMime(mime?: string): string {
  const clean = (mime || '').split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[clean] || '';
}

const IMAGE_SOURCE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'tiff', 'tif', 'gif', 'heic', 'heif', 'psd', 'tga', 'svg', 'ico',
]);
const PURE_DOC_TARGETS = new Set(['docx', 'pptx', 'xlsx', 'csv', 'txt']);

export function supportsImageParameters(sourceExt: string, targetExt?: string): boolean {
  const src = normalizeFormatExt(sourceExt);
  const tgt = targetExt ? normalizeFormatExt(targetExt) : '';
  if (IMAGE_SOURCE_EXTS.has(src)) return true;
  if (src === 'pdf' && tgt && !PURE_DOC_TARGETS.has(tgt) && tgt !== 'pdf') return true;
  return false;
}
