import React from 'react';
import { 
  X, 
  RotateCcw, 
  Sun, 
  Moon, 
  BookOpen, 
  Sliders, 
  Eye, 
  Sparkles, 
  Check, 
  Gauge, 
  Compass,
  FileCheck,
  Crosshair
} from 'lucide-react';
import { ReaderSettings, ReaderTheme, ReaderFontSize, ReaderFontFamily } from '../types';
import { DEFAULT_SETTINGS } from '../lib/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: ReaderSettings) => void;
  currentProgress?: { percentage: number; scrollY: number; page?: number; totalPages?: number } | null;
  onResetProgress?: () => void;
  onRecalibrate?: () => void;
}

export function SettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentProgress,
  onResetProgress,
  onRecalibrate,
}: Props) {
  if (!isOpen) return null;

  const update = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const handleResetDefaults = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
  };

  const themes: { id: ReaderTheme; label: string; desc: string; bg: string; text: string; border: string; icon: any }[] = [
    {
      id: 'light',
      label: 'Classic Paper',
      desc: 'Warm off-white for effortless daytime reading',
      bg: 'bg-[#FBF9F5]',
      text: 'text-stone-800',
      border: 'border-stone-300',
      icon: Sun,
    },
    {
      id: 'sepia',
      label: 'Warm Sepia',
      desc: 'Golden-hour amber that reduces eye strain',
      bg: 'bg-[#F6ECD9]',
      text: 'text-[#433422]',
      border: 'border-[#DFCBB0]',
      icon: BookOpen,
    },
    {
      id: 'dark',
      label: 'Night Dark',
      desc: 'Subdued charcoal for low-light environments',
      bg: 'bg-[#18181B]',
      text: 'text-zinc-100',
      border: 'border-zinc-700',
      icon: Moon,
    },
    {
      id: 'e-ink',
      label: 'E-Ink Crisp',
      desc: 'Pure monochrome high-contrast clarity',
      bg: 'bg-white',
      text: 'text-black',
      border: 'border-black',
      icon: Sparkles,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden border-l border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-base font-semibold leading-tight">Settings & Ergonomics</h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Personalize display and eye-tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleResetDefaults}
              title="Reset all settings to default"
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Section: Themes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-3">
              Reading Theme
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => update('theme', t.id)}
                    className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${t.bg} ${t.text} ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-sm' 
                        : `${t.border} opacity-80 hover:opacity-100 hover:shadow-xs`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className="w-4 h-4" />
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-[11px] opacity-75 line-clamp-1">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Typography */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-3">
              Typography
            </label>
            <div className="space-y-3">
              {/* Font Family */}
              <div className="flex gap-2">
                {[
                  { id: 'serif', label: 'Serif (Academic)' },
                  { id: 'sans', label: 'Sans (Modern)' },
                  { id: 'mono', label: 'Monospace' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => update('fontFamily', f.id as ReaderFontFamily)}
                    className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                      settings.fontFamily === f.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Font Size */}
              <div className="flex items-center justify-between gap-2">
                {[
                  { id: 'sm', label: 'Small', sample: '15px' },
                  { id: 'base', label: 'Medium', sample: '18px' },
                  { id: 'lg', label: 'Large', sample: '21px' },
                  { id: 'xl', label: 'X-Large', sample: '24px' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => update('fontSize', s.id as ReaderFontSize)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition-all ${
                      settings.fontSize === s.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[10px] opacity-60">{s.sample}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Scroll Mode */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-2">
              Scroll Navigation Mode
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => update('scrollMode', 'step')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  (settings.scrollMode || 'step') === 'step'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-1 ring-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between mb-1">
                  <span>Reading Flow (Step)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 uppercase">Recommended</span>
                </div>
                <div className="text-[11px] opacity-75 leading-tight">
                  Text stays 100% still. Glides down 1 paragraph when you finish a page, then pauses.
                </div>
              </button>

              <button
                onClick={() => update('scrollMode', 'continuous')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.scrollMode === 'continuous'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-1 ring-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                }`}
              >
                <div className="text-xs font-bold mb-1">Continuous Teleprompter</div>
                <div className="text-[11px] opacity-75 leading-tight">
                  Constantly slow-crawls whenever your gaze dips toward the lower margin.
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Gaze Scroll Speed
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                {settings.scrollSpeed.toFixed(1)}x{' '}
                {settings.scrollSpeed <= 0.7 ? '(Gentle)' : settings.scrollSpeed <= 1.2 ? '(Normal)' : '(Fast)'}
              </span>
            </div>

            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.scrollSpeed}
              onChange={(e) => update('scrollSpeed', parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-stone-400 mt-1">
              <span>0.5x Slow</span>
              <span>1.0x Default</span>
              <span>2.5x Max</span>
            </div>
          </div>

          {/* Section: Trigger Zones Interactive Config */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-2">
              Scroll Trigger Zones
            </label>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mb-4 leading-normal">
              Customize how far your gaze must travel to initiate continuous teleprompter scrolling.
            </p>

            {/* Visual Screen Representation */}
            <div className="mb-4 p-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-100/70 dark:bg-zinc-800/50">
              <div className="w-full h-32 rounded-lg bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 flex flex-col overflow-hidden relative text-[10px]">
                {/* Top Zone */}
                <div 
                  className="bg-blue-500/15 border-b border-blue-400/40 flex items-center justify-center font-medium text-blue-700 dark:text-blue-300 transition-all"
                  style={{ height: `${settings.topThresholdPct * 100}%` }}
                >
                  Top Scroll-Up Zone ({Math.round(settings.topThresholdPct * 100)}%)
                </div>
                {/* Neutral Zone */}
                <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-zinc-500 font-medium">
                  Neutral Reading Zone (No Scroll)
                </div>
                {/* Bottom Zone */}
                <div 
                  className="bg-emerald-500/15 border-t border-emerald-400/40 flex items-center justify-center font-medium text-emerald-700 dark:text-emerald-300 transition-all"
                  style={{ height: `${settings.bottomThresholdPct * 100}%` }}
                >
                  Bottom Scroll-Down Zone ({Math.round(settings.bottomThresholdPct * 100)}%)
                </div>
              </div>
            </div>

            {/* Bottom Slider */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-stone-700 dark:text-zinc-300">Bottom Scroll-Down Sensitivity:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Bottom {Math.round(settings.bottomThresholdPct * 100)}% of screen
                  </span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.45"
                  step="0.05"
                  value={settings.bottomThresholdPct}
                  onChange={(e) => update('bottomThresholdPct', parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Top Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-stone-700 dark:text-zinc-300">Top Scroll-Up Sensitivity:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Top {Math.round(settings.topThresholdPct * 100)}% of screen
                  </span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.35"
                  step="0.05"
                  value={settings.topThresholdPct}
                  onChange={(e) => update('topThresholdPct', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Zone Guides Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/40">
                <div>
                  <div className="text-xs font-semibold">Visual Zone Guides</div>
                  <div className="text-[11px] text-stone-500 dark:text-zinc-400">Show faint lines on screen marking the trigger zones</div>
                </div>
                <button
                  onClick={() => update('showZoneGuides', !settings.showZoneGuides)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.showZoneGuides ? 'bg-blue-600' : 'bg-stone-300 dark:bg-zinc-700'
                  }`}
                >
                  <div 
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.showZoneGuides ? 'translate-x-5' : 'translate-x-0'
                    }`} 
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Eye Tracking Feel */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-3">
              Pointer Feel & Cursor
            </label>

            {/* Smoothing Filter */}
            <div className="mb-4">
              <div className="text-xs font-medium text-stone-700 dark:text-zinc-300 mb-2">
                Gaze Smoothing (Jitter vs Speed)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 0.50, label: 'Fast / Raw', desc: 'Instant response' },
                  { value: 0.30, label: 'Balanced', desc: 'Recommended' },
                  { value: 0.15, label: 'Ultra Smooth', desc: 'Zero jitter' },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => update('smoothingFactor', s.value)}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      Math.abs(settings.smoothingFactor - s.value) < 0.05
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[10px] opacity-60">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Gaze Dot Pointer Visibility & Size */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-medium text-stone-700 dark:text-zinc-300">Show Gaze Indicator Dot</div>
                <div className="text-[11px] text-stone-400">Helpful visual feedback of where your eyes are tracking</div>
              </div>
              <button
                onClick={() => update('showGazeIndicator', !settings.showGazeIndicator)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.showGazeIndicator ? 'bg-blue-600' : 'bg-stone-300 dark:bg-zinc-700'
                }`}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.showGazeIndicator ? 'translate-x-5' : 'translate-x-0'
                  }`} 
                />
              </button>
            </div>

            {settings.showGazeIndicator && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Dot Size:</span>
                {(['sm', 'md', 'lg'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => update('indicatorSize', sz)}
                    className={`px-3 py-1 rounded border text-xs capitalize transition-all ${
                      settings.indicatorSize === sz
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300'
                    }`}
                  >
                    {sz === 'sm' ? 'Small' : sz === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section: Head Movement Tolerance & Parallax */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Head Movement Tolerance
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                Active Parallax Fix
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mb-3 leading-normal">
              Normalizes webcam pupil coordinates against head tilt, distance shifts, and posture slouching so you don't lose calibration when moving your head.
            </p>

            {/* Tracking Source Selector */}
            <div className="mb-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block mb-1.5">
                Tracking Technology
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  {
                    id: 'head',
                    label: 'Head & Face Navigator (100% Movement-Proof)',
                    desc: 'Uses 3D facial orientation. Completely immune to shifting in your chair, moving left/right, or slouching.',
                    badge: 'Most Stable',
                  },
                  {
                    id: 'hybrid',
                    label: 'Smart Hybrid (Eye Gaze + Inverted Parallax Fix)',
                    desc: 'Combines pupil tracking with active mirror-aware compensation.',
                    badge: 'Recommended',
                  },
                  {
                    id: 'eye',
                    label: 'Pure Eye Gaze (Raw Pupil Tracking)',
                    desc: 'Traditional eye-only tracking without head motion compensation.',
                    badge: 'Standard',
                  },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => update('trackingSource', s.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      (settings.trackingSource || 'hybrid') === s.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-1 ring-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                        : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-0.5">
                      <span>{s.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-semibold">{s.badge}</span>
                    </div>
                    <div className="text-[11px] opacity-75 leading-tight">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Recenter Button in Settings */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const event = new KeyboardEvent('keydown', { key: 'r' });
                  window.dispatchEvent(event);
                }
              }}
              className="w-full mb-3 py-2 px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Recenter to Current Posture (or press R)
            </button>

            {/* Tolerance Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low', label: 'Strict', desc: 'Minimal head movement' },
                { id: 'balanced', label: 'Balanced', desc: 'Natural posture shifts' },
                { id: 'high', label: 'Relaxed', desc: 'High motion tolerance' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (window._headTrackerState) {
                      window._headTrackerState.calibration.toleranceLevel = t.id as any;
                    }
                  }}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    (window._headTrackerState?.calibration.toleranceLevel || 'balanced') === t.id
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className="text-[10px] opacity-60">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Reading Progress & Document Management */}
          <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-3">
              Document Progress
            </label>

            <div className="p-3 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-800/40 space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500 dark:text-zinc-400">Current Position:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {currentProgress ? `${currentProgress.percentage}% read` : '0%'}
                  {currentProgress?.page && currentProgress.totalPages && ` (Page ${currentProgress.page} of ${currentProgress.totalPages})`}
                </span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${currentProgress?.percentage || 0}%` }}
                />
              </div>
            </div>

            {onResetProgress && (
              <button
                onClick={onResetProgress}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-stone-300 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-xs font-medium text-stone-700 dark:text-zinc-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Reading Progress to Top
              </button>
            )}
          </div>

          {/* Recalibrate Shortcut */}
          {onRecalibrate && (
            <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  onClose();
                  onRecalibrate();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs flex items-center justify-center gap-2 hover:bg-stone-700 dark:hover:bg-white transition-all shadow-xs"
              >
                <Compass className="w-4 h-4" />
                Launch Full Eye-Tracker Calibration
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-zinc-800 shrink-0 bg-stone-50 dark:bg-zinc-900 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
}
