import Link from 'next/link';
import { ArrowRight, FileCode2, FolderTree, Globe, Wrench } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getConverterDirectoryGroups } from '@/lib/seoData';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';
import { buildSeoMetadata, TOOL_LIST } from '@/lib/toolsConfig';

export const metadata = buildSeoMetadata({
  title: 'Sitemap - All Tools & File Converters',
  description:
    'Explore every free file converter, 5GB anonymous file share, web utility, and policy page on Tulusy.',
  path: '/sitemap',
  card: 'summary',
});

export default function HtmlSitemapPage() {
  const groups = getConverterDirectoryGroups();
  const totalConverters = groups.reduce((sum, g) => sum + g.pairs.length, 0);

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Tulusy Sitemap - All Tools & File Converters',
    description:
      'Explore every free file converter, 5GB anonymous file share, web utility, and policy page on Tulusy.',
    url: `${SITE_URL}/sitemap`,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_ROOT_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Sitemap',
        item: `${SITE_URL}/sitemap`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />

      <div className="min-h-screen flex flex-col">
        <Navbar activeTool={null} />

        <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16 space-y-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">Sitemap</span>
          </nav>

          <header className="space-y-2.5 border-b border-slate-200 dark:border-slate-800 pb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sitemap
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Complete index of all {totalConverters} format converters, privacy-first web utilities, legal policies, and XML sitemap feeds on Tulusy.
            </p>
          </header>

          {/* Core Utilities */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              <span>Core Tools &amp; Directories</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TOOL_LIST.map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="p-3.5 rounded-xl panel panel-hover flex items-center justify-between gap-2 text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  <span>{tool.footerLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>
              ))}
              <Link
                href="/convert"
                className="p-3.5 rounded-xl panel panel-hover flex items-center justify-between gap-2 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <span>All Converters Directory ({totalConverters})</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>
            </div>
          </section>

          {/* Categorized Converters */}
          {groups.map((group) => (
            <section key={group.id} className="space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5 flex items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-slate-400" />
                  <span>{group.title}</span>
                </h2>
                <span className="text-xs font-mono text-slate-500">{group.pairs.length} URLs</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {group.pairs.map((pair) => (
                  <Link
                    key={pair.slug}
                    href={`/convert/${pair.slug}`}
                    className="p-2.5 rounded-lg panel panel-hover flex items-center justify-between gap-2 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <span className="truncate">
                      {pair.source.toUpperCase()} → {pair.target.toUpperCase()}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* Legal & Machine-Readable Sitemaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <section className="space-y-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                <span>Information &amp; Legal Pages</span>
              </h2>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Contact &amp; DMCA Abuse Support (/contact)
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Privacy Policy (/privacy)
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Terms of Service (/terms)
                  </Link>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-slate-400" />
                <span>Machine-Readable XML Sitemaps &amp; Crawl Policy</span>
              </h2>
              <ul className="space-y-2 text-xs font-mono">
                <li>
                  <a href="/sitemap.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /sitemap.xml (Sitemap Index)
                  </a>
                </li>
                <li>
                  <a href="/sitemaps/pages.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /sitemaps/pages.xml (Core &amp; Legal)
                  </a>
                </li>
                <li>
                  <a href="/sitemaps/pdf-converters.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /sitemaps/pdf-converters.xml
                  </a>
                </li>
                <li>
                  <a href="/sitemaps/document-converters.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /sitemaps/document-converters.xml
                  </a>
                </li>
                <li>
                  <a href="/sitemaps/image-converters.xml" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /sitemaps/image-converters.xml
                  </a>
                </li>
                <li>
                  <a href="/robots.txt" className="text-blue-600 dark:text-blue-400 hover:underline">
                    /robots.txt
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
