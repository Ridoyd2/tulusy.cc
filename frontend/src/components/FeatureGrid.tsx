'use client';

import React from 'react';
import { ShieldCheck, Zap, Layers, FileType } from 'lucide-react';

export const FeatureGrid: React.FC = () => {
  const features = [
    {
      icon: <FileType className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      title: '19+ Native Formats',
      desc: 'PNG, JPG, WebP, AVIF, SVG, ICO, BMP, TIFF, GIF, HEIC, PSD, TGA, PDF, DOCX, PPTX, XLSX, CSV, and TXT.',
    },
    {
      icon: <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      title: 'Document Reconstruction',
      desc: 'Convert PDFs into editable Word documents, PPTX slide decks, or structured Excel workbooks.',
    },
    {
      icon: <Zap className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      title: 'Concurrent Batch Queue',
      desc: 'Process multiple files in parallel with custom DPI, resize, and compression controls, then export as a single ZIP.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      title: 'Ephemeral Processing',
      desc: 'Temporary conversion artifacts are purged immediately after streaming the response back to your browser.',
    },
  ];

  return (
    <section className="w-full pt-8 border-t border-slate-200/80 dark:border-slate-800/80">
      <h2 className="sr-only">Core Conversion Capabilities</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="p-4 rounded-xl panel flex flex-col justify-start space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center">
              {f.icon}
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{f.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
