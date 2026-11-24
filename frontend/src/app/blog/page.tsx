import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTopOnMount } from '@/components/ScrollToTopOnMount';
import { BlogIndexClient } from '@/components/BlogIndexClient';
import { BLOG_POSTS } from '@/lib/blogData';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';
import { buildSeoMetadata } from '@/lib/toolsConfig';

const blogTitle = 'Tulusy Blog - Why Tulusy Beats Traditional File Hosting';
const blogDescription =
  'Deep dives and honest comparisons showing why Tulusy File Share outperforms legacy file hosts, email attachments, chat apps, and cloud drives with 5GB uploads, Forever (7d idle) hosting, and zero IP tracking.';

export const metadata = buildSeoMetadata({
  title: blogTitle,
  description: blogDescription,
  path: '/blog',
  keywords: [
    'tulusy blog',
    'best free file hosting service',
    'tulusy vs cloud drives',
    'forever 7 day idle file hosting',
    'send large files without signup',
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
              Quick reads on sending big files without signups, blurry compression, or dead links.
            </p>
          </header>

          <BlogIndexClient posts={BLOG_POSTS} />
        </main>

        <Footer />
      </div>
    </>
  );
}
