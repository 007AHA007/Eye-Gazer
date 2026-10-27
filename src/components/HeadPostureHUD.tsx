import React, { useEffect, useState } from 'react';
import { 
  UserCheck, 
  Crosshair, 
  ChevronDown, 
  ChevronUp,
  Power
} from 'lucide-react';
import { 
  sampleHeadPose, 
  recenterCurrentPosture, 
  toggleHeadCompensation,
  isHeadCompensationActive,
  HeadPose 
} from '../lib/headPoseTracker';

interface Props {
  theme?: string;
  className?: string;
  onPostureRecentered?: () => void;
}

export function HeadPostureHUD({ theme = 'light', className = '', onPostureRecentered }: Props) {
  const [pose, setPose] = useState<HeadPose | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [justRecentered, setJustRecentered] = useState(false);
  const [tolerance, setTolerance] = useState<'low' | 'balanced' | 'high'>('balanced');
  const [isCompEnabled, setIsCompEnabled] = useState(isHeadCompensationActive);

  // Poll head pose at ~10Hz for HUD display
  useEffect(() => {
    const interval = setInterval(() => {
      const current = sampleHeadPose();
      setPose({ ...current });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut: Press 'r' to quick-recenter while reading text
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input/textarea or pressing Ctrl+R / Cmd+R browser reload
      if (
        e.key.toLowerCase() === 'r' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleRecenter(); // Snaps raw gaze Y to the 45% central reading corridor
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
      return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800';
    }
    return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800';
  };

  const getStatusText = () => {
    if (!pose?.detected) return 'Detecting face...';
    if (justRecentered) return 'Posture Re-anchored ✓';
    if (!isCompEnabled) return 'Head Stabilizer: OFF';
    if (pose.distanceStatus === 'too_close') return 'Leaned Too Close';
    if (pose.distanceStatus === 'too_far') return 'Leaned Too Far';
    if (pose.alignmentStatus === 'shifted_left') return 'Head Shifted Left';
    if (pose.alignmentStatus === 'shifted_right') return 'Head Shifted Right';
    if (pose.alignmentStatus === 'slouching') return 'Slouching / Shifted Down';
    if (pose.alignmentStatus === 'shifted_up') return 'Shifted Up';
    return 'Head Centered ✓';
  };

  return (
    <div className={`rounded-xl border transition-all text-xs font-sans overflow-hidden ${getStatusColor()} ${className}`}>
      
      {/* Top Banner Row */}
      <div className="p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <UserCheck className="w-4 h-4 shrink-0" />
            {pose?.detected && (
              <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                !isCompEnabled ? 'bg-stone-400' : pose.alignmentStatus === 'centered' ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
            )}
          </div>
          <div>
            <div className="font-semibold leading-tight flex items-center gap-1.5">
              <span>{getStatusText()}</span>
              {pose?.detected && isCompEnabled && (
                <span className="text-[10px] opacity-60 font-mono">
                  (Δ{pose.driftDistancePx}px)
                </span>
              )}
            </div>
            <div className="text-[10px] opacity-75">
              Head Movement Sentinel
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleRecenter(e)}
            title="Recenter tracking to current posture (Shortcut: R key)"
            className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors font-medium text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Crosshair className="w-3 h-3 text-blue-500 dark:text-cyan-400" />
            <span>Recenter (R)</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Show posture details'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t border-black/10 dark:border-white/10 space-y-2.5 bg-black/5 dark:bg-white/5">
          
          {/* Posture Guidance Hint */}
          <div className="text-[11px] opacity-80 leading-relaxed">
            Shifted in your chair? Press <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/20 font-mono font-bold">R</kbd> anytime to instantly re-center tracking.
          </div>

          {/* Quick Tracking Mode Switch */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">
              Tracking Source
            </div>
            <div className="grid grid-cols-2 gap-1 bg-black/10 dark:bg-white/10 p-0.5 rounded-lg">
              <button
                onClick={() => {
                  if (window._gazeSettings) window._gazeSettings.trackingSource = 'hybrid';
                  setJustRecentered(true);
                  setTimeout(() => setJustRecentered(false), 800);
                }}
                className={`py-1.5 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                  (window._gazeSettings?.trackingSource || 'hybrid') === 'hybrid'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                Eye Gaze (Hybrid)
              </button>
              <button
                onClick={() => {
                  if (window._gazeSettings) window._gazeSettings.trackingSource = 'head';
                  setJustRecentered(true);
                  setTimeout(() => setJustRecentered(false), 800);
                }}
                className={`py-1.5 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                  window._gazeSettings?.trackingSource === 'head'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                Head (100% Stable)
              </button>
            </div>
          </div>

          {/* Tolerance Level Selector */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">
              Tolerance Level
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
                  className={`py-1 px-1.5 rounded text-[11px] font-medium border text-center transition-all cursor-pointer ${
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

          {/* Distance check */}
          <div className="flex items-center justify-between text-[11px] font-mono opacity-80 pt-1">
            <span className="opacity-60">Focal Distance:</span>
            <span className="font-semibold capitalize">{pose?.distanceStatus.replace('_', ' ') || 'Lost'}</span>
          </div>

        </div>
      )}

    </div>
  );
}
