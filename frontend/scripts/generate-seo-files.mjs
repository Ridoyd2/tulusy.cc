import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

const isProdMode =
  process.argv.includes('--prod') || process.env.NODE_ENV === 'production';

if (isProdMode) {
  loadEnvFile(path.join(frontendRoot, '.env.production.local'));
  loadEnvFile(path.join(frontendRoot, '.env.production'));
}
loadEnvFile(path.join(frontendRoot, '.env.local'));
loadEnvFile(path.join(frontendRoot, '.env'));

const moduleCache = new Map();

function loadTsModule(tsFilePath) {
  const absPath = path.resolve(tsFilePath);
  if (moduleCache.has(absPath)) {
    return moduleCache.get(absPath).exports;
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: absPath,
  });

  const mod = { exports: {} };
  moduleCache.set(absPath, mod);

  const localRequire = (specifier) => {
    if (specifier.startsWith('@/')) {
      return loadTsModule(path.join(frontendRoot, 'src', `${specifier.slice(2)}.ts`));
    }
    if (specifier.startsWith('.')) {
      const candidate = path.resolve(path.dirname(absPath), specifier);
      const resolved = fs.existsSync(`${candidate}.ts`) ? `${candidate}.ts` : candidate;
      return loadTsModule(resolved);
    }
    return require(specifier);
  };

  const wrapped = `(function(exports, require, module, __filename, __dirname) {\n${outputText}\n})`;
  const fn = vm.runInThisContext(wrapped, { filename: absPath });
  fn(mod.exports, localRequire, mod, absPath, path.dirname(absPath));
  return mod.exports;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatW3cDatetime(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const fileModCache = new Map();

function getFileLastModMs(relPath) {
  const normRel = relPath.replace(/\\/g, '/');
  if (fileModCache.has(normRel)) {
    return fileModCache.get(normRel);
  }

  const absPath = path.join(frontendRoot, normRel);
  let resolvedMs = null;

  try {
    const statusOut = execFileSync(
      'git',
      ['status', '--porcelain', '--', normRel],
      { cwd: frontendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();

    if (!statusOut) {
      const gitIso = execFileSync(
        'git',
        ['log', '-1', '--format=%cI', '--', normRel],
        { cwd: frontendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (gitIso) {
        const parsed = Date.parse(gitIso);
        if (Number.isFinite(parsed)) {
          resolvedMs = parsed;
        }
      }
    }
  } catch {
    // Fallback to file mtime when git is unavailable
  }

  if (resolvedMs === null) {
    try {
      resolvedMs = fs.statSync(absPath).mtimeMs;
    } catch {
      resolvedMs = Date.now();
    }
  }

  fileModCache.set(normRel, resolvedMs);
  return resolvedMs;
}

function getLatestLastMod(relPaths) {
  let maxMs = 0;
  for (const relPath of relPaths) {
    const ms = getFileLastModMs(relPath);
    if (ms > maxMs) maxMs = ms;
  }
  return formatW3cDatetime(maxMs || Date.now());
}

const { SITE_URL, SITE_ROOT_URL } = loadTsModule(
  path.join(frontendRoot, 'src', 'lib', 'site.ts')
);
const { POPULAR_SEO_PAIRS, getConverterDirectoryGroups } = loadTsModule(
  path.join(frontendRoot, 'src', 'lib', 'seoData.ts')
);
const { TOOL_ROUTES } = loadTsModule(
  path.join(frontendRoot, 'src', 'lib', 'toolsConfig.ts')
);
const { BLOG_POSTS } = loadTsModule(
  path.join(frontendRoot, 'src', 'lib', 'blogData.ts')
);

const popularSlugs = new Set(POPULAR_SEO_PAIRS.map((p) => p.slug));
const seenLocs = new Set();

function registerUniqueLoc(loc) {
  if (seenLocs.has(loc)) {
    throw new Error(`Duplicate sitemap URL detected: ${loc}`);
  }
  seenLocs.add(loc);
}

const pageSources = {
  home: ['src/app/page.tsx', 'src/components/HomeClient.tsx', 'src/app/layout.tsx'],
  convertIndex: ['src/app/convert/page.tsx', 'src/lib/seoData.ts', 'src/lib/formatRegistry.ts'],
  sitemapPage: ['src/app/sitemap/page.tsx', 'src/lib/seoData.ts', 'src/lib/toolsConfig.ts'],
  share: ['src/app/share/page.tsx', 'src/components/FileHostTool.tsx', 'src/lib/toolsConfig.ts'],
  loadTester: ['src/app/http-benchmark/page.tsx', 'src/components/LoadTester.tsx', 'src/lib/toolsConfig.ts'],
  myIp: ['src/app/ip-lookup/page.tsx', 'src/components/MyIpTool.tsx', 'src/lib/toolsConfig.ts'],
  daChecker: ['src/app/domain-audit/page.tsx', 'src/components/DaChecker.tsx', 'src/lib/toolsConfig.ts'],
  contact: ['src/app/contact/page.tsx', 'src/components/LegalPageShell.tsx'],
  privacy: ['src/app/privacy/page.tsx', 'src/components/LegalPageShell.tsx'],
  terms: ['src/app/terms/page.tsx', 'src/components/LegalPageShell.tsx'],
  blogIndex: ['src/app/blog/page.tsx', 'src/components/BlogIndexClient.tsx', 'src/lib/blogData.ts'],
  blogArticle: ['src/app/blog/[slug]/page.tsx', 'src/components/BlogArticleView.tsx', 'src/components/BlogDiagrams.tsx', 'src/lib/blogData.ts'],
  converterSlug: [
    'src/app/convert/[slug]/page.tsx',
    'src/app/convert/[slug]/ConvertClient.tsx',
    'src/lib/seoData.ts',
    'src/lib/formatRegistry.ts',
  ],
};

const pagesEntries = [
  {
    loc: SITE_ROOT_URL,
    lastmod: getLatestLastMod(pageSources.home),
    changefreq: 'weekly',
    priority: '1.0',
    images: [{ loc: `${SITE_URL}/icon-512.png`, title: 'Tulusy Brand Logo' }],
  },
  {
    loc: `${SITE_URL}/convert`,
    lastmod: getLatestLastMod(pageSources.convertIndex),
    changefreq: 'weekly',
    priority: '0.9',
    images: [],
  },
  {
    loc: `${SITE_URL}${TOOL_ROUTES['file-host'].href}`,
    lastmod: getLatestLastMod(pageSources.share),
    changefreq: 'weekly',
    priority: '0.9',
    images: [],
  },
  {
    loc: `${SITE_URL}${TOOL_ROUTES['load-tester'].href}`,
    lastmod: getLatestLastMod(pageSources.loadTester),
    changefreq: 'weekly',
    priority: '0.85',
    images: [],
  },
  {
    loc: `${SITE_URL}${TOOL_ROUTES['my-ip'].href}`,
    lastmod: getLatestLastMod(pageSources.myIp),
    changefreq: 'weekly',
    priority: '0.85',
    images: [],
  },
  {
    loc: `${SITE_URL}${TOOL_ROUTES['da-checker'].href}`,
    lastmod: getLatestLastMod(pageSources.daChecker),
    changefreq: 'weekly',
    priority: '0.85',
    images: [],
  },
  {
    loc: `${SITE_URL}/sitemap`,
    lastmod: getLatestLastMod(pageSources.sitemapPage),
    changefreq: 'weekly',
    priority: '0.6',
    images: [],
  },
  {
    loc: `${SITE_URL}/contact`,
    lastmod: getLatestLastMod(pageSources.contact),
    changefreq: 'yearly',
    priority: '0.4',
    images: [],
  },
  {
    loc: `${SITE_URL}/privacy`,
    lastmod: getLatestLastMod(pageSources.privacy),
    changefreq: 'yearly',
    priority: '0.4',
    images: [],
  },
  {
    loc: `${SITE_URL}/terms`,
    lastmod: getLatestLastMod(pageSources.terms),
    changefreq: 'yearly',
    priority: '0.4',
    images: [],
  },
];

const converterLastMod = getLatestLastMod(pageSources.converterSlug);
const groups = getConverterDirectoryGroups();
const groupById = new Map(groups.map((g) => [g.id, g]));

function sortPairs(pairs) {
  return [...pairs].sort((a, b) => {
    const aPop = popularSlugs.has(a.slug);
    const bPop = popularSlugs.has(b.slug);
    if (aPop !== bPop) return aPop ? -1 : 1;
    return a.slug.localeCompare(b.slug);
  });
}

function buildConverterEntries(pairs, defaultPriority) {
  return sortPairs(pairs).map((pair) => {
    const isPopular = popularSlugs.has(pair.slug);
    return {
      loc: `${SITE_URL}/convert/${pair.slug}`,
      lastmod: converterLastMod,
      changefreq: isPopular ? 'weekly' : 'monthly',
      priority: isPopular ? '0.9' : defaultPriority,
      images: [],
    };
  });
}

const blogArticleLastMod = getLatestLastMod(pageSources.blogArticle);
const blogEntries = [
  {
    loc: `${SITE_URL}/blog`,
    lastmod: getLatestLastMod(pageSources.blogIndex),
    changefreq: 'weekly',
    priority: '0.85',
    images: [],
  },
  ...BLOG_POSTS.map((post) => ({
    loc: `${SITE_URL}/blog/${post.slug}`,
    lastmod: blogArticleLastMod,
    changefreq: 'monthly',
    priority: '0.8',
    images: [],
  })),
];

const subSitemaps = [
  {
    filename: 'pages.xml',
    entries: pagesEntries,
    hasImages: true,
  },
  {
    filename: 'blog.xml',
    entries: blogEntries,
    hasImages: false,
  },
  {
    filename: 'pdf-converters.xml',
    entries: buildConverterEntries(groupById.get('pdf')?.pairs || [], '0.8'),
    hasImages: false,
  },
  {
    filename: 'document-converters.xml',
    entries: buildConverterEntries(groupById.get('documents')?.pairs || [], '0.8'),
    hasImages: false,
  },
  {
    filename: 'image-converters.xml',
    entries: buildConverterEntries(groupById.get('images')?.pairs || [], '0.7'),
    hasImages: false,
  },
];

for (const sub of subSitemaps) {
  for (const entry of sub.entries) {
    registerUniqueLoc(entry.loc);
  }
}

function renderUrlsetXml(entries, includeImageNamespace) {
  const rootAttrs = includeImageNamespace
    ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

  const body = entries
    .map((entry) => {
      const imageLines = (entry.images || []).flatMap((img) => [
        '    <image:image>',
        `      <image:loc>${escapeXml(img.loc)}</image:loc>`,
        `      <image:title>${escapeXml(img.title)}</image:title>`,
        '    </image:image>',
      ]);

      return [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        `    <lastmod>${entry.lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        ...imageLines,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    `<urlset ${rootAttrs}>`,
    body,
    '</urlset>',
    '',
  ].join('\n');
}

const publicDir = path.join(frontendRoot, 'public');
const sitemapsDir = path.join(publicDir, 'sitemaps');
fs.mkdirSync(sitemapsDir, { recursive: true });

// Remove any stale generated sub-sitemap XML files before writing current set
for (const existing of fs.readdirSync(sitemapsDir)) {
  if (existing.endsWith('.xml')) {
    fs.unlinkSync(path.join(sitemapsDir, existing));
  }
}

const indexItems = [];
let totalUrls = 0;

for (const sub of subSitemaps) {
  const xml = renderUrlsetXml(sub.entries, sub.hasImages);
  fs.writeFileSync(path.join(sitemapsDir, sub.filename), xml, 'utf8');

  const maxLastMod = sub.entries.reduce(
    (latest, e) => (e.lastmod > latest ? e.lastmod : latest),
    ''
  );
  indexItems.push({
    loc: `${SITE_URL}/sitemaps/${sub.filename}`,
    lastmod: maxLastMod || formatW3cDatetime(Date.now()),
    count: sub.entries.length,
    filename: sub.filename,
  });
  totalUrls += sub.entries.length;
}

const sitemapIndexXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexItems.map((item) =>
    [
      '  <sitemap>',
      `    <loc>${escapeXml(item.loc)}</loc>`,
      `    <lastmod>${item.lastmod}</lastmod>`,
      '  </sitemap>',
    ].join('\n')
  ),
  '</sitemapindex>',
  '',
].join('\n');

const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  'Disallow: /f/',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  '',
].join('\n');

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');

const breakdown = indexItems.map((i) => `${i.filename}:${i.count}`).join(', ');
console.log(
  `Generated sitemap index (${indexItems.length} sub-sitemaps, ${totalUrls} total URLs: ${breakdown}) and public/robots.txt for ${SITE_URL}`
);
