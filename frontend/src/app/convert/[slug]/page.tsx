import React from 'react';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSEOPair, getAllSEOSlugs } from '@/lib/seoData';
import { supportsImageParameters } from '@/lib/formatRegistry';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';
import { ConvertClient } from './ConvertClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSEOSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const seoData = getSEOPair(slug);

  if (!seoData) {
    return {
      title: 'Converter Not Found',
      description: 'The requested file converter could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const socialTitle = `${seoData.title} | Tulusy`;

  return {
    title: seoData.title,
    description: seoData.description,
    keywords: seoData.keywords,
    alternates: {
      canonical: `${SITE_URL}/convert/${seoData.slug}`,
    },
    openGraph: {
      title: socialTitle,
      description: seoData.description,
      url: `${SITE_URL}/convert/${seoData.slug}`,
      siteName: 'Tulusy',
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description: seoData.description,
    },
  };
}

export default async function ConvertPage({ params }: PageProps) {
  const { slug } = await params;
  const seoData = getSEOPair(slug);

  if (!seoData) {
    notFound();
  }

  if (slug !== seoData.slug) {
    permanentRedirect(`/convert/${seoData.slug}`);
  }

  const DOC_OR_DATA_EXTS = new Set([
    'pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'html', 'rtf', 'epub', 'json', 'yaml', 'xml',
  ]);
  const isDocumentFlow =
    DOC_OR_DATA_EXTS.has(seoData.source) || DOC_OR_DATA_EXTS.has(seoData.target);
  const hasImageParams = supportsImageParameters(seoData.source, seoData.target);

  // 1. WebApplication Schema
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `Tulusy ${seoData.source.toUpperCase()} to ${seoData.target.toUpperCase()} Converter`,
    url: `${SITE_URL}/convert/${seoData.slug}`,
    applicationCategory: isDocumentFlow ? 'UtilitiesApplication' : 'MultimediaApplication',
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
    description: seoData.description,
  };

  // 2. HowTo Schema (Targets Google HowTo rich snippets)
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to convert ${seoData.source.toUpperCase()} to ${seoData.target.toUpperCase()} online for free`,
    description: `Follow these 3 easy steps to convert ${seoData.source.toUpperCase()} files to ${seoData.target.toUpperCase()} with Tulusy.`,
    step: [
      {
        '@type': 'HowToStep',
        name: `Upload your ${seoData.source.toUpperCase()} file`,
        text: `Drag and drop your .${seoData.source.toLowerCase()} file into the converter upload area.`,
        url: `${SITE_URL}/convert/${seoData.slug}#upload`,
      },
      {
        '@type': 'HowToStep',
        name: hasImageParams
          ? 'Choose settings & start conversion'
          : `Convert ${seoData.source.toUpperCase()} to ${seoData.target.toUpperCase()}`,
        text: hasImageParams
          ? 'Optionally customize output quality or dimensions and click "Convert".'
          : `Click "Convert" to transform your .${seoData.source.toLowerCase()} file into .${seoData.target.toLowerCase()} cleanly.`,
        url: `${SITE_URL}/convert/${seoData.slug}#convert`,
      },
      {
        '@type': 'HowToStep',
        name: `Download converted ${seoData.target.toUpperCase()}`,
        text: `Download your newly converted .${seoData.target.toLowerCase()} file instantly to your device.`,
        url: `${SITE_URL}/convert/${seoData.slug}#download`,
      },
    ],
  };

  // 3. FAQPage Schema (Targets Google FAQ rich snippets)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seoData.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  // 4. BreadcrumbList Schema
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
        name: 'Convert',
        item: `${SITE_URL}/convert`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${seoData.source.toUpperCase()} to ${seoData.target.toUpperCase()}`,
        item: `${SITE_URL}/convert/${seoData.slug}`,
      },
    ],
  };

  return (
    <>
      {/* Inject Google Rich Snippets Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />

      <ConvertClient seoData={seoData} />
    </>
  );
}
