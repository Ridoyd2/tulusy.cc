'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Sun,
  Moon,
  Activity,
  Globe,
  ShieldCheck,
  HardDriveUpload
} from 'lucide-react';
import { TulusyLogo } from './TulusyLogo';

export type ActiveTool = 'converter' | 'load-tester' | 'my-ip' | 'da-checker' | 'file-host';

interface NavbarProps {
  activeTool?: ActiveTool;
  onSelectTool?: (tool: ActiveTool) => void;
  onSelectQuickFilter?: (format: string, accept?: string, source?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTool = 'converter',
  onSelectTool,
  onSelectQuickFilter,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  const navTools: { id: ActiveTool; label: string; icon: React.ReactNode }[] = [
    { id: 'converter', label: 'Converter', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    { id: 'file-host', label: 'File Share', icon: <HardDriveUpload className="w-3.5 h-3.5" /> },
    { id: 'load-tester', label: 'HTTP Benchmark', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'my-ip', label: 'IP Inspector', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'da-checker', label: 'Domain Audit', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  const handleToolClick = (toolId: ActiveTool) => {
    if (onSelectTool) {
      onSelectTool(toolId);
    } else if (typeof window !== 'undefined') {
      window.location.href = toolId === 'converter' ? '/' : `/?tool=${toolId}`;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => handleToolClick('converter')}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0 text-left"
          >
            <TulusyLogo className="w-7 h-7 shrink-0" />
            <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              Tulusy
            </span>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/70 dark:border-slate-800 overflow-x-auto no-scrollbar">
            {navTools.map(tool => {
              const isActive = activeTool === tool.id && Boolean(onSelectTool);
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleToolClick(tool.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs border border-slate-200/60 dark:border-slate-700/80'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title={mounted ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode` : 'Toggle Theme'}
            aria-label="Toggle color theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Format Shortcuts Bar - Shown on Converter Tab when handler is provided */}
        {activeTool === 'converter' && onSelectQuickFilter && (
          <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-t border-slate-100 dark:border-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <span className="text-slate-400 dark:text-slate-500 mr-1 shrink-0 font-medium">Popular:</span>
            {[
              { src: 'png', fmt: 'webp', accept: 'image/*,.heic,.psd,.tga', label: 'Image → WebP' },
              { src: 'pdf', fmt: 'docx', accept: '.pdf,application/pdf', label: 'PDF → Word' },
              { src: 'pdf', fmt: 'pptx', accept: '.pdf,application/pdf', label: 'PDF → PPTX' },
              { src: 'xlsx', fmt: 'pdf', accept: '.xlsx,.xls,.csv', label: 'Spreadsheet → PDF' },
              { src: 'png', fmt: 'ico', accept: 'image/*', label: 'PNG → ICO' },
              { src: 'png', fmt: 'pdf', accept: 'image/*', label: 'Images → PDF' },
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
