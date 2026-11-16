import { ALL_FORMATS, getCompatibleTargets } from './formatRegistry';

export interface FormatPairSEO {
  slug: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  title: string;
  description: string;
  keywords: string[];
  accept: string;
  faqs: { q: string; a: string }[];
  sourceSpecs: {
    developer: string;
    type: string;
    mime: string;
    compression: string;
    pros: string[];
  };
  targetSpecs: {
    developer: string;
    type: string;
    mime: string;
    compression: string;
    pros: string[];
  };
}

// Popular primary SEO format pairs
export const POPULAR_SEO_PAIRS: FormatPairSEO[] = [
  {
    slug: 'pdf-to-docx',
    source: 'pdf',
    target: 'docx',
    sourceName: 'PDF (Portable Document Format)',
    targetName: 'DOCX (Microsoft Word Document)',
    title: 'Convert PDF to Word (DOCX) Online - 100% Free & Accurate',
    description: 'Convert PDF documents to editable Microsoft Word (DOCX) files online for free. Preserves formatting, tables, fonts, and images with zero file storage.',
    keywords: ['pdf to word', 'convert pdf to docx', 'free pdf to word converter', 'pdf to editable docx', 'online pdf converter'],
    accept: '.pdf,application/pdf',
    faqs: [
      {
        q: 'How do I convert a PDF to an editable Word document for free?',
        a: 'Drag and drop your PDF file into the upload box above, verify DOCX is selected as your target format, and click "Convert". Your editable Word file will be ready in seconds.'
      },
      {
        q: 'Will my formatting, fonts, and tables be preserved?',
        a: 'Yes. Our conversion engine analyzes paragraphs, tables, typography, and page boundaries to generate a cleanly formatted, fully editable DOCX file.'
      },
      {
        q: 'Is it safe to convert confidential or personal PDFs here?',
        a: 'Absolutely. Tulusy processes your files securely and immediately purges them from memory and disk right after your download. We never store or read your documents.'
      },
      {
        q: 'Do I need Microsoft Office installed on my computer?',
        a: 'No. The conversion is performed on our cloud server. You can open the resulting .docx file in Microsoft Word, Google Docs, Apple Pages, or LibreOffice.'
      }
    ],
    sourceSpecs: {
      developer: 'Adobe Systems / ISO',
      type: 'Fixed-layout document',
      mime: 'application/pdf',
      compression: 'Lossless / Deflate',
      pros: ['Consistent visual rendering across all devices', 'Standard for printing & legal documents', 'High security and digital signing']
    },
    targetSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Editable word processing document',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'ZIP-compressed XML',
      pros: ['Fully editable text and layout', 'Collaborative editing in Google Docs/Word', 'Extensive styling and typography controls']
    }
  },
  {
    slug: 'png-to-webp',
    source: 'png',
    target: 'webp',
    sourceName: 'PNG (Portable Network Graphics)',
    targetName: 'WebP Image',
    title: 'Convert PNG to WebP Online - Reduce Image Size by 80%',
    description: 'Convert PNG images to modern WebP format online for free. Retains alpha transparency and crystal clarity with up to 80% smaller file size for faster websites.',
    keywords: ['png to webp', 'convert png to webp', 'free png to webp converter', 'image compressor', 'webp converter online'],
    accept: 'image/png,image/*',
    faqs: [
      {
        q: 'Why should I convert PNG to WebP?',
        a: 'WebP provides superior lossless and lossy compression for web images. Converting PNG to WebP typically reduces file size by 30% to 80% without visible quality loss, speeding up your website loading times.'
      },
      {
        q: 'Does WebP support transparent backgrounds like PNG?',
        a: 'Yes. WebP fully supports 8-bit alpha channel transparency just like PNG, but at a fraction of the file size.'
      },
      {
        q: 'Are WebP images supported in all modern web browsers?',
        a: 'Yes. WebP is supported by 97%+ of all browsers worldwide, including Google Chrome, Apple Safari, Mozilla Firefox, and Microsoft Edge.'
      }
    ],
    sourceSpecs: {
      developer: 'PNG Development Group',
      type: 'Lossless raster image',
      mime: 'image/png',
      compression: 'DEFLATE lossless',
      pros: ['Crisp pixel fidelity', 'Full alpha transparency', 'Universal legacy support']
    },
    targetSpecs: {
      developer: 'Google LLC',
      type: 'Next-gen web raster image',
      mime: 'image/webp',
      compression: 'VP8 / VP8L predictive compression',
      pros: ['30-80% smaller file size than PNG', 'Lossy & Lossless transparency', 'Faster page speed and higher SEO scores']
    }
  },
  {
    slug: 'heic-to-jpg',
    source: 'heic',
    target: 'jpg',
    sourceName: 'HEIC (High Efficiency Image Container)',
    targetName: 'JPG / JPEG Image',
    title: 'Convert HEIC to JPG Online - Apple Photos to Universal JPEG',
    description: 'Convert iPhone and iPad HEIC photos to universal JPG format online for free. Batch convert multiple Apple photos instantly with zero quality loss.',
    keywords: ['heic to jpg', 'convert heic to jpg', 'iphone photo to jpg', 'heic converter online', 'free heic to jpeg'],
    accept: '.heic,.heif,image/heic,image/heif',
    faqs: [
      {
        q: 'Why won\'t my iPhone HEIC photos open on Windows or Android?',
        a: 'HEIC is Apple\'s proprietary photo container. Many Windows computers, older Android devices, and websites cannot display HEIC files natively. Converting to JPG makes your photos universally viewable.'
      },
      {
        q: 'Will converting HEIC to JPG lower the image quality?',
        a: 'No. Tulusy uses high-fidelity 90%+ JPEG quantization, preserving your photo resolution, colors, and camera metadata.'
      },
      {
        q: 'Can I batch convert hundreds of iPhone photos at once?',
        a: 'Yes! Simply select or drag multiple HEIC photos into the upload box and click "Convert All".'
      }
    ],
    sourceSpecs: {
      developer: 'MPEG / Apple Inc.',
      type: 'High-efficiency photo container',
      mime: 'image/heic',
      compression: 'HEVC / H.265 compression',
      pros: ['50% smaller size on iPhone storage', 'Stores 16-bit color and depth maps', 'Live Photos container support']
    },
    targetSpecs: {
      developer: 'Joint Photographic Experts Group',
      type: 'Standard raster photograph',
      mime: 'image/jpeg',
      compression: 'Discrete Cosine Transform (DCT)',
      pros: ['100% universal compatibility on all devices', 'Supported everywhere on the web', 'Instant social media uploading']
    }
  },
  {
    slug: 'pdf-to-pptx',
    source: 'pdf',
    target: 'pptx',
    sourceName: 'PDF Document',
    targetName: 'PPTX (PowerPoint Presentation)',
    title: 'Convert PDF to PowerPoint (PPTX) Online - Free Presentation Converter',
    description: 'Convert PDF documents into editable Microsoft PowerPoint (PPTX) presentation slides. Extracts vector text, slide layouts, and media effortlessly.',
    keywords: ['pdf to pptx', 'convert pdf to powerpoint', 'pdf to presentation', 'free pdf to slides', 'online pdf to pptx'],
    accept: '.pdf,application/pdf',
    faqs: [
      {
        q: 'How does PDF to PowerPoint conversion work?',
        a: 'Each page of your PDF is converted into a distinct PowerPoint slide. High-resolution visuals and text blocks are extracted so you can present or customize your slides immediately.'
      },
      {
        q: 'Can I edit the text in PowerPoint after conversion?',
        a: 'Yes. Text blocks from the original PDF are mapped into editable PowerPoint text boxes with matching coordinates and font sizes.'
      }
    ],
    sourceSpecs: {
      developer: 'Adobe Systems / ISO',
      type: 'Fixed-layout document',
      mime: 'application/pdf',
      compression: 'Lossless',
      pros: ['Preserves exact design', 'Universal viewing format', 'Compact file size']
    },
    targetSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Presentation slide deck',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'ZIP-compressed XML',
      pros: ['Customizable slide transitions & animations', 'Editable presentation slides', 'Presenter view & notes support']
    }
  },
  {
    slug: 'excel-to-pdf',
    source: 'xlsx',
    target: 'pdf',
    sourceName: 'Excel Spreadsheet (XLSX)',
    targetName: 'PDF Document',
    title: 'Convert Excel to PDF Online - Free XLSX to Tabular PDF',
    description: 'Convert Microsoft Excel (.xlsx, .xls) workbooks into clean, printable landscape PDF tables. Preserves headers, cell values, and multi-sheet layouts.',
    keywords: ['excel to pdf', 'convert xlsx to pdf', 'spreadsheet to pdf', 'free excel to pdf converter', 'online xlsx to pdf'],
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    faqs: [
      {
        q: 'How are multi-sheet Excel files converted to PDF?',
        a: 'Every worksheet in your Excel workbook is rendered sequentially with custom table headers, gridlines, and alternating row colors in landscape PDF format.'
      },
      {
        q: 'Are large tables with many columns truncated?',
        a: 'Our converter utilizes landscape orientation and auto-sizing columns to fit tabular data neatly onto printable PDF pages.'
      }
    ],
    sourceSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Spreadsheet workbook',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'ZIP-compressed XML',
      pros: ['Formulas & calculation models', 'Multi-tab organization', 'Data filtering and sorting']
    },
    targetSpecs: {
      developer: 'Adobe Systems / ISO',
      type: 'Printable fixed document',
      mime: 'application/pdf',
      compression: 'Lossless',
      pros: ['Read-only data integrity', 'Clean print-ready formatting', 'Viewable on any device without Excel']
    }
  },
  {
    slug: 'pdf-to-excel',
    source: 'pdf',
    target: 'xlsx',
    sourceName: 'PDF Document',
    targetName: 'Excel Spreadsheet (XLSX)',
    title: 'Convert PDF to Excel (XLSX) Online - Extract PDF Tables',
    description: 'Extract tables and structured data from PDF documents into editable Microsoft Excel (.xlsx) spreadsheets online for free.',
    keywords: ['pdf to excel', 'convert pdf to xlsx', 'extract tables from pdf', 'pdf table to spreadsheet', 'free pdf to excel'],
    accept: '.pdf,application/pdf',
    faqs: [
      {
        q: 'Can Tulusy extract invoices and financial tables from PDF into Excel?',
        a: 'Yes. Our engine uses structural table detection to detect rows, columns, and numeric cells from PDF pages and exports them directly into editable Excel cells.'
      }
    ],
    sourceSpecs: {
      developer: 'Adobe Systems / ISO',
      type: 'Fixed document',
      mime: 'application/pdf',
      compression: 'Lossless',
      pros: ['Standard for financial reports and invoices', 'Tamper-resistant layout', 'Universal viewing']
    },
    targetSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Spreadsheet workbook',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'ZIP-compressed XML',
      pros: ['Formulas, sums, and charts', 'Easy data export to accounting software', 'Full cell editing']
    }
  },
  {
    slug: 'csv-to-excel',
    source: 'csv',
    target: 'xlsx',
    sourceName: 'CSV Delimited Data',
    targetName: 'Excel Spreadsheet (XLSX)',
    title: 'Convert CSV to Excel (XLSX) Online - Free Table Formatter',
    description: 'Convert raw CSV data files into styled Microsoft Excel (.xlsx) spreadsheets with styled headers, numeric auto-detection, and optimal column widths.',
    keywords: ['csv to excel', 'convert csv to xlsx', 'csv to spreadsheet', 'format csv into excel', 'free csv to xlsx'],
    accept: '.csv,text/csv',
    faqs: [
      {
        q: 'Why convert CSV to XLSX instead of opening raw CSV?',
        a: 'Raw CSV files lack column width formatting, styling, and cell type definitions. Converting to XLSX creates an organized spreadsheet with blue headers and proper number formatting.'
      }
    ],
    sourceSpecs: {
      developer: 'Open Standard',
      type: 'Comma-separated text',
      mime: 'text/csv',
      compression: 'None',
      pros: ['Lightweight text format', 'Universal database export standard', 'Easily parseable']
    },
    targetSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Spreadsheet workbook',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'ZIP-compressed XML',
      pros: ['Beautiful visual formatting', 'Auto-adjusted column widths', 'Native formula support']
    }
  },
  {
    slug: 'png-to-ico',
    source: 'png',
    target: 'ico',
    sourceName: 'PNG Image',
    targetName: 'ICO Favicon',
    title: 'Convert PNG to ICO Online - Create Website Favicons',
    description: 'Convert PNG logo or graphic into multi-resolution Windows ICO / website favicon format online for free. Supports 16x16, 32x32, 48x48, and 256x256 icons.',
    keywords: ['png to ico', 'convert png to favicon', 'favicon generator', 'png to icon online', 'free ico converter'],
    accept: 'image/png,image/*',
    faqs: [
      {
        q: 'What resolutions are included in the generated ICO file?',
        a: 'Our converter packages multi-layer resolutions (16x16, 32x32, 48x48, 64x64, 128x128, 256x256) inside a single .ico file, making it ideal for website favicons and desktop apps.'
      }
    ],
    sourceSpecs: {
      developer: 'PNG Group',
      type: 'Raster image',
      mime: 'image/png',
      compression: 'Lossless',
      pros: ['High resolution clarity', 'Full alpha transparency']
    },
    targetSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Multi-resolution icon container',
      mime: 'image/x-icon',
      compression: 'Lossless / PNG-in-ICO',
      pros: ['Standard for browser tab favicons', 'Windows taskbar icon support', 'Scales across all screen densities']
    }
  },
  {
    slug: 'jpg-to-webp',
    source: 'jpg',
    target: 'webp',
    sourceName: 'JPG / JPEG Image',
    targetName: 'WebP Image',
    title: 'Convert JPG to WebP Online - Optimize Web Images',
    description: 'Convert JPEG/JPG photographs to lightweight WebP format. Reduce image file size by up to 50% without noticeable quality loss.',
    keywords: ['jpg to webp', 'convert jpeg to webp', 'image size reducer', 'free webp compressor', 'jpg to webp online'],
    accept: 'image/jpeg,image/*',
    faqs: [
      {
        q: 'How much file size do I save converting JPG to WebP?',
        a: 'WebP typically provides 25% to 50% smaller file sizes than equivalent JPG images at the same visual quality index.'
      }
    ],
    sourceSpecs: {
      developer: 'JPEG Group',
      type: 'Lossy photograph',
      mime: 'image/jpeg',
      compression: 'Lossy DCT',
      pros: ['Universal photo standard', 'Low baseline size']
    },
    targetSpecs: {
      developer: 'Google LLC',
      type: 'Modern web image',
      mime: 'image/webp',
      compression: 'VP8 predictive lossy/lossless',
      pros: ['Smaller file size', 'Faster website loading', 'Google PageSpeed score booster']
    }
  },
  {
    slug: 'docx-to-pdf',
    source: 'docx',
    target: 'pdf',
    sourceName: 'DOCX Word Document',
    targetName: 'PDF Document',
    title: 'Convert Word (DOCX) to PDF Online - Free Document Converter',
    description: 'Convert Microsoft Word DOCX documents into standard PDF files online for free. Preserves layout, typography, and page design for printing & sharing.',
    keywords: ['word to pdf', 'convert docx to pdf', 'doc to pdf online', 'free word to pdf converter', 'save docx as pdf'],
    accept: '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    faqs: [
      {
        q: 'Why convert Word documents to PDF before sharing?',
        a: 'Word documents can shift layout and fonts depending on the viewer\'s computer. PDF locks in your exact layout so it appears identically on all devices.'
      }
    ],
    sourceSpecs: {
      developer: 'Microsoft Corporation',
      type: 'Editable document',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'ZIP XML',
      pros: ['Full text editing', 'Rich formatting']
    },
    targetSpecs: {
      developer: 'Adobe Systems / ISO',
      type: 'Fixed document',
      mime: 'application/pdf',
      compression: 'Lossless',
      pros: ['Locked typography & formatting', 'Universal device compatibility', 'Print-ready']
    }
  }
];

