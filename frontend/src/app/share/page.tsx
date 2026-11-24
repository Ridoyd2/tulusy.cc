import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FileHostTool } from '@/components/FileHostTool';
import { ToolPageShell } from '@/components/ToolPageShell';
import { BLOG_POSTS } from '@/lib/blogData';
import { buildToolMetadata } from '@/lib/toolsConfig';

export const metadata = buildToolMetadata('file-host');

export default function SharePage() {
  const featuredGuides = BLOG_POSTS.slice(0, 3);

  return (
    <ToolPageShell toolId="file-host">
      <FileHostTool />

      <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
            Why Tulusy Beats Other File Hosts
          </h2>
          <Link
            href="/blog"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>All articles</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {featuredGuides.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group panel panel-hover rounded-xl overflow-hidden flex flex-col"
            >
              <div className="bg-[#090d16] overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt}
                  width={1200}
                  height={675}
                  className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    {post.category} · {post.readTime}
                  </span>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                    {post.shortTitle}
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
    </ToolPageShell>
  );
}
