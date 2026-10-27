import React, { useEffect, useState } from 'react';
import { 
  UserCheck, 
  Crosshair, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';
import { 
  sampleHeadPose, 
  recenterCurrentPosture, 
  toggleHeadCompensation,
  isHeadCompensationActive,
  nudgeVerticalOffset,
  HeadPose 
} from '../lib/headPoseTracker';

interface Props {
  theme?: string;
  className?: string;
  onPostureRecentered?: () => void;
}

export function HeadPostureHUD({ theme = 'light', className = '', onPostureRecentered }: Props) {
  const [pose, setPose] = useState<HeadPose | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [justRecentered, setJustRecentered] = useState(false);
  const [tolerance, setTolerance] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [isCompEnabled, setIsCompEnabled] = useState(isHeadCompensationActive);
  const [verticalTrimPx, setVerticalTrimPx] = useState<number>(0);

  // Poll head pose at ~12Hz for smooth 2D Vector Scope display
  useEffect(() => {
    const interval = setInterval(() => {
      const current = sampleHeadPose();
      if (current) {
        setPose({ ...current });
      }
      if (window._headTrackerState) {
        setVerticalTrimPx(Math.round(window._headTrackerState.manualOffsetY || 0));
      }
    }, 80);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut: Press 'r' to quick-recenter while reading text
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'r' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleRecenter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRecenter = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      recenterCurrentPosture({
        anchorPoint: { x: e.clientX, y: e.clientY },
      });
    } else {
      recenterCurrentPosture();
    }
    setJustRecentered(true);
    setTimeout(() => setJustRecentered(false), 1200);
    if (onPostureRecentered) onPostureRecentered();
  };

  const handleToggleCompensation = () => {
    const nextState = toggleHeadCompensation();
    setIsCompEnabled(nextState);
  };

  const setToleranceLevel = (level: 'low' | 'balanced' | 'high') => {
    setTolerance(level);
    if (window._headTrackerState) {
      window._headTrackerState.toleranceLevel = level;
      if (window._headTrackerState.calibration) {
        window._headTrackerState.calibration.toleranceLevel = level;
      }
    }
  };

  const getStatusColor = () => {
    if (!pose?.detected) return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700';
    if (!isCompEnabled) return 'text-stone-600 bg-stone-100 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700';
    if (pose.alignmentStatus === 'centered' && pose.distanceStatus === 'optimal') {
      return 'text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70';
    }
    return 'text-blue-800 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/70';
  };

  const getStatusText = () => {
    if (!pose?.detected) return 'Detecting face...';
    if (justRecentered) return '2D Origin Locked';
    if (!isCompEnabled) return 'Head Anchor: Off';
    if (pose.distanceStatus === 'too_close') return 'Leaned Close';
    if (pose.distanceStatus === 'too_far') return 'Leaned Back';
    if (pose.alignmentStatus === 'shifted_left') return 'Shifted Left';
    if (pose.alignmentStatus === 'shifted_right') return 'Shifted Right';
    if (pose.alignmentStatus === 'slouching') return 'Posture Low';
    if (pose.alignmentStatus === 'shifted_up') return 'Posture High';
    return '2D Anchor Centered';
  };

  // Compute SVG coordinates for the 2D Reference Scope (center is 28, 28 in a 56x56 box)
  const headDotX = Math.max(6, Math.min(50, 28 + (pose?.headShiftX || 0) * 65));
  const headDotY = Math.max(6, Math.min(50, 28 + (pose?.headShiftY || 0) * 65));
  const gazeTipX = Math.max(4, Math.min(52, headDotX + (pose?.eyeDeltaX || 0) * 45));
  const gazeTipY = Math.max(4, Math.min(52, headDotY + (pose?.eyeDeltaY || 0) * 45));

  return (
    <div className={`rounded-xl border transition-all text-xs font-sans overflow-hidden ${getStatusColor()} ${className}`}>
      
      {/* Top Banner Row */}
      <div className="p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <UserCheck className="w-4 h-4 shrink-0 opacity-80" />
          <div className="truncate">
            <div className="font-semibold leading-tight flex items-center gap-1.5">
              <span className="truncate">{getStatusText()}</span>
            </div>
            <div className="text-[10px] opacity-70 font-mono tabular-nums">
              {pose?.detected ? `Δ${pose.driftDistancePx}px · ${pose.distanceStatus.replace('_', ' ')}` : 'Awaiting landmarks'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => handleRecenter(e)}
            title="Zero 2D Head Reference & Gaze Origin (Shortcut: R)"
            className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Crosshair className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
            <span>Zero (R)</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
            title={isExpanded ? 'Collapse scope' : 'Expand 2D Reference Scope'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded 2D Head-Reference Scope & Controls */}
      {isExpanded && (
        <div className="p-3 pt-2 border-t border-black/10 dark:border-white/10 space-y-2.5 bg-black/5 dark:bg-white/5">
          
          {/* Live 2D Head-Reference Vector Scope */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10">
            <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 rounded bg-stone-900/95 border border-white/10 shadow-inner">
              {/* Reading Corridor Band */}
              <rect x="0" y="18" width="56" height="20" fill="rgba(16, 185, 129, 0.08)" />
              {/* Center Origin Crosshair */}
              <line x1="28" y1="0" x2="28" y2="56" stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" strokeWidth="1" />
              <line x1="0" y1="28" x2="56" y2="28" stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" strokeWidth="1" />
              <circle cx="28" cy="28" r="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              {/* Eye Excursion Vector from Head Anchor */}
              {pose?.detected && (
                <>
                  <line
                    x1={headDotX}
                    y1={headDotY}
                    x2={gazeTipX}
                    y2={gazeTipY}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx={gazeTipX} cy={gazeTipY} r="2" fill="#38bdf8" />
                  {/* 2D Moving Head Center Anchor */}
                  <circle
                    cx={headDotX}
                    cy={headDotY}
                    r="3.5"
                    fill={justRecentered ? '#10b981' : '#34d399'}
                    stroke="#064e3b"
                    strokeWidth="1"
                  />
                </>
              )}
            </svg>

            <div className="flex-1 min-w-0 space-y-1 text-[10px]">
              <div className="font-semibold opacity-90 flex items-center justify-between">
                <span>2D Reference Scope</span>
                <button
                  onClick={handleToggleCompensation}
                  className="underline opacity-75 hover:opacity-100 cursor-pointer"
                >
                  {isCompEnabled ? 'Active' : 'Paused'}
                </button>
              </div>
              <div className="font-mono tabular-nums opacity-75 flex justify-between">
                <span>Head XY:</span>
                <span>
                  {((pose?.headShiftX || 0) * 100).toFixed(0)}%, {((pose?.headShiftY || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="font-mono tabular-nums opacity-75 flex justify-between">
                <span>Eye Vec:</span>
                <span>
                  {((pose?.eyeDeltaX || 0) * 100).toFixed(0)}%, {((pose?.eyeDeltaY || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-[9px] opacity-60 leading-tight">
                Green dot = 2D Head Anchor · Cyan = Eye Vector
              </div>
            </div>
          </div>

          {/* Vertical Height Trim Controls (To adjust if gaze is slightly high or low) */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] font-semibold opacity-75">
              Vertical Bias ({verticalTrimPx >= 0 ? `+${verticalTrimPx}` : verticalTrimPx}px)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVerticalTrimPx(nudgeVerticalOffset(-30))}
                className="px-2 py-0.5 rounded bg-white/70 dark:bg-black/40 border border-black/10 dark:border-white/10 hover:bg-white text-[10px] font-mono font-semibold cursor-pointer"
                title="Nudge gaze pointer higher (-30px)"
              >
                ↑ Higher
              </button>
              <button
                type="button"
                onClick={() => setVerticalTrimPx(nudgeVerticalOffset(30))}
                className="px-2 py-0.5 rounded bg-white/70 dark:bg-black/40 border border-black/10 dark:border-white/10 hover:bg-white text-[10px] font-mono font-semibold cursor-pointer"
                title="Nudge gaze pointer lower (+30px)"
              >
                ↓ Lower
              </button>
            </div>
          </div>

          {/* Quick Tracking Mode Switch */}
          <div>
            <div className="text-[10px] font-semibold opacity-70 mb-1">
              Tracking Fusion Mode
            </div>
            <div className="grid grid-cols-2 gap-1 bg-black/10 dark:bg-white/10 p-0.5 rounded-lg">
              <button
                onClick={() => {
                  if (window._gazeSettings) window._gazeSettings.trackingSource = 'hybrid';
                  setJustRecentered(true);
                  setTimeout(() => setJustRecentered(false), 800);
                }}
                className={`py-1.5 px-1 rounded text-[10px] font-semibold transition-all cursor-pointer text-center ${
                  (window._gazeSettings?.trackingSource || 'hybrid') === 'hybrid'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                2D Hybrid (Eye+Head)
              </button>
              <button
                onClick={() => {
                  if (window._gazeSettings) window._gazeSettings.trackingSource = 'head';
                  setJustRecentered(true);
                  setTimeout(() => setJustRecentered(false), 800);
                }}
                className={`py-1.5 px-1 rounded text-[10px] font-semibold transition-all cursor-pointer text-center ${
                  window._gazeSettings?.trackingSource === 'head'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                2D Head Vector Only
              </button>
            </div>
          </div>

          {/* Tolerance Level Selector */}
          <div>
            <div className="text-[10px] font-semibold opacity-70 mb-1">
              Posture Drift Tolerance
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'low', label: 'Strict' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'high', label: 'Relaxed' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setToleranceLevel(t.id as any)}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    tolerance === t.id 
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                      : 'bg-white/60 dark:bg-black/40 border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-black/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
