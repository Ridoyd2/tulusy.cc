export type BlogCategory = 'Comparisons' | 'Converters' | 'Architecture' | 'Privacy';

export type BlogDiagramId =
  | 'popular-sites-matrix'
  | 'size-comparison'
  | 'everyday-ways'
  | 'forever-timeline'
  | 'privacy-comparison'
  | 'multipart-pipeline'
  | 'modern-image-formats'
  | 'camera-raw-pipeline'
  | 'docs-data-matrix';

export type BlogBlock =
  | {
      type: 'heading';
      id: string;
      text: string;
    }
  | {
      type: 'subheading';
      text: string;
    }
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      ordered?: boolean;
      items: { title?: string; text: string }[];
    }
  | {
      type: 'table';
      caption?: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: 'diagram';
      id: BlogDiagramId;
    }
  | {
      type: 'callout';
      variant: 'highlight' | 'tip';
      title: string;
      text: string;
    }
  | {
      type: 'cta';
      title: string;
      description: string;
      buttonLabel: string;
      href: string;
      secondaryLabel?: string;
      secondaryHref?: string;
    };

export interface BlogPost {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: BlogCategory;
  publishedAt: string;
  readTime: string;
  coverImage: string;
  coverAlt: string;
  keywords: string[];
  blocks: BlogBlock[];
  faqs: { q: string; a: string }[];
}

