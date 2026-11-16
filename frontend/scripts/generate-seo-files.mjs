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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const { SITE_URL } = loadTsModule(path.join(frontendRoot, 'src', 'lib', 'site.ts'));
const { POPULAR_SEO_PAIRS, getAllSEOSlugs } = loadTsModule(path.join(frontendRoot, 'src', 'lib', 'seoData.ts'));
const { DEDICATED_TOOL_IDS, TOOL_ROUTES } = loadTsModule(path.join(frontendRoot, 'src', 'lib', 'toolsConfig.ts'));

const lastmod = new Date().toISOString();
const popularSlugs = new Set(POPULAR_SEO_PAIRS.map((p) => p.slug));
const allConverterSlugs = getAllSEOSlugs();

const entries = [
  {
    loc: `${SITE_URL}/`,
    lastmod,
    changefreq: 'daily',
    priority: '1.0',
  },
  {
    loc: `${SITE_URL}/convert`,
    lastmod,
    changefreq: 'weekly',
    priority: '0.9',
  },
  ...DEDICATED_TOOL_IDS.map((id) => {
    const tool = TOOL_ROUTES[id];
    const priority = Number.isInteger(tool.priority) ? tool.priority.toFixed(1) : String(tool.priority);
    return {
      loc: `${SITE_URL}${tool.href}`,
      lastmod,
      changefreq: 'weekly',
      priority,
    };
  }),
  ...allConverterSlugs.map((slug) => ({
    loc: `${SITE_URL}/convert/${slug}`,
    lastmod,
    changefreq: 'weekly',
    priority: popularSlugs.has(slug) ? '0.9' : '0.8',
  })),
];

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
  ),
  '</urlset>',
  '',
].join('\n');

const robotsTxt = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  '',
].join('\n');

const publicDir = path.join(frontendRoot, 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');

console.log(`Generated public/sitemap.xml (${entries.length} URLs) and public/robots.txt for ${SITE_URL}`);
