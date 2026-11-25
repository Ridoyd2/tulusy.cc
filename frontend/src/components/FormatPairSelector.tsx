'use client';

import React from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { ALL_FORMATS, getCompatibleTargets } from '../lib/formatRegistry';

interface FormatPairSelectorProps {
  sourceFormat: string;
  targetFormat: string;
  onClickSource: () => void;
  onClickTarget: () => void;
  onSwap?: () => void;
}

function FormatGlyph({ ext, className }: { ext: string; className?: string }) {
  const clean = ext.toLowerCase().replace('.', '');
  const isDoc = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'markdown', 'html', 'htm', 'rtf', 'epub'].includes(clean);
  const isSheet = ['xlsx', 'xls', 'csv', 'json', 'yaml', 'yml', 'xml'].includes(clean);

  if (isSheet) {
    return (
      <svg
        viewBox="0 0 36 42"
        fill="none"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 2C3.79086 2 2 3.79086 2 6V36C2 38.2091 3.79086 40 6 40H30C32.2091 40 34 38.2091 34 36V13L23 2H6Z"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 2V12C22 13.1046 22.8954 14 24 14H34"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="8" y="20" width="20" height="13" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
        <line x1="8" y1="26.5" x2="28" y2="26.5" stroke="currentColor" strokeWidth="2.2" />
        <line x1="17" y1="20" x2="17" y2="33" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }

  if (isDoc) {
    return (
      <svg
        viewBox="0 0 36 42"
        fill="none"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 2C3.79086 2 2 3.79086 2 6V36C2 38.2091 3.79086 40 6 40H30C32.2091 40 34 38.2091 34 36V13L23 2H6Z"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 2V12C22 13.1046 22.8954 14 24 14H34"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="9" y1="22" x2="27" y2="22" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="9" y1="28" x2="27" y2="28" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="9" y1="34" x2="20" y2="34" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    );
  }

  // Default Image File Glyph (matches screenshot folded-page + sun + mountain)
  return (
    <svg
      viewBox="0 0 36 42"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 2C3.79086 2 2 3.79086 2 6V36C2 38.2091 3.79086 40 6 40H30C32.2091 40 34 38.2091 34 36V13L23 2H6Z"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 2V12C22 13.1046 22.8954 14 24 14H34"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11.5" cy="22.5" r="2.5" fill="currentColor" />
      <path
        d="M6 35L14.5 26.5L19.5 31.5L24.5 25L30 35H6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const FormatPairSelector: React.FC<FormatPairSelectorProps> = ({
  sourceFormat,
  targetFormat,
  onClickSource,
  onClickTarget,
  onSwap,
}) => {
  const cleanSource = sourceFormat.toLowerCase().replace('.', '');
  const cleanTarget = targetFormat.toLowerCase().replace('.', '');

  // Check if swapping target -> source is a supported conversion
  const canSwap = React.useMemo(() => {
    const targetExists = ALL_FORMATS.some(f => f.ext === cleanTarget);
    if (!targetExists) return false;
    const compatibleForReverse = getCompatibleTargets(cleanTarget);
    return compatibleForReverse.some(f => f.ext === cleanSource);
  }, [cleanSource, cleanTarget]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 py-5 sm:py-6 px-3 sm:px-6 flex items-center justify-center select-none">
      {/* Subtle architectural background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-25 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px]"
      />

      <div className="relative z-10 w-full max-w-md mx-auto flex items-center justify-center gap-2 sm:gap-5">
        {/* LEFT CARD: Source Format */}
        <button
          type="button"
          onClick={onClickSource}
          aria-label={`Source format ${cleanSource.toUpperCase()}. Click to change source format.`}
          className="group relative flex-1 min-w-[76px] max-w-[112px] sm:max-w-[134px] h-[96px] sm:h-[118px] rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs transition-all duration-150 flex flex-col items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
        >
          <FormatGlyph
            ext={cleanSource}
            className="w-6 h-6 sm:w-8 sm:h-8 text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform"
          />
          <span className="text-xs sm:text-base font-bold tracking-wider uppercase font-mono text-slate-900 dark:text-white">
            {cleanSource}
          </span>
          <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 transition-colors" />
        </button>

        {/* CENTER: Swap Button & 'TO' Indicator */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <span className="hidden sm:block w-6 h-[1px] bg-slate-200 dark:bg-slate-800" />

            <button
              type="button"
              onClick={canSwap ? onSwap : undefined}
              disabled={!canSwap}
              title={
                canSwap
                  ? `Swap to ${cleanTarget.toUpperCase()} → ${cleanSource.toUpperCase()}`
                  : `Converting ${cleanTarget.toUpperCase()} to ${cleanSource.toUpperCase()} is not supported`
              }
              aria-label="Swap source and target formats"
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all duration-200 ${
                canSwap
                  ? 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white hover:rotate-180 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <span className="hidden sm:block w-6 h-[1px] bg-slate-200 dark:bg-slate-800" />
          </div>

          <span className="mt-1 text-[9px] sm:text-[10px] font-semibold tracking-[0.2em] text-slate-400 dark:text-slate-500 uppercase pl-[0.2em]">
            TO
          </span>
        </div>

        {/* RIGHT CARD: Target Format */}
        <button
          type="button"
          onClick={onClickTarget}
          aria-label={`Target format ${cleanTarget.toUpperCase()}. Click to change output format.`}
          className="group relative flex-1 min-w-[76px] max-w-[112px] sm:max-w-[134px] h-[96px] sm:h-[118px] rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/90 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 shadow-2xs transition-all duration-150 flex flex-col items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
        >
          <FormatGlyph
            ext={cleanTarget}
            className="w-6 h-6 sm:w-8 sm:h-8 text-slate-800 dark:text-slate-100 group-hover:scale-105 transition-transform"
          />
          <span className="text-xs sm:text-base font-bold tracking-wider uppercase font-mono text-slate-900 dark:text-white">
            {cleanTarget}
          </span>
          <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 transition-colors" />
        </button>
      </div>
    </div>
  );
};