export const BLOG_CATEGORIES: BlogCategory[] = ['Comparisons', 'Converters', 'Architecture', 'Privacy'];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'tulusy-vs-wetransfer-google-drive-mega-mediafire-gofile',
    title: 'Tulusy vs. WeTransfer, Google Drive, Dropbox, MEGA & MediaFire',
    shortTitle: 'Tulusy vs. Popular File Hosts',
    description:
      'Want to send a big file without hitting a weird monthly limit or making someone log in? Here is how Tulusy actually stacks up against the big names.',
    category: 'Comparisons',
    publishedAt: '2026-11-24',
    readTime: '5 min read',
    coverImage: '/images/blog/competitor-comparison.webp',
    coverAlt: 'Comparison between Tulusy File Share and WeTransfer, MEGA, MediaFire, Google Drive, and Dropbox free limits',
    keywords: [
      'tulusy vs wetransfer',
      'wetransfer alternative 5gb free',
      'mega transfer quota alternative',
      'mediafire alternative without popups',
      'google drive dropbox anonymous file sharing alternative',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Trying to send a big folder to someone online shouldn’t feel like an obstacle course. Yet almost every popular file-sharing site has a catch waiting for you. One caps your whole month at 3 GB. Another freezes your friend’s download halfway through. Another makes them dodge pop-ups or click "Request Access" on your personal Drive.',
      },
      {
        type: 'paragraph',
        text: 'So let’s put the big ones next to Tulusy and see what you actually get on the free tier.',
      },
      {
        type: 'diagram',
        id: 'popular-sites-matrix',
      },
      {
        type: 'heading',
        id: 'full-comparison-table',
        text: 'The quick side-by-side',
      },
      {
        type: 'table',
        caption: 'Comparison of Tulusy File Share vs WeTransfer, Google Drive, Dropbox, MEGA, MediaFire, SendGB, Gofile, and SwissTransfer',
        headers: ['Service', 'Free Size & Quota', 'Account Req.', 'Expiry Rule', 'The Catch'],
        rows: [
          ['Tulusy File Share', '5 GB per drop', 'No', '1h–7d, Burn, or Forever (7d idle)', 'Blocks executables (.exe/.apk) for safety'],
          ['WeTransfer', '3 GB / 30d total (10 transfers)', 'No (email code)', '3 days fixed', 'One 3 GB file uses up your whole month'],
          ['Google Drive', '15 GB pooled (Gmail + Photos)', 'Yes (+ phone)', 'Until deleted', 'Shows your Google profile; no Burn on Read'],
          ['Dropbox Basic', '2 GB total storage', 'Yes', 'Until deleted', 'Only 3 devices allowed; stops syncing when full'],
          ['MEGA', '20 GB storage', 'Yes', 'Until deleted', 'Free download quota locks people out mid-download'],
          ['MediaFire', '4 GB / file (10 GB total)', 'Account to manage', 'Inactivity pruning', 'Pop-ups and messy redirects on free links'],
          ['SendGB', '5 GB / transfer', 'No', '7d standard (>250 MB)', 'Bigger files disappear after 7 days unless you pay'],
          ['Gofile', '100 GB / 30d anon traffic', 'No', 'Activity-based', 'No Burn on Read toggle or local QR handoff'],
          ['SwissTransfer', '50 GB / transfer', 'No', '1 to 30 days max', 'Links always die by day 30; no Forever option'],
        ],
      },
      {
        type: 'heading',
        id: 'wetransfer-and-mediafire',
        text: 'Tulusy vs. WeTransfer and MediaFire',
      },
      {
        type: 'paragraph',
        text: 'WeTransfer used to be everyone’s go-to, right? Not anymore. Their free plan now caps you at 3 GB total and 10 transfers across a rolling 30-day window, and links die after just 3 days. Send one 2.8 GB video export and you’re basically locked out for the rest of the month.',
      },
      {
        type: 'paragraph',
        text: 'MediaFire gives you 4 GB per file on a 10 GB free account, which sounds fine until your friend opens the link and gets hit with pop-ups and redirect clutter just trying to grab a ZIP. With Tulusy, you get 5 GB per file, one straightforward download button over Cloudflare R2 with no redirect traps or countdown waits, and links that can stay alive as long as people use them.',
      },
      {
        type: 'heading',
        id: 'mega-drive-dropbox',
        text: 'Tulusy vs. Google Drive, Dropbox, and MEGA',
      },
      {
        type: 'paragraph',
        text: 'Google Drive (15 GB shared with Gmail and Photos) and Dropbox (just 2 GB free and a 3-device cap) are great for keeping your own stuff backed up, not for quick one-off sends. When you share a link from them, your name and email pop up, the file eats your storage space, and that public link usually stays open forever because nobody remembers to turn it off.',
      },
      {
        type: 'paragraph',
        text: 'MEGA gives you 20 GB and encryption, which looks awesome on paper—until the person downloading your file hits a "Transfer Quota Exceeded" wall halfway through and has to wait hours unless someone pays. On Tulusy, nobody needs an account, no IPs are logged, and downloads pull straight from Cloudflare R2 without bandwidth lockouts.',
      },
      {
        type: 'heading',
        id: 'sendgb-gofile-swisstransfer',
        text: 'Tulusy vs. SendGB, Gofile, and SwissTransfer',
      },
      {
        type: 'paragraph',
        text: 'SendGB matches our 5 GB limit and skips signups too, though anything over 250 MB disappears in 7 days unless you pay to extend it. Gofile also keeps active files online, but caps anonymous traffic at 100 GB per 30 days and doesn’t give you Tulusy’s Burn on Read switch, salted scrypt password lock, or built-in file converters.',
      },
      {
        type: 'paragraph',
        text: 'Credit where it’s due: SwissTransfer is great if you have a massive 40 GB folder that only needs to live for a couple weeks. Where Tulusy beats it is everything else—links that can stay alive past 30 days automatically with Forever (7d idle), single-download Burn on Read, and built-in PDF/image converters right in the next tab.',
      },
      {
        type: 'callout',
        variant: 'highlight',
        title: 'Bonus: you don’t need five different tabs',
        text: 'Tulusy isn’t just a file host. You also get a 40-format file converter (modern images, Camera RAW, e-books, and structured data) and web tools in the same place, so you can convert a PDF or shrink a chunky PNG before sharing it.',
      },
      {
        type: 'cta',
        title: 'Skip the quotas, timers, and login walls',
        description: 'Drop up to 5 GB with no signup—get a short link, QR code, Burn on Read, or Forever (7d idle).',
        buttonLabel: 'Open Tulusy File Share',
        href: '/share',
        secondaryLabel: 'All Blog Posts',
        secondaryHref: '/blog',
      },
    ],
    faqs: [
      {
        q: 'Why pick Tulusy over WeTransfer?',
        a: 'WeTransfer’s free plan caps you at 3 GB total and 10 transfers every 30 days, and links expire in 3 days. Tulusy lets you send up to 5 GB per file with 1h–7d timers, Burn on Read, or Forever (7d idle) and no 30-day rolling lock.',
      },
      {
        q: 'Will my friends get hit with MEGA-style quota pauses or MediaFire pop-ups?',
        a: 'Nope. Tulusy hands them a direct Cloudflare R2 download link on a clean page—no redirect pop-ups and no bandwidth lockouts.',
      },
    ],
  },
  {
    slug: 'jpeg-xl-avif-webp-qoi-dds-modern-image-formats-guide',
    title: 'JPEG XL, AVIF, WebP, QOI & DDS: Which Modern Image Format Fits Best?',
    shortTitle: 'Modern Image Formats: JXL, AVIF, WebP & QOI',
    description:
      'JPEG and PNG are everywhere, yet newer formats like JPEG XL (JXL), AVIF, WebP, QOI, DDS, and ICNS cut sizes in half or unlock GPU and macOS workflows. Here is when to use each.',
    category: 'Converters',
    publishedAt: '2026-11-25',
    readTime: '4 min read',
    coverImage: '/images/blog/modern-image-formats.webp',
    coverAlt: 'Comparison of JPEG XL, AVIF, WebP, QOI, DDS, ICNS, and JP2 modern image formats supported on Tulusy',
    keywords: [
      'jpeg xl vs avif vs webp',
      'convert jxl to webp online',
      'what is qoi image format',
      'convert png to dds or icns',
      'modern image format comparison',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Most websites still tell you to pick between JPG and PNG, even though cameras, browsers, game engines, and macOS apps now rely on half a dozen specialized image formats. One format cuts web payloads by 50%, another encodes lossless sprites in milliseconds, and another bundles Retina app icons.',
      },
      {
        type: 'diagram',
        id: 'modern-image-formats',
      },
      {
        type: 'heading',
        id: 'when-to-pick-each-format',
        text: 'Quick cheat sheet for modern image formats',
      },
      {
        type: 'table',
        caption: 'Modern and specialized image formats supported by Tulusy',
        headers: ['Format', 'Best For', 'Alpha / Lossless', 'Typical Next Step'],
        rows: [
          ['JXL (JPEG XL)', 'Long-term photo archives & HDR', 'Yes / Both', 'Convert JXL to WebP or JPG for universal sharing'],
          ['AVIF', 'Smallest web hero images & photos', 'Yes / Lossy & lossless', 'Convert AVIF to JPG/PNG for older editors'],
          ['WebP', 'Fast websites, UI assets & animations', 'Yes / Both', 'Drop PNG or JPG straight into WebP'],
          ['QOI', 'Fast lossless game/pipeline textures', 'Yes / Lossless only', 'Convert QOI to PNG or WebP for browsers'],
          ['DDS', 'DirectX & 3D engine textures', 'Yes / Texture container', 'Export DDS assets to PNG for quick review'],
          ['ICNS / CUR', 'macOS Retina icons & Windows cursors', 'Yes / Multi-size', 'Turn PNG logos into ICNS/ICO or extract CUR to PNG'],
          ['JP2 (JPEG 2000)', 'GIS, medical & archival imaging', 'Yes / Wavelet', 'Convert JP2 to PNG or JPG without desktop plugins'],
        ],
      },
      {
        type: 'heading',
        id: 'converting-with-controls',
        text: 'Resize, flatten transparency, and tune quality in one batch',
      },
      {
        type: 'paragraph',
        text: 'Every modern image conversion on Tulusy lets you dial in compression quality (1–100%), set exact width/height with aspect lock, toggle grayscale while preserving alpha channels, and choose a custom background color when flattening transparent assets into JPG, BMP, PPM, or PDF.',
      },
      {
        type: 'callout',
        variant: 'tip',
        title: 'Need Windows cursors or macOS app icons?',
        text: 'You can convert modern Windows 10/11 PNG-compressed .cur files and classic BMP cursors straight to PNG or WebP, or export any high-res PNG logo into a multi-size .icns or .ico bundle.',
      },
      {
        type: 'cta',
        title: 'Convert JXL, AVIF, QOI, DDS, or ICNS in seconds',
        description: 'Batch convert multiple images in parallel and download them individually or as a single ZIP.',
        buttonLabel: 'Try JXL to WebP',
        href: '/convert/jxl-to-webp',
        secondaryLabel: 'Browse All Image Converters',
        secondaryHref: '/convert#images',
      },
    ],
    faqs: [
      {
        q: 'Why convert JPEG XL (.jxl) to WebP or JPG before sharing?',
        a: 'JPEG XL is amazing for archiving and HDR, but several browsers and messaging apps still do not render .jxl natively. Converting to WebP or JPG makes the image viewable everywhere.',
      },
      {
        q: 'Can Tulusy convert transparent images to PPM or JPG cleanly?',
        a: 'Yes. Formats without an alpha channel (JPG, BMP, PPM, and PDF) composite transparent pixels cleanly onto your chosen background color instead of turning transparent regions black.',
      },
    ],
  },
  {
    slug: 'camera-raw-cr2-cr3-nef-arw-dng-to-jpg-png-webp-guide',
    title: 'How to Convert Camera RAW Photos (CR2, CR3, NEF, ARW & DNG) Without Lightroom',
    shortTitle: 'Camera RAW Conversion Without Lightroom',
    description:
      'Need to open or share Canon CR2/CR3, Nikon NEF, Sony ARW, Fujifilm RAF, or Adobe DNG files on a device without desktop RAW software? Convert them right in your browser.',
    category: 'Converters',
    publishedAt: '2026-11-25',
    readTime: '4 min read',
    coverImage: '/images/blog/camera-raw-guide.webp',
    coverAlt: 'Camera RAW conversion pipeline supporting Canon CR2 CR3, Nikon NEF, Sony ARW, Adobe DNG, Fujifilm RAF, Olympus ORF, and Panasonic RW2',
    keywords: [
      'convert cr3 to jpg online',
      'canon cr2 to jpg without lightroom',
      'nikon nef to png converter',
      'sony arw to webp online',
      'camera raw to jpg converter',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Camera RAW files capture every bit of sensor detail from your DSLR or mirrorless camera, which is great while editing—and annoying the moment you want to preview a shoot on a phone, upload proofs to a client, or drop photos onto a website without booting up Lightroom.',
      },
      {
        type: 'diagram',
        id: 'camera-raw-pipeline',
      },
      {
        type: 'heading',
        id: 'supported-camera-brands',
        text: 'Supported camera RAW formats by brand',
      },
      {
        type: 'table',
        caption: 'Supported Camera RAW formats decoded via LibRaw on Tulusy',
        headers: ['Extension', 'Camera Brand / Standard', 'Recommended Output'],
        rows: [
          ['.cr2 / .cr3', 'Canon EOS DSLR & EOS R mirrorless', 'JPG (client proofs), WebP (web), PNG/TIFF (edits)'],
          ['.nef', 'Nikon DSLR & Z-series mirrorless', 'JPG, AVIF, JXL, or PDF contact sheets'],
          ['.arw', 'Sony Alpha full-frame & APS-C', 'JPG, PNG, WebP, or TIFF'],
          ['.dng', 'Adobe Digital Negative (Leica, smartphones, Lightroom)', 'JPG, WebP, AVIF, or JXL'],
          ['.raf', 'Fujifilm X-Series & GFX', 'JPG, PNG, or TIFF'],
          ['.orf / .rw2', 'Olympus / OM System & Panasonic LUMIX', 'JPG, WebP, or PNG'],
        ],
      },
      {
        type: 'heading',
        id: 'how-tulusy-develops-raw',
        text: 'How Tulusy develops RAW photos cleanly',
      },
      {
        type: 'paragraph',
        text: 'Instead of pulling a tiny low-res embedded thumbnail, Tulusy decodes the actual sensor data using LibRaw with your camera’s recorded white balance, applies EXIF orientation automatically, and exports at your chosen quality, DPI, and pixel dimensions—then deletes the temporary upload right after streaming your download.',
      },
      {
        type: 'callout',
        variant: 'highlight',
        title: 'Tip for sending full-resolution RAW archives to clients',
        text: 'Convert a quick JPG/WebP preview batch in the Converter tab, and if someone also needs the untouched 50 MB RAW originals, drop the RAW folder on /share (up to 5 GB per file, zero compression).',
      },
      {
        type: 'cta',
        title: 'Convert Camera RAW photos right now',
        description: 'Upload CR2, CR3, NEF, ARW, DNG, RAF, ORF, or RW2 up to 100 MB per file with zero software install.',
        buttonLabel: 'Convert CR3 to JPG',
        href: '/convert/cr3-to-jpg',
        secondaryLabel: 'All Camera RAW Converters',
        secondaryHref: '/convert#raw',
      },
    ],
    faqs: [
      {
        q: 'Does Tulusy extract a low-res preview or decode the full RAW sensor image?',
        a: 'Tulusy decodes the full RAW sensor buffer via LibRaw using your camera’s white balance before resizing or compressing to your target format.',
      },
      {
        q: 'Can I merge multiple Camera RAW shots into one PDF contact sheet?',
        a: 'Yes! Drop multiple RAW files into the batch queue and click "Merge into 1 PDF" to combine them into a single multi-page PDF.',
      },
    ],
  },
  {
    slug: 'convert-markdown-html-epub-rtf-json-yaml-xml-browser-guide',
    title: 'Converting Markdown, HTML, EPUB, RTF & Structured Data (JSON, YAML, XML) Online',
    shortTitle: 'Markdown, EPUB, RTF & JSON/YAML/XML Guide',
    description:
      'Turn Markdown notes into clean PDFs or Word docs, unpack EPUB e-books, and convert JSON, YAML, XML, CSV, and Excel spreadsheets safely without Pandoc or local scripts.',
    category: 'Converters',
    publishedAt: '2026-11-25',
    readTime: '4 min read',
    coverImage: '/images/blog/docs-data-formats.webp',
    coverAlt: 'Sanitized conversion matrix for Markdown, HTML, EPUB, RTF, JSON, YAML, XML, CSV, and XLSX on Tulusy',
    keywords: [
      'markdown to pdf online',
      'epub to pdf or txt converter',
      'json to yaml and csv converter',
      'xml to json and excel online',
      'html to markdown converter',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Not every file problem is a photo or a Word doc. Half the time you have a README.md that needs to go out as a clean PDF, an EPUB e-book you want as readable text, or a YAML/XML export that someone in finance needs as an Excel spreadsheet.',
      },
      {
        type: 'diagram',
        id: 'docs-data-matrix',
      },
      {
        type: 'heading',
        id: 'markup-and-ebooks-workflows',
        text: 'Markup & e-book workflows (MD, HTML, EPUB, RTF)',
      },
      {
        type: 'list',
        items: [
          {
            title: 'Markdown (.md / .markdown) to PDF, DOCX, HTML, or EPUB',
            text: 'Preserves headings, tables, fenced code blocks, and bullet lists cleanly—ideal for sharing technical specs or exporting documentation into Word.',
          },
          {
            title: 'HTML to Markdown, PDF, DOCX, or EPUB',
            text: 'Strips scripts, active tags, and external CSS resource URLs before rendering clean paginated PDFs or structured Word/Markdown output.',
          },
          {
            title: 'EPUB & RTF portability',
            text: 'Extract clean chapter text from EPUB e-books (filtering out TOC nav boilerplate automatically) into PDF, DOCX, Markdown, HTML, or TXT, or turn legacy RTF files into modern DOCX/PDF.',
          },
        ],
      },
      {
        type: 'heading',
        id: 'structured-data-workflows',
        text: 'Structured data workflows (JSON, YAML, XML, CSV, XLSX)',
      },
      {
        type: 'paragraph',
        text: 'Converting between JSON, YAML, XML, CSV, and XLSX handles real-world quirks automatically: ISO dates in YAML or Excel cells serialize cleanly into JSON strings, nested objects flatten into clean spreadsheet columns, XML roots with attributes unwrap into table rows, and XML parsing runs through defusedxml to block XXE entity attacks.',
      },
      {
        type: 'cta',
        title: 'Convert Markdown, EPUB, JSON, YAML, or XML now',
        description: 'Zero CLI setup, ephemeral processing, and instant downloads.',
        buttonLabel: 'Try Markdown to PDF',
        href: '/convert/md-to-pdf',
        secondaryLabel: 'Try JSON to YAML',
        secondaryHref: '/convert/json-to-yaml',
      },
    ],
    faqs: [
      {
        q: 'Is it safe to convert untrusted HTML or XML files?',
        a: 'Yes. HTML inputs are stripped of scripts, event handlers, unsafe links, and external CSS url() rules before rendering, while XML inputs are parsed via defusedxml to block XXE and entity-expansion attacks.',
      },
      {
        q: 'Can I convert a JSON or XML API export directly into Excel (.xlsx)?',
        a: 'Yes. Arrays of objects map automatically into styled Excel columns, and nested keys flatten cleanly into readable headers.',
      },
    ],
  },
  {
    slug: 'why-tulusy-beats-traditional-file-hosting-services',
    title: 'Why Tulusy Beats Traditional File Hosting Services',
    shortTitle: 'Why Tulusy Beats Other File Hosts',
    description:
      'Most free file hosts cap you at 2 GB, ask for email codes, make you wait through fake timers, and kill your link on day 7. Here is why Tulusy feels way better.',
    category: 'Comparisons',
    publishedAt: '2026-11-24',
    readTime: '4 min read',
    coverImage: '/images/blog/hosts-comparison.webp',
    coverAlt: 'Capacity comparison chart showing Tulusy File Share 5GB capacity against email limits and traditional 2GB file lockers',
    keywords: [
      'best free file hosting service',
      'anonymous 5gb file share',
      'tulusy vs wetransfer',
      'free large file transfer without signup',
      'forever file hosting',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Sending a 3 GB video export or a big project ZIP should take ten seconds. You shouldn’t have to make an account, dig an email code out of spam, and warn your friend not to click the wrong download button. Somehow that’s still how most free file hosts work.',
      },
      {
        type: 'paragraph',
        text: 'Old-school transfer sites shrink free limits down to 1 or 2 GB, slow down downloads with fake countdowns, and nuke your link after a few days even if people are still grabbing it. Cloud drives do the exact opposite: your file never leaves, eats up your storage space, and shows your real account details to anyone with the URL.',
      },
      {
        type: 'diagram',
        id: 'size-comparison',
      },
      {
        type: 'heading',
        id: 'how-tulusy-compares',
        text: 'How it compares at a glance',
      },
      {
        type: 'paragraph',
        text: 'Here’s what you get with Tulusy vs. the usual file lockers and cloud drives:',
      },
      {
        type: 'table',
        caption: 'Tulusy File Share compared with legacy transfer services and cloud drives',
        headers: ['Feature', 'Tulusy File Share', 'Legacy File Hosts', 'Cloud Drives (Drive / Dropbox)'],
        rows: [
          ['Max anonymous upload', '5 GB per file, free', 'Usually 1 GB – 2 GB free', 'Account required; shared quota'],
          ['Signup or email check', 'None', 'Usually email verification', 'Mandatory account & login'],
          ['Expiration choices', '1h, 24h, 3d, 7d, Burn, or Forever (7d idle)', 'Fixed 3–7 day cutoffs', 'Stays until you delete it'],
          ['Burn after 1 download', 'Free toggle', 'Usually paid only', 'Not built in'],
          ['Password lock', 'Salted scrypt hash', 'Often paywalled', 'Folder permissions only'],
          ['Transfer path', 'Direct browser-to-R2 multipart PUT/GET', 'Slow server proxy / throttled speed', 'Client sync or clunky web UI'],
          ['IP logging', 'Zero uploader or viewer IP logs', 'Session & account tracking', 'Full access & IP history'],
          ['Mobile QR handoff', 'Made locally in SVG', 'Rare or pushes an app', 'Share menu + login screen'],
        ],
      },
      {
        type: 'heading',
        id: 'what-changes-day-to-day',
        text: 'Why it’s just nicer to use',
      },
      {
        type: 'list',
        items: [
          {
            title: 'Send up to 5 GB with zero signup',
            text: 'Drag your file in, grab the short 8-character link, and you’re done. Whoever opens it gets one clean download button served from Cloudflare R2 with no queue.',
          },
          {
            title: 'Links don’t die while people are still using them',
            text: 'Pick Forever (7d idle) and your link stays live as long as real humans keep opening or downloading it. Every visit resets the 7-day clock, and forgotten files clean themselves up automatically.',
          },
          {
            title: 'Fast direct uploads',
            text: 'Anything over 64 MB automatically splits into 32 MB chunks and streams straight from your browser to Cloudflare R2—no slow middleman server slowing you down.',
          },
          {
            title: 'No IP logs, plus an instant delete button',
            text: 'We don’t log uploader or viewer IPs, we block search engines from indexing /f/ links, and your browser keeps a private delete token so you can nuke a file early anytime.',
          },
          {
            title: 'Convert files right before you share',
            text: 'Need to turn a giant PNG into WebP or convert a PDF into Word first? Just click the Converter tab—temp files are wiped right after you download.',
          },
        ],
      },
      {
        type: 'callout',
        variant: 'highlight',
        title: 'One fair rule we keep strict',
        text: 'To keep links safe and prevent malware spam, executable files (.exe, .bat, .sh, .msi, .apk, .dmg) are blocked before upload.',
      },
      {
        type: 'cta',
        title: 'Send a 5 GB file right now',
        description: 'No login, no wait countdowns, and full original quality over Cloudflare R2.',
        buttonLabel: 'Open File Share',
        href: '/share',
        secondaryLabel: 'Browse Converters',
        secondaryHref: '/convert',
      },
    ],
    faqs: [
      {
        q: 'Is Tulusy File Share really free up to 5 GB?',
        a: 'Yep. Drop any allowed file up to 5 GB without creating an account or pulling out a credit card.',
      },
      {
        q: 'Can I delete my file early once my friend downloads it?',
        a: 'Yes. Your browser saves a private delete token locally so you can wipe any active upload in one click—or just pick Burn on Read so it deletes itself after 1 download.',
      },
    ],
  },
  {
    slug: 'tulusy-vs-email-messaging-apps-usb-airdrop',
    title: 'Stop Sending Files Over Email, WhatsApp, Discord, or USB',
    shortTitle: 'Tulusy vs. Email, Chat Apps & USB',
    description:
      'Email bounces at 25 MB, chat apps turn crisp photos into mush, and AirDrop quits the second someone has a Windows PC. Here is an easier way.',
    category: 'Comparisons',
    publishedAt: '2026-11-23',
    readTime: '4 min read',
    coverImage: '/images/blog/everyday-transfer.webp',
    coverAlt: 'Comparison showing email 25MB bounces, chat compression, and AirDrop OS locks vs Tulusy universal link and QR sharing',
    keywords: [
      'alternative to email attachments',
      'send large video without whatsapp compression',
      'cross platform file transfer android iphone windows',
      'send files without cloud account',
      'qr code file sharing',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Most of us send files the lazy way—whatever app is already open. We attach a ZIP to Gmail and watch it bounce, toss a clean screenshot into WhatsApp where it turns blurry, or dig around for a USB cable because AirDrop refuses to talk to a Windows laptop.',
      },
      {
        type: 'diagram',
        id: 'everyday-ways',
      },
      {
        type: 'heading',
        id: 'why-each-shortcut-breaks',
        text: 'Why those everyday shortcuts get annoying fast',
      },
      {
        type: 'table',
        caption: 'Common file sending shortcuts compared with Tulusy',
        headers: ['Method', 'The Annoying Part', 'With Tulusy Instead'],
        rows: [
          ['Email attachments', '20–25 MB ceiling; copies sit in both inboxes forever', 'Up to 5 GB per link; deletes itself automatically'],
          ['WhatsApp / Messenger', 'Crushes image and video quality by default', 'Exact original file, untouched'],
          ['Discord / Slack', '10–25 MB free cap; buried in random chat scrollback', 'Clean link, optional password, up to 5 GB'],
          ['AirDrop / Nearby Share', 'Breaks between iPhone, Android, Windows, and Linux', 'Link + QR code works in any browser on any OS'],
          ['USB flash drives', 'Need the drive, the right port, and trust in the PC', 'Wireless browser drop with zero login'],
        ],
      },
      {
        type: 'heading',
        id: 'email-and-compression',
        text: 'Email and chat apps hate big, crisp files',
      },
      {
        type: 'paragraph',
        text: 'Email attachments don’t even give you a clean 25 MB—encoding bloats an 18 MB file by about a third, so mail servers bounce it anyway. And when it does go through, private docs sit in both your Sent folder and someone else’s inbox forever.',
      },
      {
        type: 'paragraph',
        text: 'Chat apps feel quick until you send a sharp UI mockup or 4K clip and check it on the other phone: fuzzy text, washed-out colors, and a random filename. Tulusy hands over the exact bytes you uploaded—zero compression, zero surprises.',
      },
      {
        type: 'heading',
        id: 'qr-between-devices',
        text: 'Grabbing a file onto your phone without logging in',
      },
      {
        type: 'paragraph',
        text: 'Ever needed to move a PDF off a library computer, print shop PC, or coworker’s laptop onto your phone? Logging into Google Drive or iCloud on someone else’s computer is a pain—2FA codes, "new device" emails, and praying you remembered to sign out.',
      },
      {
        type: 'paragraph',
        text: 'With Tulusy, just drop the file in the browser. A QR code pops up right away (generated locally on your device, not by some third-party tracker). Scan it with your phone, save the file, and hit Delete when you walk away.',
      },
      {
        type: 'callout',
        variant: 'tip',
        title: 'Want a smaller file on purpose?',
        text: 'If you actually want to shrink a huge PNG to WebP or turn photos into one PDF, run it through the Tulusy converter first and then drop the smaller file.',
      },
      {
        type: 'cta',
        title: 'Send full-quality files between any devices',
        description: 'Works on Windows, Mac, Linux, iPhone, and Android with no app to install.',
        buttonLabel: 'Open File Share',
        href: '/share',
      },
    ],
    faqs: [
      {
        q: 'Does Tulusy compress my photos or videos?',
        a: 'Never. File Share stores and serves your exact original file byte-for-byte.',
      },
      {
        q: 'Do I need an app to scan the QR code?',
        a: 'Nope. Just point your regular phone camera at it and it opens straight in your browser.',
      },
    ],
  },
  {
    slug: 'forever-file-hosting-7-day-inactivity-explained',
    title: 'Forever File Hosting Without Dead Storage',
    shortTitle: 'Forever (7d Idle) Hosting Explained',
    description:
      '7-day links always seem to die right before someone clicks them, while permanent drives turn into junk drawers. Here is how Tulusy keeps active links alive forever.',
    category: 'Architecture',
    publishedAt: '2026-11-24',
    readTime: '4 min read',
    coverImage: '/images/blog/forever-hosting.webp',
    coverAlt: 'Timeline showing Forever 7d idle hosting resetting on human views while ignoring preview bots and purging after 7 quiet days',
    keywords: [
      'forever file hosting',
      'file link resets expiry on download',
      '7 day inactivity file deletion',
      'sliding ttl file share',
      'smart file retention policy',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Guessing how long a file link needs to live is weirdly annoying. Set a 7-day timer and someone will inevitably message you on day 8 asking for a re-upload. Toss it in permanent cloud storage instead, and two years later you’re still wasting space on an old ZIP nobody cares about.',
      },
      {
        type: 'paragraph',
        text: 'That’s why we built Forever (7d idle) on Tulusy. As long as real people keep viewing or downloading the link, it stays online forever. Once nobody touches it for 7 days straight, it cleans itself up automatically.',
      },
      {
        type: 'heading',
        id: 'how-the-clock-works',
        text: 'How the 7-day reset works',
      },
      {
        type: 'list',
        ordered: true,
        items: [
          {
            title: 'The timer starts after your upload finishes',
            text: 'If you’re uploading a huge 4 GB file on slow Wi-Fi, you don’t lose any time while it uploads. Your 7 days start once Cloudflare R2 confirms the full file landed.',
          },
          {
            title: 'Real views and downloads reset the clock',
            text: 'Whenever someone opens the link in a browser or downloads the file, the timer jumps back to a fresh 7 days and updates right on the page.',
          },
          {
            title: 'Seven quiet days wipes it out',
            text: 'If a whole week goes by with zero views and zero downloads, our cleanup job permanently deletes the file. Once it’s gone, it stays gone.',
          },
        ],
      },
      {
        type: 'diagram',
        id: 'forever-timeline',
      },
      {
        type: 'heading',
        id: 'bot-protection',
        text: 'Wait—what about Discord or WhatsApp link previews?',
      },
      {
        type: 'paragraph',
        text: 'Good question. Whenever you paste a URL into Discord, WhatsApp, Telegram, or Slack, their preview bots ping it right away. Random web scrapers do the same thing. If bots counted as views, dead links would never actually expire.',
      },
      {
        type: 'paragraph',
        text: 'So we filter them out. Plain metadata checks stay read-only, hidden browser prefetches are ignored, and known preview bots or curl scripts don’t touch the timer. Only real browser visits and downloads push the deadline forward—and we do all of it without logging anyone’s IP address.',
      },
      {
        type: 'cta',
        title: 'Host active files without babysitting links',
        description: 'Pick Forever (7d idle) on /share and see the live view count and countdown in action.',
        buttonLabel: 'Try Forever Hosting',
        href: '/share',
      },
    ],
    faqs: [
      {
        q: 'If I check my own upload status on the dashboard, does that reset the 7 days?',
        a: 'Nope. Background status checks are read-only so they don’t artificially keep an unused link alive.',
      },
      {
        q: 'Can I combine Forever (7d idle) with Burn on Read?',
        a: 'No—Burn on Read wipes the file right after 1 download, while Forever is meant for links you want to keep alive as long as people use them.',
      },
    ],
  },
  {
    slug: 'tulusy-vs-cloud-drives-privacy-and-ephemeral-sharing',
    title: 'Tulusy vs. Cloud Drives: Why Ephemeral Links Are Safer',
    shortTitle: 'Tulusy vs. Cloud Drives: Privacy',
    description:
      'Flipping on "Anyone with the link" in Google Drive or Dropbox leaves your files hanging open for years. Here is why quick self-deleting drops make way more sense.',
    category: 'Privacy',
    publishedAt: '2026-11-22',
    readTime: '4 min read',
    coverImage: '/images/blog/privacy-ephemeral.webp',
    coverAlt: 'Comparison showing cloud drive link exposure vs Tulusy ephemeral zero IP logging and scrypt password protection',
    keywords: [
      'google drive sharing privacy risks',
      'anonymous file sharing vs dropbox',
      'ephemeral file hosting benefits',
      'burn after reading file transfer',
      'zero ip logging file upload',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Cloud drives like Google Drive and Dropbox are great for keeping your backups safe, not for tossing files across the internet. Every time you flip on "Anyone with the link" just to send a signed PDF or export once, that link tends to stay public for years because nobody remembers to go back and turn it off.',
      },
      {
        type: 'paragraph',
        text: 'Plus, sharing straight from Drive or OneDrive usually slaps your full name, profile photo, and email right on the download page.',
      },
      {
        type: 'diagram',
        id: 'privacy-comparison',
      },
      {
        type: 'heading',
        id: 'privacy-controls-built-in',
        text: 'What Tulusy does to keep drops private',
      },
      {
        type: 'table',
        caption: 'Privacy controls built into Tulusy File Share',
        headers: ['Layer', 'How Tulusy Handles It'],
        rows: [
          ['Identity & IPs', 'No signups; zero uploader or viewer IP addresses saved in our database or logs'],
          ['Search engines', 'Every /f/[id] page uses noindex, nofollow and /f/ is blocked in robots.txt'],
          ['Password lock', 'Optional passwords are hashed with salted scrypt and checked in constant time'],
          ['Single-use links', 'Burn on Read locks the link the moment download starts and cleans up the file'],
          ['Instant kill switch', 'Your browser keeps a private delete token so you can wipe any link whenever you want'],
          ['Short-lived download URLs', 'Signed Cloudflare R2 links expire in 30 minutes instead of exposing permanent public URLs'],
        ],
      },
      {
        type: 'heading',
        id: 'separate-archive-from-delivery',
        text: 'Keep Drive for backups, use Tulusy for handoffs',
      },
      {
        type: 'paragraph',
        text: 'It’s way cleaner to keep your permanent storage separate from your quick file sends. Leave your archives in Drive, and use a self-deleting Tulusy drop whenever you just need to hand a file to someone.',
      },
      {
        type: 'callout',
        variant: 'tip',
        title: 'Quick trick for super sensitive files',
        text: 'Turn on Burn on Read AND set a password on /share, then text the password in a different app from the link. Even if someone scrolls through chat logs later, the link is already dead.',
      },
      {
        type: 'cta',
        title: 'Share privately with no account trail',
        description: 'Pick a 1-hour timer, Burn on Read, or a password lock right from your browser.',
        buttonLabel: 'Create Private Drop',
        href: '/share',
      },
    ],
    faqs: [
      {
        q: 'Can Google or Bing index my shared links?',
        a: 'No. Every link uses a random 8-character ID, sends noindex/nofollow headers, and /f/ is blocked in robots.txt.',
      },
      {
        q: 'How are file passwords checked?',
        a: 'Passwords are stored as salted scrypt hashes and verified in constant time before generating a 30-minute download link.',
      },
    ],
  },
  {
    slug: 'how-tulusy-uploads-5gb-files-fast-multipart-r2',
    title: 'How Tulusy Sends 5GB Files Without Slow Proxy Bottlenecks',
    shortTitle: 'How Tulusy Moves 5GB Files Fast',
    description:
      'Ever watched a browser upload freeze at 99% or crash at 100 MB? Here is how direct Cloudflare R2 links and parallel 32 MB chunks keep big uploads moving.',
    category: 'Architecture',
    publishedAt: '2026-11-21',
    readTime: '3 min read',
    coverImage: '/images/blog/fast-multipart.webp',
    coverAlt: 'Architecture diagram of browser uploading 3 parallel 32MB chunks directly to Cloudflare R2 edge storage',
    keywords: [
      'fast 5gb file upload',
      'presigned multipart upload cloudflare r2',
      'bypass 100mb upload timeout',
      'parallel chunked upload architecture',
      'fast file sharing without proxy',
    ],
    blocks: [
      {
        type: 'paragraph',
        text: 'Uploading a multi-gigabyte file on a normal website is usually miserable. You stare at a progress bar for twenty minutes, and then a proxy times out, a CDN blocks anything over 100 MB, or your Wi-Fi hiccups at 94% and makes you start from zero.',
      },
      {
        type: 'paragraph',
        text: 'Most websites do it the slow way: your browser sends the whole file to their web server, the server writes it to disk, and then copies it again to cloud storage. Everyone ends up fighting over one server’s bandwidth.',
      },
      {
        type: 'diagram',
        id: 'multipart-pipeline',
      },
      {
        type: 'heading',
        id: 'three-step-flow',
        text: 'How Tulusy skips the middleman',
      },
      {
        type: 'list',
        ordered: true,
        items: [
          {
            title: 'A tiny handshake',
            text: 'Your browser only sends the file name, size, expiry setting, and optional password. Our backend checks the file type and hands back direct signed Cloudflare R2 upload URLs.',
          },
          {
            title: '3 chunks at once for files over 64 MB',
            text: 'Small files go up in one shot. Anything over 64 MB gets sliced into 32 MB chunks and uploads 3 parts in parallel straight to R2—with automatic retries if a chunk blips.',
          },
          {
            title: 'Quick byte check and direct downloads',
            text: 'Once the last chunk lands, our backend checks the exact file size in R2 and unlocks your link. When someone clicks Download, they pull straight from R2 via a 30-minute signed URL.',
          },
        ],
      },
      {
        type: 'callout',
        variant: 'highlight',
        title: 'Changed your mind mid-upload?',
        text: 'Hit cancel and we immediately tell R2 to abort the partial upload, backed up by an automatic 7-day cleanup rule for abandoned chunks.',
      },
      {
        type: 'cta',
        title: 'Try a big upload yourself',
        description: 'Drop up to 5 GB and watch the live MB/s speed and parallel chunking go.',
        buttonLabel: 'Open File Share',
        href: '/share',
        secondaryLabel: 'Optimize Images First',
        secondaryHref: '/',
      },
    ],
    faqs: [
      {
        q: 'When does Tulusy switch to parallel chunked uploads?',
        a: 'Anything over 64 MB automatically splits into 32 MB chunks uploading 3 at a time straight to Cloudflare R2.',
      },
      {
        q: 'Do downloads slow down through Tulusy’s backend server?',
        a: 'No. When R2 is active, the backend checks your password/timer and hands your browser a direct 30-minute R2 download link.',
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(post => post.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map(post => post.slug);
}

export function getRelatedBlogPosts(currentSlug: string, limit = 3): BlogPost[] {
  const current = getBlogPost(currentSlug);
  const others = BLOG_POSTS.filter(p => p.slug !== currentSlug);
  if (!current) return others.slice(0, limit);
  const sorted = [...others].sort((a, b) => {
    const aSame = a.category === current.category ? 0 : 1;
    const bSame = b.category === current.category ? 0 : 1;
    return aSame - bSame;
  });
  return sorted.slice(0, limit);
}

export function formatBlogDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