const SEO_SLUG_ALIASES: Record<string, string> = {
  'xlsx-to-pdf': 'excel-to-pdf',
  'pdf-to-xlsx': 'pdf-to-excel',
  'csv-to-xlsx': 'csv-to-excel',
  'word-to-pdf': 'docx-to-pdf',
  'pdf-to-word': 'pdf-to-docx',
};

const FORMAT_EXT_ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  heif: 'heic',
  tif: 'tiff',
  doc: 'docx',
  ppt: 'pptx',
  xls: 'xlsx',
  word: 'docx',
  excel: 'xlsx',
};

function normalizeFormatToken(token: string): string {
  const lower = token.toLowerCase();
  return FORMAT_EXT_ALIASES[lower] || lower;
}

export function resolveCanonicalSlug(slug: string): string {
  const lower = slug.toLowerCase();
  const aliased = SEO_SLUG_ALIASES[lower] || lower;
  const match = aliased.match(/^([a-z0-9]+)-to-([a-z0-9]+)$/);
  if (!match) return aliased;

  const normSlug = `${normalizeFormatToken(match[1])}-to-${normalizeFormatToken(match[2])}`;
  return SEO_SLUG_ALIASES[normSlug] || normSlug;
}

const DEVELOPER_MAP: Record<string, string> = {
  png: 'PNG Development Group / W3C',
  jpg: 'Joint Photographic Experts Group (ISO/IEC)',
  webp: 'Google LLC',
  avif: 'Alliance for Open Media (AOMedia)',
  svg: 'World Wide Web Consortium (W3C)',
  ico: 'Microsoft Corporation',
  bmp: 'Microsoft Corporation',
  tiff: 'Aldus / Adobe Systems (ISO 12639)',
  gif: 'CompuServe',
  heic: 'Moving Picture Experts Group (MPEG) / Apple',
  psd: 'Adobe Inc.',
  tga: 'Truevision Inc.',
  pdf: 'Adobe Systems / ISO 32000',
  docx: 'Microsoft Corporation / ECMA-376',
  pptx: 'Microsoft Corporation / ECMA-376',
  xlsx: 'Microsoft Corporation / ECMA-376',
  csv: 'IETF RFC 4180 Open Standard',
  txt: 'ISO/IEC / Unicode Consortium',
};

