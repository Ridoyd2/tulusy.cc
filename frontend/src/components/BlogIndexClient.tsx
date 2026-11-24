'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  BLOG_CATEGORIES,
  BlogCategory,
  BlogPost,
  formatBlogDate,
} from '@/lib/blogData';

interface BlogIndexClientProps {
  posts: BlogPost[];
}

export const BlogIndexClient: React.FC<BlogIndexClientProps> = ({ posts }) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | BlogCategory>('All');

  const filteredPosts =
    selectedCategory === 'All'
      ? posts
      : posts.filter(post => post.category === selectedCategory);

  const leadPost = selectedCategory === 'All' ? filteredPosts[0] : undefined;
  const gridPosts = leadPost ? filteredPosts.slice(1) : filteredPosts;

  return (
    <div className="space-y-8">
      {/* Understated Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter articles">
          {(['All', ...BLOG_CATEGORIES] as const).map(cat => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <Link
          href="/share"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>Open 5GB File Share</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Lead Article */}
      {leadPost && (
        <Link
          href={`/blog/${leadPost.slug}`}
          className="group panel panel-hover rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
        >
          <div className="lg:col-span-7 bg-[#090d16] overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
            <Image
              src={leadPost.coverImage}
              alt={leadPost.coverAlt}
              width={1200}
              height={675}
              priority
              className="w-full h-full aspect-video object-cover group-hover:scale-[1.015] transition-transform duration-300"
            />
          </div>

          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span className="text-blue-600 dark:text-blue-400">{leadPost.category}</span>
                <span className="mx-1.5">·</span>
                <span>{formatBlogDate(leadPost.publishedAt)}</span>
                <span className="mx-1.5">·</span>
                <span>{leadPost.readTime}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                {leadPost.title}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {leadPost.description}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <span>Read article</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      )}

      {/* Article Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {gridPosts.map((post, idx) => {
          const isTrailingOdd = gridPosts.length % 2 === 1 && idx === gridPosts.length - 1;
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className={`group panel panel-hover rounded-xl overflow-hidden ${
                isTrailingOdd
                  ? 'md:col-span-2 grid grid-cols-1 md:grid-cols-12'
                  : 'flex flex-col'
              }`}
            >
              <div
                className={`bg-[#090d16] overflow-hidden ${
                  isTrailingOdd
                    ? 'md:col-span-6 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800'
                    : 'border-b border-slate-200 dark:border-slate-800'
                }`}
              >
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt}
                  width={1200}
                  height={675}
                  className="w-full h-full aspect-video object-cover group-hover:scale-[1.015] transition-transform duration-300"
                />
              </div>

              <div
                className={`p-5 sm:p-6 flex flex-col justify-between space-y-4 ${
                  isTrailingOdd ? 'md:col-span-6' : 'flex-1'
                }`}
              >
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="text-blue-600 dark:text-blue-400">{post.category}</span>
                    <span className="mx-1.5">·</span>
                    <span>{formatBlogDate(post.publishedAt)}</span>
                    <span className="mx-1.5">·</span>
                    <span>{post.readTime}</span>
                  </div>

                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                    {post.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {post.description}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <span>Read article</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
