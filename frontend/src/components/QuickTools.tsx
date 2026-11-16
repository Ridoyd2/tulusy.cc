'use client';

import React from 'react';
import { ArrowRight, Image as ImageIcon, FileText, Presentation, Layers, Table, FileSpreadsheet } from 'lucide-react';

interface QuickToolsProps {
  onPresetSelected: (sourceExt: string, targetExt: string, accept?: string) => void;
}

export const QuickTools: React.FC<QuickToolsProps> = ({ onPresetSelected }) => {
  const presets = [
    {
      title: 'Image to WebP',
      desc: 'Convert PNG or JPEG into high-efficiency WebP.',
      from: 'IMG',
      to: 'WEBP',
      icon: <ImageIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('png', 'webp', 'image/*,.heic,.psd,.tga'),
    },
    {
      title: 'PDF to Word',
      desc: 'Reconstruct PDF layouts into editable DOCX.',
      from: 'PDF',
      to: 'DOCX',
      icon: <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('pdf', 'docx', '.pdf,application/pdf'),
    },
    {
      title: 'PDF to PPTX',
      desc: 'Render PDF pages into high-DPI PPTX slides.',
      from: 'PDF',
      to: 'PPTX',
      icon: <Presentation className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('pdf', 'pptx', '.pdf,application/pdf'),
    },
    {
      title: 'Excel to PDF',
      desc: 'Render XLSX workbooks to formatted landscape PDFs.',
      from: 'XLSX',
      to: 'PDF',
      icon: <FileSpreadsheet className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('xlsx', 'pdf', '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    },
    {
      title: 'PDF to Excel',
      desc: 'Extract tabular PDF data into structured XLSX.',
      from: 'PDF',
      to: 'XLSX',
      icon: <Table className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('pdf', 'xlsx', '.pdf,application/pdf'),
    },
    {
      title: 'CSV to Excel',
      desc: 'Convert raw CSV files into styled XLSX sheets.',
      from: 'CSV',
      to: 'XLSX',
      icon: <FileSpreadsheet className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('csv', 'xlsx', '.csv,text/csv'),
    },
    {
      title: 'Images to PDF',
      desc: 'Combine or convert images into PDF documents.',
      from: 'IMG',
      to: 'PDF',
      icon: <Layers className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('png', 'pdf', 'image/*'),
    },
    {
      title: 'HEIC to JPG',
      desc: 'Convert Apple HEIC photos to universal JPEG.',
      from: 'HEIC',
      to: 'JPG',
      icon: <ImageIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
      action: () => onPresetSelected('heic', 'jpg', '.heic,.heif,image/heic'),
    },
  ];

  return (
    <section className="w-full space-y-3.5">
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          Direct Workflows
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Select a workflow to pre-configure target format and open the file selector
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {presets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={preset.action}
            className="p-3.5 rounded-xl panel panel-hover text-left cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center">
                {preset.icon}
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>{preset.from}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="text-slate-900 dark:text-white font-semibold">{preset.to}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{preset.title}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{preset.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
