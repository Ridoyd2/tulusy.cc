import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_ROOT_URL,
  },
};

export default function HomePage() {
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Tulusy Universal File Converter',
    url: SITE_ROOT_URL,
    applicationCategory: 'UtilitiesApplication',
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
    description:
      'Free online converter across 40 formats including images, Camera RAW, PDFs, Office docs, Markdown, HTML, EPUB, JSON, YAML, XML, and CSV with zero retention.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webAppSchema) }}
      />
      <HomeClient />
    </>
  );
}
