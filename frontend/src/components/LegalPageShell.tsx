import React from 'react';
import Link from 'next/link';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SITE_URL } from '@/lib/site';

interface LegalPageShellProps {
  title: string;
  subtitle: string;
  path: string;
  breadcrumbName: string;
  children: React.ReactNode;
}

export const LegalPageShell: React.FC<LegalPageShellProps> = ({
  title,
  subtitle,
  path,
  breadcrumbName,
  children,
}) => {
  const canonicalUrl = `${SITE_URL}${path}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbName,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen flex flex-col">
        <Navbar activeTool={null} />

        <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-14 sm:pb-16 space-y-8">
          <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{breadcrumbName}</span>
          </nav>

          <header className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {subtitle}
            </p>
          </header>

          <div className="space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {children}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};
