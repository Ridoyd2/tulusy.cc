import { FormatOption } from '../types';

export const ALL_FORMATS: FormatOption[] = [
  // Standard & Next-Gen Images
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
    ext: 'jxl',
    name: 'JXL (JPEG XL) Next-Gen Image',
    category: 'image',
    mime: 'image/jxl',
    description: 'Ultra-efficient next-gen raster format with lossless JPEG recompression and HDR.',
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
    ext: 'icns',
    name: 'ICNS macOS App Icon',
    category: 'icon',
    mime: 'image/icns',
    description: 'Apple macOS icon bundle storing multi-resolution Retina app icons.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'cur',
    name: 'CUR Windows Cursor',
    category: 'icon',
    mime: 'image/x-icon',
    description: 'Windows static pointer cursor image format (input conversion).',
    popular: false,
    lossless: true,
  },
  {
    ext: 'jp2',
    name: 'JP2 (JPEG 2000) Image',
    category: 'image',
    mime: 'image/jp2',
    description: 'Wavelet-compressed archival and medical/GIS high-precision image format.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'qoi',
    name: 'QOI (Quite OK Image)',
    category: 'image',
    mime: 'image/qoi',
    description: 'Ultra-fast lossless RGB/RGBA image format built for real-time pipelines.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'dds',
    name: 'DDS DirectDraw Surface',
    category: 'image',
    mime: 'image/vnd-ms.dds',
    description: 'GPU-friendly texture container used in 3D rendering and game engines.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'ppm',
    name: 'PPM Netpbm Pixmap',
    category: 'image',
    mime: 'image/x-portable-pixmap',
    description: 'Portable uncompressed RGB pixel map for cross-platform imaging tools.',
    popular: false,
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

  // Camera RAW Models (Input-only)
  {
    ext: 'cr2',
    name: 'CR2 Canon RAW 2',
    category: 'raw',
    mime: 'image/x-canon-cr2',
    description: 'Uncompressed Canon EOS DSLR sensor RAW photograph.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'cr3',
    name: 'CR3 Canon RAW 3',
    category: 'raw',
    mime: 'image/x-canon-cr3',
    description: 'Modern Canon EOS R mirrorless camera RAW image format.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'nef',
    name: 'NEF Nikon Electronic Format',
    category: 'raw',
    mime: 'image/x-nikon-nef',
    description: 'Nikon DSLR and Z-series mirrorless camera RAW sensor file.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'arw',
    name: 'ARW Sony Alpha RAW',
    category: 'raw',
    mime: 'image/x-sony-arw',
    description: 'Sony Alpha mirrorless camera uncompressed RAW image.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'dng',
    name: 'DNG Adobe Digital Negative',
    category: 'raw',
    mime: 'image/x-adobe-dng',
    description: 'Open archival camera RAW format used by smartphones, Leica, and Lightroom.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'raf',
    name: 'RAF Fujifilm RAW',
    category: 'raw',
    mime: 'image/x-fuji-raf',
    description: 'Fujifilm X-Trans / GFX camera sensor RAW photograph.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'orf',
    name: 'ORF Olympus / OM System RAW',
    category: 'raw',
    mime: 'image/x-olympus-orf',
    description: 'Olympus and OM System Micro Four Thirds RAW image.',
    popular: false,
    lossless: true,
  },
  {
    ext: 'rw2',
    name: 'RW2 Panasonic LUMIX RAW',
    category: 'raw',
    mime: 'image/x-panasonic-rw2',
    description: 'Panasonic LUMIX digital camera RAW sensor capture.',
    popular: false,
    lossless: true,
  },

  // Documents, Markup & E-Books
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
    ext: 'pdf',
    name: 'PDF Portable Document',
    category: 'document',
    mime: 'application/pdf',
    description: 'Universal read-only standard document format suitable for print & viewing.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'md',
    name: 'MD Markdown Document',
    category: 'document',
    mime: 'text/markdown',
    description: 'Lightweight formatted Markdown text for docs, READMEs, and publishing.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'html',
    name: 'HTML Web Document',
    category: 'document',
    mime: 'text/html',
    description: 'Standalone semantic HTML5 document ready for browsers and PDF export.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'epub',
    name: 'EPUB E-Book',
    category: 'document',
    mime: 'application/epub+zip',
    description: 'Open digital e-book standard supported by Kindle, Apple Books, and Kobo.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'rtf',
    name: 'RTF Rich Text Format',
    category: 'document',
    mime: 'application/rtf',
    description: 'Cross-platform rich text document format (input conversion).',
    popular: false,
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
  },

  // Structured Data & Tabular Formats
  {
    ext: 'csv',
    name: 'CSV Delimited Data',
    category: 'data',
    mime: 'text/csv',
    description: 'Universal comma-separated tabular data file for databases & spreadsheets.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'json',
    name: 'JSON Structured Data',
    category: 'data',
    mime: 'application/json',
    description: 'Standard JavaScript Object Notation format for APIs and configs.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'yaml',
    name: 'YAML Configuration Data',
    category: 'data',
    mime: 'application/yaml',
    description: 'Human-readable structured configuration and serialization format.',
    popular: true,
    lossless: true,
  },
  {
    ext: 'xml',
    name: 'XML Structured Markup',
    category: 'data',
    mime: 'application/xml',
    description: 'Extensible Markup Language for structured data exchange and feeds.',
    popular: false,
    lossless: true,
  },
];

