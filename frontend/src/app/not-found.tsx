import type { Metadata } from 'next';
import Link from 'next/link';
import { FileQuestion, ArrowRight, Home } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: { absolute: 'Page Not Found | Tulusy' },
  description: 'The requested page could not be found on Tulusy.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: 'Page Not Found | Tulusy',
    description: 'The requested page could not be found on Tulusy.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Page Not Found | Tulusy',
    description: 'The requested page could not be found on Tulusy.',
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar activeTool={null} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-16 sm:py-24 flex flex-col justify-center">
        <div className="panel rounded-xl p-8 sm:p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center mx-auto">
            <FileQuestion className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-slate-400">
              HTTP 404
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              The URL you requested does not exist or may have moved. Choose a converter or return to the homepage below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Go to Converter</span>
            </Link>
            <Link
              href="/convert"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Browse All Converters</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
