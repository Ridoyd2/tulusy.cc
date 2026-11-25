import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTopOnMount } from '@/components/ScrollToTopOnMount';
import { BlogIndexClient } from '@/components/BlogIndexClient';
import { BLOG_POSTS } from '@/lib/blogData';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';
import { buildSeoMetadata } from '@/lib/toolsConfig';

const blogTitle = 'Tulusy Blog - File Converter Guides & Anonymous Sharing';
const blogDescription =
  'Practical guides to JPEG XL, Camera RAW (CR2/CR3/NEF/ARW/DNG), Markdown, EPUB, JSON/YAML/XML conversions, plus 5GB anonymous file sharing without quotas or IP tracking.';

export const metadata = buildSeoMetadata({
  title: blogTitle,
  description: blogDescription,
  path: '/blog',
  keywords: [
    'tulusy blog',
    'jpeg xl avif webp guide',
    'camera raw cr3 nef dng converter guide',
    'markdown epub json yaml converter',
    'best free file hosting service',
    'anonymous 5gb file transfer',
  ],
  card: 'summary',
});

export default function BlogIndexPage() {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: blogTitle,
    description: blogDescription,
    url: `${SITE_URL}/blog`,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    blogPost: BLOG_POSTS.map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      url: `${SITE_URL}/blog/${post.slug}`,
      author: {
        '@id': `${SITE_URL}/#organization`,
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
        item: SITE_ROOT_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />

      <div className="min-h-screen flex flex-col">
        <ScrollToTopOnMount />
        <Navbar activeTool="blog" />

        <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16 space-y-8">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">Blog</span>
          </nav>

          <header className="space-y-2.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Blog
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Practical guides on modern image &amp; Camera RAW formats, markup &amp; data conversions, and sending big files without signups or dead links.
            </p>
          </header>

          <BlogIndexClient posts={BLOG_POSTS} />
        </main>

        <Footer />
      </div>
    </>
  );
}