export const FORMAT_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  heif: 'heic',
  tif: 'tiff',
  j2k: 'jp2',
  yml: 'yaml',
  htm: 'html',
  markdown: 'md',
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
  jxl: '.jxl,image/jxl',
  jp2: '.jp2,.j2k,image/jp2',
  qoi: '.qoi,image/qoi',
  dds: '.dds,image/vnd-ms.dds',
  ppm: '.ppm,image/x-portable-pixmap',
  svg: '.svg,image/svg+xml',
  ico: '.ico,image/x-icon',
  icns: '.icns,image/icns',
  cur: '.cur,image/x-icon',
  bmp: '.bmp,image/bmp',
  tiff: '.tiff,.tif,image/tiff',
  gif: '.gif,image/gif',
  heic: '.heic,.heif,image/heic,image/heif',
  psd: '.psd,image/vnd.adobe.photoshop',
  tga: '.tga,image/x-tga',
  cr2: '.cr2,image/x-canon-cr2',
  cr3: '.cr3,image/x-canon-cr3',
  nef: '.nef,image/x-nikon-nef',
  arw: '.arw,image/x-sony-arw',
  dng: '.dng,image/x-adobe-dng',
  raf: '.raf,image/x-fuji-raf',
  orf: '.orf,image/x-olympus-orf',
  rw2: '.rw2,image/x-panasonic-rw2',
  pdf: '.pdf,application/pdf',
  docx: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: '.csv,text/csv',
  txt: '.txt,text/plain',
  md: '.md,.markdown,text/markdown',
  html: '.html,.htm,text/html',
  rtf: '.rtf,application/rtf',
  epub: '.epub,application/epub+zip',
  json: '.json,application/json',
  yaml: '.yaml,.yml,application/yaml',
  xml: '.xml,application/xml,text/xml',
};

export function getAcceptForFormat(ext: string): string {
  const norm = normalizeFormatExt(ext);
  return ACCEPT_BY_FORMAT[norm] || `.${norm}`;
}

export const ALL_IMAGE_ACCEPT =
  'image/*,.heic,.heif,.psd,.tga,.jxl,.jp2,.j2k,.qoi,.dds,.icns,.ppm,.cur,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2';

export const DEFAULT_TARGET_FORMATS: Record<string, string> = {
  // Image & RAW mappings
  png: 'webp',
  jpg: 'webp',
  jpeg: 'webp',
  webp: 'png',
  avif: 'jpg',
  jxl: 'webp',
  jp2: 'png',
  j2k: 'png',
  qoi: 'png',
  dds: 'png',
  ppm: 'png',
  svg: 'png',
  ico: 'png',
  icns: 'png',
  cur: 'png',
  bmp: 'png',
  tiff: 'jpg',
  tif: 'jpg',
  gif: 'webp',
  heic: 'jpg',
  heif: 'jpg',
  psd: 'png',
  tga: 'png',
  cr2: 'jpg',
  cr3: 'jpg',
  nef: 'jpg',
  arw: 'jpg',
  dng: 'jpg',
  raf: 'jpg',
  orf: 'jpg',
  rw2: 'jpg',

  // Document, Markup & Data mappings
  pdf: 'docx',
  docx: 'pdf',
  pptx: 'pdf',
  xlsx: 'pdf',
  csv: 'xlsx',
  txt: 'pdf',
  md: 'pdf',
  markdown: 'pdf',
  html: 'pdf',
  htm: 'pdf',
  rtf: 'pdf',
  epub: 'pdf',
  json: 'yaml',
  yaml: 'json',
  yml: 'json',
  xml: 'json',
};