export function getSEOPair(slug: string): FormatPairSEO | undefined {
  const canonical = resolveCanonicalSlug(slug);
  const predefined = POPULAR_SEO_PAIRS.find(p => p.slug.toLowerCase() === canonical);
  if (predefined) return predefined;

  const match = canonical.match(/^([a-z0-9]+)-to-([a-z0-9]+)$/);
  if (!match) return undefined;

  const [, rawSource, rawTarget] = match;
  const srcFmt = ALL_FORMATS.find(f => f.ext === rawSource);
  if (!srcFmt) return undefined;

  const compatibleTargets = getCompatibleTargets(rawSource);
  const tgtFmt = compatibleTargets.find(f => f.ext === rawTarget);
  if (!tgtFmt) return undefined;

  const srcUpper = srcFmt.ext.toUpperCase();
  const tgtUpper = tgtFmt.ext.toUpperCase();

  return {
    slug: `${srcFmt.ext}-to-${tgtFmt.ext}`,
    source: srcFmt.ext,
    target: tgtFmt.ext,
    sourceName: srcFmt.name,
    targetName: tgtFmt.name,
    title: `Convert ${srcUpper} to ${tgtUpper} Online - Free & Fast`,
    description: `Convert ${srcFmt.name} (.${srcFmt.ext}) files to ${tgtFmt.name} (.${tgtFmt.ext}) online for free. High-precision conversion with custom quality settings and zero file retention.`,
    keywords: [
      `${srcFmt.ext} to ${tgtFmt.ext}`,
      `convert ${srcFmt.ext} to ${tgtFmt.ext}`,
      `free ${srcFmt.ext} to ${tgtFmt.ext} converter`,
      `online ${srcFmt.ext} converter`,
      `${srcFmt.name} to ${tgtFmt.name}`,
    ],
    accept: `.${srcFmt.ext},${srcFmt.mime}`,
    faqs: [
      {
        q: `How do I convert ${srcUpper} to ${tgtUpper} online for free?`,
        a: `Drag and drop your .${srcFmt.ext} file into the converter above, verify ${tgtUpper} is selected as the output format, and click "Convert". Your .${tgtFmt.ext} file will be ready to download immediately.`,
      },
      {
        q: `Does converting ${srcUpper} to ${tgtUpper} preserve quality?`,
        a: `Yes. Tulusy uses high-precision decoding and encoding pipelines with customizable DPI, compression quality, and resolution controls so your ${tgtUpper} output retains maximum visual and structural fidelity.`,
      },
      {
        q: `Are my ${srcUpper} files kept private during conversion?`,
        a: `Yes. All conversions are processed ephemerally and deleted automatically immediately after your download completes.`,
      },
    ],
    sourceSpecs: {
      developer: DEVELOPER_MAP[srcFmt.ext] || 'Open Standard',
      type: srcFmt.category === 'document' ? 'Document / Data Format' : 'Graphics / Image Format',
      mime: srcFmt.mime,
      compression: srcFmt.lossless ? 'Lossless compression' : 'Lossy / High-efficiency compression',
      pros: [srcFmt.description],
    },
    targetSpecs: {
      developer: DEVELOPER_MAP[tgtFmt.ext] || 'Open Standard',
      type: tgtFmt.category === 'document' ? 'Document / Data Format' : 'Graphics / Image Format',
      mime: tgtFmt.mime,
      compression: tgtFmt.lossless ? 'Lossless compression' : 'Lossy / High-efficiency compression',
      pros: [tgtFmt.description],
    },
  };
}

