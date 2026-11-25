import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, ArrowRight, HardDriveUpload } from 'lucide-react';
import { BlogBlock, BlogPost, formatBlogDate } from '@/lib/blogData';
import { BlogDiagram } from './BlogDiagrams';
import { ToolFaqAccordion } from './ToolFaqAccordion';

interface BlogArticleViewProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
}

function renderBlock(block: BlogBlock, idx: number) {
  switch (block.type) {
    case 'heading':
      return (
        <h2
          key={idx}
          id={block.id}
          className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white pt-5 scroll-mt-24"
        >
          {block.text}
        </h2>
      );

    case 'subheading':
      return (
        <h3
          key={idx}
          className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white pt-2"
        >
          {block.text}
        </h3>
      );

    case 'paragraph':
      return (
        <p
          key={idx}
          className="text-[15px] sm:text-base text-slate-700 dark:text-slate-300 leading-7"
        >
          {block.text}
        </p>
      );

    case 'list':
      if (block.ordered) {
        return (
          <ol key={idx} className="space-y-4 pl-5 list-decimal marker:text-slate-400 dark:marker:text-slate-500 marker:font-mono marker:text-sm">
            {block.items.map((item, i) => (
              <li key={i} className="text-[15px] sm:text-base text-slate-700 dark:text-slate-300 leading-7 pl-1">
                {item.title && (
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    {item.title}.{' '}
                  </strong>
                )}
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        );
      }

      return (
        <ul key={idx} className="space-y-3.5 pl-5 list-disc marker:text-blue-600 dark:marker:text-blue-400">
          {block.items.map((item, i) => (
            <li key={i} className="text-[15px] sm:text-base text-slate-700 dark:text-slate-300 leading-7 pl-1">
              {item.title && (
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {item.title}:{' '}
                </strong>
              )}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      );

    case 'diagram':
      return <BlogDiagram key={idx} id={block.id} />;

    case 'table':
      return (
        <div key={idx} className="panel rounded-xl overflow-hidden my-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              {block.caption && (
                <caption className="sr-only">{block.caption}</caption>
              )}
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                  {block.headers.map((header, hIdx) => (
                    <th
                      key={hIdx}
                      scope="col"
                      className={`px-4 py-3 font-semibold whitespace-nowrap ${
                        hIdx > 0 && header.toLowerCase().includes('tulusy')
                          ? 'text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {block.rows.map((row, rIdx) => {
                  const isTulusyRow = row[0]?.toLowerCase().includes('tulusy');
                  return (
                    <tr
                      key={rIdx}
                      className={
                        isTulusyRow
                          ? 'bg-blue-50/40 dark:bg-blue-950/25'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-900/40'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-4 py-3 align-top leading-relaxed ${
                            cIdx === 0
                              ? isTulusyRow
                                ? 'font-semibold text-blue-700 dark:text-blue-400'
                                : 'font-medium text-slate-900 dark:text-white'
                              : isTulusyRow ||
                                  (cIdx > 0 && block.headers[cIdx]?.toLowerCase().includes('tulusy'))
                              ? 'font-medium text-slate-900 dark:text-slate-100 bg-blue-50/30 dark:bg-blue-950/15'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'callout':
      return (
        <blockquote
          key={idx}
          className={`border-l-2 pl-4 py-1 my-2 space-y-1 ${
            block.variant === 'tip'
              ? 'border-emerald-600 dark:border-emerald-400'
              : 'border-blue-600 dark:border-blue-400'
          }`}
        >
          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
            {block.title}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {block.text}
          </p>
        </blockquote>
      );

    case 'cta':
      return (
        <div
          key={idx}
          className="panel rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-4"
        >
          <div className="space-y-1 max-w-lg">
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              {block.title}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {block.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href={block.href}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {block.href.startsWith('/share') ? (
                <HardDriveUpload className="w-3.5 h-3.5" />
              ) : (
                <ArrowLeftRight className="w-3.5 h-3.5" />
              )}
              <span>{block.buttonLabel}</span>
            </Link>
            {block.secondaryLabel && block.secondaryHref && (
              <Link
                href={block.secondaryHref}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                {block.secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      );
  }
}

export const BlogArticleView: React.FC<BlogArticleViewProps> = ({
  post,
  relatedPosts,
}) => {
  return (
    <article className="space-y-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
      >
        <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">
          Blog
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
          {post.shortTitle}
        </span>
      </nav>

      {/* Editorial Header */}
      <header className="space-y-4">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="text-blue-600 dark:text-blue-400">{post.category}</span>
          <span className="mx-2">·</span>
          <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
          <span className="mx-2">·</span>
          <span>{post.readTime}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          {post.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
          {post.description}
        </p>

        {/* Hero Cover Illustration */}
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#090d16]">
          <Image
            src={post.coverImage}
            alt={post.coverAlt}
            width={1200}
            height={675}
            priority
            className="w-full aspect-video object-cover"
          />
        </div>
      </header>

      {/* Article Body */}
      <div className="space-y-5">
        {post.blocks.map((block, idx) => renderBlock(block, idx))}
      </div>

      {/* FAQs */}
      <ToolFaqAccordion faqs={post.faqs} />

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              More from the blog
            </h2>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All posts</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedPosts.map(rel => (
              <Link
                key={rel.slug}
                href={`/blog/${rel.slug}`}
                className="group panel panel-hover rounded-xl overflow-hidden flex flex-col"
              >
                <div className="bg-[#090d16] overflow-hidden border-b border-slate-200 dark:border-slate-800">
                  <Image
                    src={rel.coverImage}
                    alt={rel.coverAlt}
                    width={1200}
                    height={675}
                    className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      {rel.category}
                    </span>
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                      {rel.shortTitle}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    <span>Read</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