export const INPUT_ONLY_IMAGE_EXTS = new Set([
  'psd', 'cur', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2',
]);

export const INPUT_ONLY_TARGET_EXTS = new Set([
  ...INPUT_ONLY_IMAGE_EXTS,
  'rtf',
]);

const IMAGE_SOURCE_EXTS = new Set(
  ALL_FORMATS
    .filter(f => ['image', 'raw', 'vector', 'icon'].includes(f.category))
    .map(f => f.ext)
);

export function isImageSourceExt(ext: string): boolean {
  return IMAGE_SOURCE_EXTS.has(normalizeFormatExt(ext));
}

const MARKUP_TARGETS_BY_SOURCE: Record<string, string[]> = {
  md: ['html', 'pdf', 'docx', 'epub', 'txt'],
  html: ['md', 'pdf', 'docx', 'epub', 'txt'],
  rtf: ['txt', 'pdf', 'docx', 'html', 'md', 'epub'],
  epub: ['txt', 'html', 'md', 'pdf', 'docx'],
};

const DATA_EXTS = new Set(['json', 'yaml', 'xml']);
const DATA_TARGETS = ['json', 'yaml', 'xml', 'csv', 'xlsx', 'pdf', 'txt'];

export function getCompatibleTargets(sourceExt: string): FormatOption[] {
  const ext = normalizeFormatExt(sourceExt);

  if (IMAGE_SOURCE_EXTS.has(ext)) {
    return ALL_FORMATS.filter(
      f =>
        f.ext !== ext &&
        !INPUT_ONLY_IMAGE_EXTS.has(f.ext) &&
        (['image', 'vector', 'icon'].includes(f.category) || f.ext === 'pdf')
    );
  }

  if (ext === 'pdf') {
    const pdfTargets = new Set([
      'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'html', 'epub',
      ...ALL_FORMATS.filter(
        f => !INPUT_ONLY_IMAGE_EXTS.has(f.ext) && ['image', 'vector', 'icon'].includes(f.category)
      ).map(f => f.ext),
    ]);
    return ALL_FORMATS.filter(f => pdfTargets.has(f.ext));
  }

  if (ext === 'xlsx') {
    const allowed = new Set(['pdf', 'csv', 'json', 'yaml', 'xml']);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (ext === 'csv') {
    const allowed = new Set(['xlsx', 'pdf', 'json', 'yaml', 'xml']);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (ext === 'docx') {
    const allowed = new Set(['pdf', 'txt', 'html', 'md', 'epub']);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (ext === 'pptx') {
    const allowed = new Set(['pdf', 'txt']);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (ext === 'txt') {
    const allowed = new Set(['pdf', 'html', 'md', 'epub']);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (MARKUP_TARGETS_BY_SOURCE[ext]) {
    const allowed = new Set(MARKUP_TARGETS_BY_SOURCE[ext]);
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
  }

  if (DATA_EXTS.has(ext)) {
    const allowed = new Set(DATA_TARGETS.filter(t => t !== ext));
    return ALL_FORMATS.filter(f => allowed.has(f.ext));
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
  'image/jxl': 'jxl',
  'image/jp2': 'jp2',
  'image/qoi': 'qoi',
  'image/vnd-ms.dds': 'dds',
  'image/icns': 'icns',
  'image/x-portable-pixmap': 'ppm',
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
  'image/x-canon-cr2': 'cr2',
  'image/x-canon-cr3': 'cr3',
  'image/x-nikon-nef': 'nef',
  'image/x-sony-arw': 'arw',
  'image/x-adobe-dng': 'dng',
  'image/x-fuji-raf': 'raf',
  'image/x-olympus-orf': 'orf',
  'image/x-panasonic-rw2': 'rw2',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/epub+zip': 'epub',
  'application/json': 'json',
  'application/yaml': 'yaml',
  'text/yaml': 'yaml',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export function inferFormatFromMime(mime?: string): string {
  const clean = (mime || '').split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[clean] || '';
}

const PURE_DOC_DATA_TARGETS = new Set([
  'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'html', 'rtf', 'epub', 'json', 'yaml', 'xml',
]);

export function supportsImageParameters(sourceExt: string, targetExt?: string): boolean {
  const src = normalizeFormatExt(sourceExt);
  const tgt = targetExt ? normalizeFormatExt(targetExt) : '';
  if (IMAGE_SOURCE_EXTS.has(src)) return true;
  if (src === 'pdf' && tgt && !PURE_DOC_DATA_TARGETS.has(tgt) && tgt !== 'pdf') return true;
  return false;
}
