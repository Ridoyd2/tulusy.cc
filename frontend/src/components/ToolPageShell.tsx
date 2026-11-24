import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollToTopOnMount } from './ScrollToTopOnMount';
import { ToolFaqAccordion } from './ToolFaqAccordion';
import { getAllSEOSlugs } from '@/lib/seoData';
import { safeJsonLd, SITE_URL } from '@/lib/site';
import { DEDICATED_TOOL_IDS, IndexableToolId, TOOL_ROUTES } from '@/lib/toolsConfig';

const TOTAL_CONVERTERS = getAllSEOSlugs().length;

interface ToolPageShellProps {
  toolId: IndexableToolId;
  children: React.ReactNode;
}

export const ToolPageShell: React.FC<ToolPageShellProps> = ({ toolId, children }) => {
  const tool = TOOL_ROUTES[toolId];
  const canonicalUrl = `${SITE_URL}${tool.href}`;
  const otherTools = DEDICATED_TOOL_IDS.filter(id => id !== toolId).map(id => TOOL_ROUTES[id]);

  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `Tulusy ${tool.navLabel}`,
    url: canonicalUrl,
    applicationCategory: tool.appCategory,
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: tool.description,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tool.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
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
        name: tool.navLabel,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />

      <div className="min-h-screen flex flex-col">
        <ScrollToTopOnMount />
        <Navbar activeTool={toolId} />

        <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-7 sm:pt-10 pb-12 sm:pb-16 space-y-10">
          {children}

          <ToolFaqAccordion faqs={tool.faqs} />

          <section className="space-y-3.5 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                More Free Utilities
              </h2>
              <Link
                href="/convert"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>All {TOTAL_CONVERTERS}+ Converters</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {otherTools.map(other => (
                <Link
                  key={other.id}
                  href={other.href}
                  className="p-3.5 rounded-xl panel panel-hover flex items-center justify-between gap-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <span>{other.footerLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};
