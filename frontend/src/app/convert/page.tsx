import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getConverterDirectoryGroups, getAllSEOSlugs } from '@/lib/seoData';
import { SITE_URL } from '@/lib/site';

const totalPairs = getAllSEOSlugs().length;
const directoryTitle = `All File Converters - ${totalPairs}+ Free Tools`;
const directoryDescription = `Browse ${totalPairs}+ free online file converters on Tulusy. Convert PDFs, Word, Excel, PowerPoint, images, icons, and vectors with zero retention.`;

export const metadata: Metadata = {
  title: directoryTitle,
  description: directoryDescription,
  keywords: [
    'online file converters',
    'free format converter directory',
    'pdf converter tools',
    'image converter tools',
    'document converter list',
  ],
  alternates: {
    canonical: `${SITE_URL}/convert`,
  },
  openGraph: {
    title: `${directoryTitle} | Tulusy`,
    description: directoryDescription,
    url: `${SITE_URL}/convert`,
    siteName: 'Tulusy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${directoryTitle} | Tulusy`,
    description: directoryDescription,
  },
};

export default function ConvertDirectoryPage() {
  const groups = getConverterDirectoryGroups();

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: directoryTitle,
    description: directoryDescription,
    url: `${SITE_URL}/convert`,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Convert',
        item: `${SITE_URL}/convert`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen flex flex-col">
        <Navbar activeTool="converter" />

        <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16 space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <span>{totalPairs} Supported Conversion Pairs</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              All File Converters
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Pick any source-to-target conversion workflow below. Every tool runs with ephemeral processing, zero registration, and zero file retention.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {groups.map(group => (
                <a
                  key={group.id}
                  href={`#${group.id}`}
                  className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {group.title} ({group.pairs.length})
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-10">
            {groups.map(group => (
              <section key={group.id} id={group.id} className="space-y-4 scroll-mt-20">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    {group.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {group.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {group.pairs.map(pair => (
                    <Link
                      key={pair.slug}
                      href={`/convert/${pair.slug}`}
                      className="p-3 rounded-xl panel panel-hover flex items-center justify-between gap-2 text-xs font-mono font-medium text-slate-800 dark:text-slate-200"
                    >
                      <span className="truncate">
                        {pair.source.toUpperCase()} → {pair.target.toUpperCase()}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
