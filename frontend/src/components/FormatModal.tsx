'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { ALL_FORMATS, getCompatibleTargets } from '../lib/formatRegistry';

interface FormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (formatExt: string) => void;
  sourceExt?: string;
  currentSelected?: string;
  mode?: 'source' | 'target';
}

export const FormatModal: React.FC<FormatModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  sourceExt,
  currentSelected,
  mode = 'target',
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveCategory('all');
    }
  }, [isOpen, sourceExt, mode]);

  const baseFormats = useMemo(() => {
    if (mode === 'source') return ALL_FORMATS;
    return sourceExt ? getCompatibleTargets(sourceExt) : ALL_FORMATS;
  }, [sourceExt, mode]);

  const availableCategories = useMemo(() => {
    const cats = new Set(baseFormats.map(f => f.category));
    const allTabs = [
      { id: 'all', label: 'All Formats' },
      { id: 'image', label: 'Images' },
      { id: 'document', label: 'Documents' },
      { id: 'vector', label: 'Vectors' },
      { id: 'icon', label: 'Icons' },
    ];
    return allTabs.filter(t => t.id === 'all' || cats.has(t.id as any));
  }, [baseFormats]);

  const availableFormats = useMemo(() => {
    let list = baseFormats;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        f =>
          f.ext.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      list = list.filter(f => f.category === activeCategory);
    }

    return list;
  }, [baseFormats, search, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-xl shadow-2xl p-4 sm:p-5 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              {mode === 'source' ? 'Select Source Format' : 'Select Output Format'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {mode === 'source'
                ? 'Choose the input file format you are converting from'
                : sourceExt
                ? `Compatible output formats for .${sourceExt.toUpperCase()}`
                : 'Choose a target file format'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter bar */}
        <div className="mt-3 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter formats (e.g. webp, pdf, avif, svg)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
              autoFocus
            />
          </div>

          {availableCategories.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {availableCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formats Grid */}
        <div className="mt-3 overflow-y-auto pr-1 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          {availableFormats.map(fmt => {
            const isSelected = currentSelected?.toLowerCase() === fmt.ext.toLowerCase();
            return (
              <button
                key={fmt.ext}
                type="button"
                onClick={() => {
                  onSelect(fmt.ext);
                  onClose();
                }}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-600 dark:bg-blue-950/30 dark:border-blue-500'
                    : 'bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[11px] font-mono text-slate-700 dark:text-slate-200 shrink-0">
                    {fmt.ext.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">{fmt.name}</span>
                      {fmt.popular && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{fmt.description}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}

          {availableFormats.length === 0 && (
            <div className="col-span-full py-10 text-center text-xs text-slate-500">
              No matching formats found for &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
