'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Sun,
  Moon,
  Activity,
  Globe,
  ShieldCheck,
  HardDriveUpload,
  BookOpen
} from 'lucide-react';
import { TulusyLogo } from './TulusyLogo';
import { ALL_IMAGE_ACCEPT } from '@/lib/formatRegistry';
import { ActiveTool, TOOL_ROUTES } from '@/lib/toolsConfig';

export type { ActiveTool };

function subscribeTheme(callback: () => void) {
  if (typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getThemeSnapshot(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerThemeSnapshot(): 'light' | 'dark' | null {
  return null;
}

interface NavbarProps {
  activeTool?: ActiveTool | 'blog' | null;
  onSelectTool?: (tool: ActiveTool) => void;
  onSelectQuickFilter?: (format: string, accept?: string, source?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTool = 'converter',
  onSelectTool,
  onSelectQuickFilter,
}) => {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const activeEl = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeEl) return;
    const targetLeft = activeEl.offsetLeft - (nav.clientWidth - activeEl.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
  }, [activeTool]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // Ignore storage access errors in private browsing/restricted contexts
    }
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  const navTools: { id: ActiveTool; label: string; href: string; icon: React.ReactNode }[] = [
    { id: 'converter', label: TOOL_ROUTES.converter.navLabel, href: TOOL_ROUTES.converter.href, icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    { id: 'file-host', label: TOOL_ROUTES['file-host'].navLabel, href: TOOL_ROUTES['file-host'].href, icon: <HardDriveUpload className="w-3.5 h-3.5" /> },
    { id: 'load-tester', label: TOOL_ROUTES['load-tester'].navLabel, href: TOOL_ROUTES['load-tester'].href, icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'my-ip', label: TOOL_ROUTES['my-ip'].navLabel, href: TOOL_ROUTES['my-ip'].href, icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'da-checker', label: TOOL_ROUTES['da-checker'].navLabel, href: TOOL_ROUTES['da-checker'].href, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#090d16]/95 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs dark:shadow-slate-950/50 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link
            href="/"
            onClick={() => onSelectTool?.('converter')}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0 text-left"
          >
            <TulusyLogo className="w-7 h-7 shrink-0" />
            <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              Tulusy
            </span>
          </Link>

          {/* Navigation Tabs */}
          <nav
            ref={navRef}
            className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/70 dark:border-slate-800 overflow-x-auto no-scrollbar"
          >
            {navTools.map(tool => {
              const isActive = activeTool === tool.id;
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  data-active={isActive ? 'true' : undefined}
                  onClick={() => onSelectTool?.(tool.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs border border-slate-200/60 dark:border-slate-700/80'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </Link>
              );
            })}
            <Link
              href="/blog"
              data-active={activeTool === 'blog' ? 'true' : undefined}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTool === 'blog'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs border border-slate-200/60 dark:border-slate-700/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Blog</span>
            </Link>
          </nav>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title={theme ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode` : 'Toggle Theme'}
            aria-label="Toggle color theme"
          >
            <Sun className="w-4 h-4 text-amber-400 hidden dark:block" />
            <Moon className="w-4 h-4 block dark:hidden" />
          </button>
        </div>

        {/* Quick Format Shortcuts Bar - Shown on Converter Tab when handler is provided */}
        {activeTool === 'converter' && onSelectQuickFilter && (
          <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <span className="text-slate-400 dark:text-slate-500 mr-1 shrink-0 font-medium">Popular:</span>
            {[
              { src: 'png', fmt: 'webp', accept: ALL_IMAGE_ACCEPT, label: 'Image → WebP' },
              { src: 'pdf', fmt: 'docx', accept: '.pdf,application/pdf', label: 'PDF → Word' },
              { src: 'pdf', fmt: 'pptx', accept: '.pdf,application/pdf', label: 'PDF → PPTX' },
              { src: 'xlsx', fmt: 'pdf', accept: '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv', label: 'Spreadsheet → PDF' },
              { src: 'png', fmt: 'ico', accept: ALL_IMAGE_ACCEPT, label: 'PNG → ICO' },
              { src: 'png', fmt: 'pdf', accept: ALL_IMAGE_ACCEPT, label: 'Images → PDF' },
            ].map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectQuickFilter(preset.fmt, preset.accept, preset.src)}
                className="px-2.5 py-1 rounded-md bg-slate-100/80 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