export function getAllSEOSlugs(): string[] {
  const seen = new Set<string>(POPULAR_SEO_PAIRS.map(p => p.slug));

  for (const src of ALL_FORMATS) {
    for (const tgt of getCompatibleTargets(src.ext)) {
      const canonical = resolveCanonicalSlug(`${src.ext}-to-${tgt.ext}`);
      seen.add(canonical);
    }
  }

  return Array.from(seen);
}

export interface ConverterDirectoryGroup {
  id: string;
  title: string;
  description: string;
  pairs: FormatPairSEO[];
}

export function getConverterDirectoryGroups(): ConverterDirectoryGroup[] {
  const allPairs = getAllSEOSlugs()
    .map(slug => getSEOPair(slug))
    .filter((pair): pair is FormatPairSEO => Boolean(pair));

  const pdfPairs = allPairs.filter(p => p.source === 'pdf' || p.target === 'pdf');
  const documentPairs = allPairs.filter(
    p => p.source !== 'pdf' && p.target !== 'pdf' && ['docx', 'pptx', 'xlsx', 'csv', 'txt'].includes(p.source)
  );
  const imagePairs = allPairs.filter(
    p => p.source !== 'pdf' && p.target !== 'pdf' && !['docx', 'pptx', 'xlsx', 'csv', 'txt'].includes(p.source)
  );

  return [
    {
      id: 'pdf',
      title: 'PDF Conversion Tools',
      description: 'Convert PDFs to editable Word, PowerPoint, Excel, CSV, text, or images, and turn documents or graphics into PDF.',
      pairs: pdfPairs,
    },
    {
      id: 'documents',
      title: 'Word, Presentation & Spreadsheet Tools',
      description: 'Transform DOCX, PPTX, XLSX, CSV, and TXT files cleanly without installing office suites.',
      pairs: documentPairs,
    },
    {
      id: 'images',
      title: 'Image, Vector & Icon Converters',
      description: 'Convert between PNG, JPG, WebP, AVIF, HEIC, SVG, ICO, GIF, TIFF, BMP, PSD, and TGA.',
      pairs: imagePairs,
    },
  ];
}
