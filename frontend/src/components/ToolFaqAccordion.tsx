'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ToolFaqAccordionProps {
  faqs: { q: string; a: string }[];
}

export const ToolFaqAccordion: React.FC<ToolFaqAccordionProps> = ({ faqs }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!faqs.length) return null;

  return (
    <section className="space-y-3.5 pt-6 border-t border-slate-200 dark:border-slate-800">
      <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
        Frequently Asked Questions
      </h2>
      <div className="space-y-2">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="panel rounded-xl overflow-hidden">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 font-medium text-xs sm:text-sm text-slate-900 dark:text-white cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                    isOpen ? 'rotate-180 text-slate-900 dark:text-white' : ''
                  }`}
                />
              </button>
              <div
                className={`px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 ${
                  isOpen ? 'block' : 'hidden'
                }`}
              >
                {faq.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
