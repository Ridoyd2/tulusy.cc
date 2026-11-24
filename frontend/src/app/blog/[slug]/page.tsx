import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTopOnMount } from '@/components/ScrollToTopOnMount';
import { BlogArticleView } from '@/components/BlogArticleView';
import {
  getAllBlogSlugs,
  getBlogPost,
  getRelatedBlogPosts,
} from '@/lib/blogData';
import { safeJsonLd, SITE_ROOT_URL, SITE_URL } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Article Not Found',
      description: 'The requested blog article could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const socialTitle = `${post.title} | Tulusy`;

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: socialTitle,
      description: post.description,
      url: canonicalUrl,
      siteName: 'Tulusy',
      locale: 'en_US',
      type: 'article',
      publishedTime: `${post.publishedAt}T00:00:00Z`,
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description: post.description,
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedBlogPosts(post.slug, 3);
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00Z`,
    dateModified: `${post.publishedAt}T00:00:00Z`,
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    author: {
      '@id': `${SITE_URL}/#organization`,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    keywords: post.keywords.join(', '),
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
      {
        '@type': 'ListItem',
        position: 3,
        name: post.shortTitle,
        item: canonicalUrl,
      },
    ],
  };

  const faqSchema =
    post.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faqs.map(faq => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.a,
            },
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(blogPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
        />
      )}

      <div className="min-h-screen flex flex-col">
        <ScrollToTopOnMount />
        <Navbar activeTool="blog" />

        <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-12 sm:pb-16">
          <BlogArticleView post={post} relatedPosts={relatedPosts} />
        </main>

        <Footer />
      </div>
    </>
  );
}
