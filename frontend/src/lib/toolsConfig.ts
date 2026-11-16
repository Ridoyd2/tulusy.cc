import type { Metadata } from 'next';
import { SITE_URL } from './site';

export type ActiveTool = 'converter' | 'file-host' | 'load-tester' | 'my-ip' | 'da-checker';

export type IndexableToolId = Exclude<ActiveTool, 'converter'>;

export interface ToolRouteConfig {
  id: ActiveTool;
  href: string;
  navLabel: string;
  footerLabel: string;
  title: string;
  description: string;
  keywords: string[];
  appCategory: string;
  faqs: { q: string; a: string }[];
  priority: number;
}

export const TOOL_ROUTES: Record<ActiveTool, ToolRouteConfig> = {
  converter: {
    id: 'converter',
    href: '/',
    navLabel: 'Converter',
    footerLabel: 'File Converter',
    title: 'Tulusy - Free Universal File Converter & 5GB Anonymous Drop',
    description:
      'Free online converter for images, PDFs, documents, and spreadsheets, plus secure 5GB anonymous file sharing. Fast, privacy-first, zero tracking.',
    keywords: [
      'file converter',
      'image converter',
      'pdf to word',
      'png to webp',
      'heic to jpg',
      'excel to pdf',
    ],
    appCategory: 'UtilitiesApplication',
    faqs: [],
    priority: 1.0,
  },
  'file-host': {
    id: 'file-host',
    href: '/share',
    navLabel: 'File Share',
    footerLabel: 'File Share (5GB)',
    title: '5GB Anonymous File Share - Ephemeral Encrypted Drop without Signup',
    description:
      'Send files up to 5GB anonymously with zero registration and auto-expiring links. Direct-to-edge R2 multipart uploads, burn-after-download options, and delete tokens.',
    keywords: [
      '5gb file share',
      'anonymous file upload',
      'send large files free without signup',
      'burn after reading file share',
      'ephemeral file hosting',
    ],
    appCategory: 'UtilitiesApplication',
    faqs: [
      {
        q: 'How large of a file can I share without creating an account?',
        a: 'You can upload and share files up to 5GB completely anonymously without signing up. Large uploads stream directly to Cloudflare R2 via presigned multipart URLs.',
      },
      {
        q: 'How long are shared files stored before automatic deletion?',
        a: 'You can choose an expiration window from 1 hour up to 7 days, or configure download-count limits and burn-after-download using your generated delete token.',
      },
      {
        q: 'Do you log uploader IP addresses or track recipients?',
        a: 'No. File Share stores zero uploader IP logs and serves private download pages excluded from search indexing so transfer links stay confidential.',
      },
    ],
    priority: 0.9,
  },
  'load-tester': {
    id: 'load-tester',
    href: '/http-benchmark',
    navLabel: 'HTTP Benchmark',
    footerLabel: 'HTTP Benchmark',
    title: 'Online HTTP Benchmark & Load Tester - API Latency & Throughput',
    description:
      'Benchmark websites and REST APIs online for free. Measure TTFB, p50/p95/p99 latency, status codes, and concurrent throughput via Edge Relay or Browser Mode.',
    keywords: [
      'online http load tester',
      'api stress test online',
      'website benchmark tool',
      'http latency tester',
      'endpoint load testing tool',
    ],
    appCategory: 'DeveloperApplication',
    faqs: [
      {
        q: 'How does Edge Relay vs Client Browser Mode work?',
        a: 'Edge Relay dispatches benchmark requests through a serverless worker relay without exposing origin server IPs, while Client Browser Mode runs HTTP/fetch concurrency checks directly from your browser.',
      },
      {
        q: 'What metrics does the HTTP Benchmark report?',
        a: 'You get success/failure counts, requests per second, min/avg/max latency, p95 response times, and HTTP status breakdowns.',
      },
    ],
    priority: 0.85,
  },
  'my-ip': {
    id: 'my-ip',
    href: '/ip-lookup',
    navLabel: 'IP Inspector',
    footerLabel: 'IP Inspector',
    title: 'IP Inspector - Public IPv4/IPv6, ASN, Geolocation & HTTP Headers',
    description:
      'Instantly inspect your public IP address or look up any IPv4/IPv6 host. View ISP, ASN, geolocation, proxy headers, and full incoming HTTP request headers.',
    keywords: [
      'what is my ip',
      'ip asn lookup',
      'check http request headers online',
      'public ipv4 ipv6 lookup',
      'ip geolocation inspector',
    ],
    appCategory: 'DeveloperApplication',
    faqs: [
      {
        q: 'What information does IP Inspector show?',
        a: 'IP Inspector displays the resolved IPv4 or IPv6 address, ASN, ISP/organization, country/city geolocation, and the exact User-Agent and forwarding headers received.',
      },
      {
        q: 'Can I inspect a different IP address besides my own?',
        a: 'Yes. Enter any valid public IPv4 or IPv6 address into the lookup bar to check its ASN, network ownership, and geographic metadata.',
      },
    ],
    priority: 0.85,
  },
  'da-checker': {
    id: 'da-checker',
    href: '/domain-audit',
    navLabel: 'Domain Audit',
    footerLabel: 'Domain Audit',
    title: 'Domain Audit - Free SSL, Security Headers & Technical SEO Checker',
    description:
      'Run a fast technical SEO and security audit on any domain. Check SSL certificate validity, HTTP security headers, robots.txt, sitemap.xml, canonical tags, and page health.',
    keywords: [
      'technical seo audit tool',
      'ssl security header checker',
      'robots txt sitemap checker',
      'domain authority checker',
      'website seo analyzer',
    ],
    appCategory: 'DeveloperApplication',
    faqs: [
      {
        q: 'What does Domain Audit check?',
        a: 'It inspects DNS A records, TLS/SSL validity, HTTP security headers (HSTS, CSP, X-Frame-Options), robots.txt and sitemap.xml availability, canonical tags, headings, and OpenGraph metadata.',
      },
      {
        q: 'Does Domain Audit work on websites behind CDNs?',
        a: 'Yes. It reports the active HTTP protocol, server/CDN headers, response encoding, and TTFB so you can verify edge caching and security posture.',
      },
    ],
    priority: 0.85,
  },
};

export const TOOL_LIST: ToolRouteConfig[] = [
  TOOL_ROUTES.converter,
  TOOL_ROUTES['file-host'],
  TOOL_ROUTES['load-tester'],
  TOOL_ROUTES['my-ip'],
  TOOL_ROUTES['da-checker'],
];

export const DEDICATED_TOOL_IDS: IndexableToolId[] = [
  'file-host',
  'load-tester',
  'my-ip',
  'da-checker',
];

export function getToolHref(tool: ActiveTool): string {
  return TOOL_ROUTES[tool]?.href || '/';
}

export function buildSeoMetadata({
  title,
  description,
  path,
  keywords,
  card = 'summary_large_image',
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  card?: 'summary' | 'summary_large_image';
}): Metadata {
  const canonicalUrl = `${SITE_URL}${path}`;
  const socialTitle = `${title} | Tulusy`;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: canonicalUrl,
      siteName: 'Tulusy',
      type: 'website',
    },
    twitter: {
      card,
      title: socialTitle,
      description,
    },
  };
}

export function buildToolMetadata(toolId: IndexableToolId): Metadata {
  const tool = TOOL_ROUTES[toolId];
  return buildSeoMetadata({
    title: tool.title,
    description: tool.description,
    path: tool.href,
    keywords: tool.keywords,
    card: 'summary_large_image',
  });
}
