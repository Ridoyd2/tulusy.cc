'use client';

import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock } from 'lucide-react';
import { ConversionSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ConversionSettings;
  onSave: (newSettings: ConversionSettings, applyToAll?: boolean) => void;
  fileName?: string;
  targetFormat?: string;
  isBatch?: boolean;
  totalFiles?: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  fileName,
  targetFormat,
  isBatch = false,
  totalFiles = 1,
}) => {
  const [settings, setSettings] = useState<ConversionSettings>({ ...initialSettings });
  const [applyToAll, setApplyToAll] = useState<boolean>(isBatch);

  useEffect(() => {
    if (isOpen) {
      setSettings({ ...initialSettings });
      setApplyToAll(isBatch);
    }
  }, [isOpen, initialSettings, isBatch]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(settings, isBatch ? true : applyToAll);
    onClose();
  };

  const showBgColor = ['jpg', 'jpeg', 'bmp', 'pdf'].includes((targetFormat || '').toLowerCase());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-xl shadow-2xl p-4 sm:p-5 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0 pr-3">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              {isBatch ? 'Batch Output Parameters' : 'Output Parameters'}
            </h3>
            {isBatch ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Apply parameters to all {totalFiles} files in queue
              </p>
            ) : fileName ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {fileName} {targetFormat ? `→ .${targetFormat.toUpperCase()}` : ''}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="mt-4 space-y-4 text-sm overflow-y-auto pr-1">
          {/* Quality Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Compression Quality
              </label>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 tabular-nums">
                {settings.quality}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={settings.quality}
              onChange={e => setSettings({ ...settings, quality: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Max compression</span>
              <span>Best quality</span>
            </div>
          </div>

          {/* Dimension Controls */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Dimensions (px)</label>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-[11px] text-slate-400">Width</span>
                <input
                  type="number"
                  min="1"
                  max="16384"
                  placeholder="Original"
                  value={settings.width || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      width: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined,
                    })
                  }
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-600 tabular-nums"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Height</span>
                <input
                  type="number"
                  min="1"
                  max="16384"
                  placeholder="Original"
                  value={settings.height || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      height: e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined,
                    })
                  }
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-600 tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSettings({ ...settings, maintainAspectRatio: !settings.maintainAspectRatio })
              }
              className={`flex items-center gap-1.5 text-xs mt-2 px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ${
                settings.maintainAspectRatio
                  ? 'bg-blue-50/70 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300'
                  : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              {settings.maintainAspectRatio ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{settings.maintainAspectRatio ? 'Preserve aspect ratio' : 'Stretch to exact dimensions'}</span>
            </button>
          </div>

          {/* DPI Resolution */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">DPI Resolution</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { dpi: 72, label: '72' },
                { dpi: 150, label: '150' },
                { dpi: 300, label: '300' },
                { dpi: 600, label: '600' },
              ].map(item => (
                <button
                  key={item.dpi}
                  type="button"
                  onClick={() => setSettings({ ...settings, dpi: item.dpi })}
                  className={`py-1.5 px-2 text-center rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                    settings.dpi === item.dpi
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transparency flatten background color */}
          {showBgColor && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Transparency Fill Color
                </label>
                <div className="flex items-center gap-1.5">
                  {['#FFFFFF', '#000000', '#F8FAFC'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSettings({ ...settings, bgColor: color })}
                      className={`w-5 h-5 rounded border cursor-pointer ${
                        settings.bgColor.toUpperCase() === color
                          ? 'ring-2 ring-blue-600 border-transparent'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.bgColor || '#FFFFFF'}
                    onChange={e => setSettings({ ...settings, bgColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Extra options */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Convert to Grayscale</span>
            <input
              type="checkbox"
              checked={settings.grayscale}
              onChange={e => setSettings({ ...settings, grayscale: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Apply to all toggle when multiple files exist */}
          {totalFiles > 1 && !isBatch && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">Apply to All Files</p>
                <p className="text-[11px] text-slate-500">Update parameters for all {totalFiles} files in queue</p>
              </div>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={e => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
