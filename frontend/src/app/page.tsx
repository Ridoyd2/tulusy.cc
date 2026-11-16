import type { Metadata } from 'next';
import { HomeClient } from '@/components/HomeClient';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
};

export default function HomePage() {
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Tulusy Universal File Converter',
    url: SITE_URL,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Free online converter for images, PDFs, Word documents, PowerPoint presentations, and Excel spreadsheets with zero file retention.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <HomeClient />
    </>
  );
}
