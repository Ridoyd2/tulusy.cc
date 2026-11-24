'use client';

import React from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { ActiveTool, TOOL_LIST } from '@/lib/toolsConfig';
import { TulusyLogo } from './TulusyLogo';
import { CONTACT_EMAIL, SITE_DOMAIN } from '../lib/site';

interface FooterProps {
  onSelectTool?: (tool: ActiveTool) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTool }) => {
  const popularPairs = [
    { href: '/convert/png-to-webp', label: 'PNG to WebP' },
    { href: '/convert/pdf-to-docx', label: 'PDF to DOCX' },
    { href: '/convert/pdf-to-pptx', label: 'PDF to PPTX' },
    { href: '/convert/excel-to-pdf', label: 'Excel to PDF' },
    { href: '/convert/heic-to-jpg', label: 'HEIC to JPG' },
    { href: '/convert', label: 'All Converters →' },
  ];

  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-slate-800/80 mt-16 bg-white dark:bg-[#090d16] text-slate-600 dark:text-slate-400">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
        {/* Main Grid: Brand + Tools + Conversions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <TulusyLogo className="w-7 h-7 shrink-0" />
              <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                Tulusy
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Universal file conversion engine and anonymous 5GB file sharing. Ephemeral storage with zero retention and no IP logging.
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Zero tracking · Encrypted R2 &amp; ephemeral storage</span>
            </div>
          </div>

          {/* Tools Column */}
          <nav aria-label="Tools" className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Tools
            </p>
            <ul className="space-y-2 text-xs">
              {TOOL_LIST.map(tool => (
                <li key={tool.id}>
                  <Link
                    href={tool.href}
                    onClick={() => {
                      if (onSelectTool) {
                        onSelectTool(tool.id);
                      }
                    }}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {tool.footerLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Popular Conversions Column */}
          <nav aria-label="Popular Conversions" className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Conversions
            </p>
            <ul className="space-y-2 text-xs">
              {popularPairs.map(p => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom Sub-footer */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <p suppressHydrationWarning>© {new Date().getFullYear()} Tulusy. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/sitemap" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Sitemap
            </Link>
            <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Contact / DMCA
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-mono hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            <span className="font-mono hidden sm:inline">· {SITE_DOMAIN}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
