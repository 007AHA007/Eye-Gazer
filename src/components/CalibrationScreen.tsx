import React, { useEffect, useState, useRef } from 'react';
import {
  recordHeadBaseline,
  recordCalibrationHeadSample,
  refineCalibrationAtPoint,
  resetHeadTracker,
  sampleHeadPose,
  HeadPose,
  seedWebgazerBaseline
} from '../lib/headPoseTracker';
import {
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Check,
  AlertTriangle,
  UserCheck,
  Crosshair,
  Target
} from 'lucide-react';

interface Props {
  onCalibrationComplete: () => void;
}

type CalibrationMode = 'quick5' | 'full9';

interface CalibPoint {
  id: number;
  label: string;
  top: string;
  left: string;
  isCenter?: boolean;
}

export function CalibrationScreen({ onCalibrationComplete }: Props) {
  const [mode, setMode] = useState<CalibrationMode>('quick5');
  const [clickCounts, setClickCounts] = useState<Record<number, number>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [testGazePos, setTestGazePos] = useState<{ x: number; y: number } | null>(null);
  const [headPose, setHeadPose] = useState<HeadPose | null>(null);
  const [refinedCount, setRefinedCount] = useState<number>(0);
  const [lastRefinedLabel, setLastRefinedLabel] = useState<string | null>(null);
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // When Calibration Screen mounts: ensure video preview is visible and tracker loop is active
  useEffect(() => {
    resetHeadTracker();
    if (window.webgazer) {
      try {
        if (typeof window.webgazer.removeMouseEventListeners === 'function') {
          window.webgazer.removeMouseEventListeners();
        }
        window.webgazer.showVideoPreview?.(true);
        window.webgazer.showPredictionPoints?.(true);
        // Seed 1 initial point so WebGazer's tracker loop ticks immediately;
        // wiped automatically on the user's very first calibration click.
        seedWebgazerBaseline();
        if (
          document.getElementById('webgazerVideoContainer') &&
          typeof window.webgazer.setVideoViewerSize === 'function'
        ) {
          window.webgazer.setVideoViewerSize(320, 240);
        }
      } catch (err) {
        console.warn("Could not initialize webgazer preview on mount:", err);
      }
    }
    if (window._gazeState) {
      window._gazeState.smoothedX = undefined;
      window._gazeState.smoothedY = undefined;
      window._gazeState.bottomDwellStart = null;
      window._gazeState.topDwellStart = null;
    }
  }, []);

  // Poll live head posture at 10Hz and ensure #webgazerVideoContainer stays visible
  useEffect(() => {
    const interval = setInterval(() => {
      const vc = document.getElementById('webgazerVideoContainer');
      if (vc) {
        if (vc.style.display === 'none') {
          window.webgazer?.showVideoPreview?.(true);
          vc.style.display = 'block';
        }
        if (vc.style.width !== '320px' && typeof window.webgazer?.setVideoViewerSize === 'function') {
          try {
            window.webgazer.setVideoViewerSize(320, 240);
          } catch (e) {
            // ignore
          }
        }
      }
      const pose = sampleHeadPose();
      if (pose) {
        setHeadPose({ ...pose });
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // 5-point fast calibration (4 corners first, Center point #5 LAST)
  const quickPoints: CalibPoint[] = [
    { id: 1, label: 'Top-Left', top: '16%', left: '16%' },
    { id: 2, label: 'Top-Right', top: '16%', left: '84%' },
    { id: 3, label: 'Bottom-Left', top: '84%', left: '16%' },
    { id: 4, label: 'Bottom-Right', top: '84%', left: '84%' },
    { id: 5, label: 'Center Lock', top: '50%', left: '50%', isCenter: true },
  ];

  // 9-point comprehensive grid (Perimeter first, Center point #9 LAST)
  const fullPoints: CalibPoint[] = [
    { id: 1, label: 'Top-Left', top: '14%', left: '14%' },
    { id: 2, label: 'Top-Center', top: '14%', left: '50%' },
    { id: 3, label: 'Top-Right', top: '14%', left: '86%' },
    { id: 4, label: 'Mid-Left', top: '50%', left: '14%' },
    { id: 5, label: 'Mid-Right', top: '50%', left: '86%' },
    { id: 6, label: 'Bottom-Left', top: '86%', left: '14%' },
    { id: 7, label: 'Bottom-Center', top: '86%', left: '50%' },
    { id: 8, label: 'Bottom-Right', top: '86%', left: '86%' },
    { id: 9, label: 'Center Lock', top: '50%', left: '50%', isCenter: true },
  ];

  const points = mode === 'quick5' ? quickPoints : fullPoints;
  const clicksPerPoint = mode === 'quick5' ? 3 : 5;

  const totalClicks = (Object.values(clickCounts) as number[]).reduce((a, b) => a + b, 0);
  const maxPossibleClicks = points.length * clicksPerPoint;
  const percentComplete = Math.min(100, Math.round((totalClicks / maxPossibleClicks) * 100));

  // Determine the current guided active point (first incomplete point in sequence)
  const activePoint = points.find((p) => (clickCounts[p.id] || 0) < clicksPerPoint) || null;

  const triggerPointSample = (p: CalibPoint, btnEl: HTMLButtonElement | null) => {
    if (!btnEl) return;
    const rect = btnEl.getBoundingClientRect();
    const targetX = rect.left + rect.width * 0.5;
    const targetY = rect.top + rect.height * 0.5;
    const nextCount = (clickCounts[p.id] || 0) + 1;

    // On the very first real calibration click, wipe the temporary startup seed point
    if (totalClicks === 0 && window.webgazer?.clearData) {
      try {
        window.webgazer.clearData();
      } catch (e) {
        // ignore
      }
    }

    // 1. Record immediate frame + a +45ms settled micro-burst sample into WebGazer
    if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
      window.webgazer.recordScreenPosition(targetX, targetY, 'click');
      window.setTimeout(() => {
        if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
          window.webgazer.recordScreenPosition(targetX, targetY, 'click');
        }
      }, 45);
    }

    // 2. Record head posture sample (and on final click of a dot, record raw->target pair)
    recordCalibrationHeadSample(
      p.isCenter ? 3 : 1,
      nextCount >= clicksPerPoint ? { targetX, targetY } : undefined
    );

    setClickCounts((prev) => ({
      ...prev,
      [p.id]: (prev[p.id] || 0) + 1,
    }));
  };

  const handlePointClick = (p: CalibPoint, e: React.MouseEvent<HTMLButtonElement>) => {
    triggerPointSample(p, e.currentTarget);
  };

  // Allow pressing Spacebar while staring at the active guided point!
  useEffect(() => {
    if (isVerifying || !activePoint) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        const btn = buttonRefs.current[activePoint.id];
        if (btn) {
          triggerPointSample(activePoint, btn);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVerifying, activePoint, clickCounts, clicksPerPoint, totalClicks]);

  useEffect(() => {
    const allDone = points.every(p => (clickCounts[p.id] || 0) >= clicksPerPoint);
    
    if (Object.keys(clickCounts).length > 0 && allDone && !isVerifying) {
      recordHeadBaseline();
      setIsVerifying(true);
    }
  }, [clickCounts, points, clicksPerPoint, isVerifying]);

  // Track live gaze during verification
  useEffect(() => {
    if (!isVerifying) return;
    const interval = setInterval(() => {
      if (window._gazeState?.smoothedX !== undefined && window._gazeState?.smoothedY !== undefined) {
        setTestGazePos({
          x: window._gazeState.smoothedX,
          y: window._gazeState.smoothedY,
        });
      }
    }, 30);
    return () => clearInterval(interval);
  }, [isVerifying]);

  const handleResetCalibration = () => {
    setClickCounts({});
    setIsVerifying(false);
    setRefinedCount(0);
    setLastRefinedLabel(null);
    resetHeadTracker();
    if (window.webgazer && window.webgazer.clearData) {
      window.webgazer.clearData();
      seedWebgazerBaseline();
    }
  };

  const handleSpotRefineTarget = (label: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const targetX = rect.left + rect.width * 0.5;
    const targetY = rect.top + rect.height * 0.5;
    refineCalibrationAtPoint(targetX, targetY);
    setRefinedCount((c) => c + 1);
    setLastRefinedLabel(label);
  };

  const handleFinish = () => {
    if (typeof window.webgazer?.removeMouseEventListeners === 'function') {
      window.webgazer.removeMouseEventListeners();
    }
    if (totalClicks === 0) {
      seedWebgazerBaseline();
      recordHeadBaseline();
    } else if (!isVerifying) {
      recordHeadBaseline();
    }
    onCalibrationComplete();
  };

  // 5 Interactive Verification & Spot-Refinement Targets shown during `isVerifying`
  const verificationTargets = [
    { id: 'v-top', label: 'Top Scroll Zone', top: '12%', left: '50%' },
    { id: 'v-left', label: 'Left Margin', top: '50%', left: '14%' },
    { id: 'v-center', label: 'Center Anchor', top: '26%', left: '50%' },
    { id: 'v-right', label: 'Right Margin', top: '50%', left: '86%' },
    { id: 'v-bottom', label: 'Bottom Scroll Zone', top: '88%', left: '50%' },
  ];

  return (
    <div className="fixed inset-0 flex bg-slate-900 text-white font-sans select-none">
      <style>{`
        #webgazerVideoContainer {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 320px !important;
          height: 240px !important;
          z-index: 9999 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          border-bottom: 1px solid #334155;
          background-color: #000;
        }
        #webgazerVideoFeed,
        #webgazerFaceOverlay,
        #webgazerFaceFeedbackBox {
          display: block !important;
          visibility: visible !important;
        }
      `}</style>

      {/* Sidebar for Camera Feed & Modes */}
      <div className="w-[320px] h-full bg-slate-800 border-r border-slate-700 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div>
          {/* WebGazer video container placeholder */}
          <div className="h-[240px] w-full shrink-0 relative bg-black">
            <span className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-black/60 px-2 py-0.5 rounded">
              Webcam Feed
            </span>
          </div>
          
          <div className="p-4 space-y-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-100">Precision Eye Calibration</h2>
              <p className="text-xs text-slate-400">
                Focus on the white center pinhole of the highlighted target and click (or press <kbd className="px-1 py-0.5 rounded bg-slate-700 font-mono text-[10px]">Space</kbd>).
              </p>
            </div>

            {/* Live Head Position Monitor */}
            <div className="p-2.5 rounded-xl border border-slate-700/60 bg-slate-900/60 text-xs">
              <div className="flex items-center justify-between font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Head In Webcam:
                </span>
                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${headPose?.detected ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                  {headPose?.detected ? 'Detected ✓' : 'Detecting...'}
                </span>
              </div>
              
              {headPose?.detected ? (
                <div className="text-[11px] text-slate-300">
                  {headPose.x > 200 ? (
                    <span className="text-blue-300 font-medium">Head Shifted Right (+{Math.round(headPose.x - 160)}px) — Ready to train</span>
                  ) : headPose.x < 120 ? (
                    <span className="text-blue-300 font-medium">Head Shifted Left ({Math.round(headPose.x - 160)}px) — Ready to train</span>
                  ) : (
                    <span className="text-slate-400">Head Centered in frame</span>
                  )}
                  {headPose.x > 275 && (
                    <div className="text-amber-300 text-[10px] mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      Close to edge: Ensure both eyes stay in frame!
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Ensure your face is well-lit and visible in the webcam feed.
                </p>
              )}
            </div>

            {/* Mode Selector */}
            {!isVerifying && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Calibration Grid</span>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-700/60">
                  <button
                    onClick={() => {
                      setMode('quick5');
                      setClickCounts({});
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'quick5' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Quick 5-Point
                  </button>
                  <button
                    onClick={() => {
                      setMode('full9');
                      setClickCounts({});
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'full9' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Full 9-Point
                  </button>
                </div>
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/60">
              <div className="flex justify-between text-xs font-semibold mb-1 text-slate-300">
                <span>{isVerifying ? 'Verification & Spot-Tune' : `Target: ${activePoint?.label || 'Complete'}`}</span>
                <span className="font-mono tabular-nums text-blue-400">{isVerifying ? '100%' : `${percentComplete}%`}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${isVerifying ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${isVerifying ? 100 : percentComplete}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono tabular-nums">
                {isVerifying
                  ? refinedCount > 0
                    ? `Spot-tuned ${refinedCount}x (${lastRefinedLabel})`
                    : 'Click any target ring on screen to fine-tune'
                  : `${totalClicks} of ${maxPossibleClicks} samples captured`}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700/70 space-y-2 shrink-0">
          {isVerifying ? (
            <button
              onClick={handleFinish}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <span>Start Reading Hands-Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="w-full py-2 px-3 rounded-lg border border-slate-600 hover:bg-slate-700/70 text-slate-300 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Skip directly to Reader</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isVerifying && (
            <button
              onClick={handleResetCalibration}
              className="w-full py-1.5 px-3 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reset All & Recalibrate
            </button>
          )}
        </div>
      </div>

      {/* Main Calibration Area */}
      <div className="flex-1 relative">
        {!isVerifying ? (
          <>
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center pointer-events-none z-40 bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-700/70">
              <h2 className="text-base font-bold text-white">
                {mode === 'quick5' ? 'Quick 5-Point Calibration' : 'Full 9-Point Calibration'}
              </h2>
              <p className="text-xs text-slate-300">
                Stare at the <span className="text-cyan-400 font-semibold">white center pinhole</span> of the highlighted target and click it <strong>{clicksPerPoint} times</strong> (or press <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">Space</kbd>).
              </p>
            </div>
            
            {points.map((p) => {
              const count = clickCounts[p.id] || 0;
              const isComplete = count >= clicksPerPoint;
              const isGuidedActive = activePoint?.id === p.id;
              
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    buttonRefs.current[p.id] = el;
                  }}
                  onClick={(e) => handlePointClick(p, e)}
                  disabled={isComplete}
                  className={`absolute w-14 h-14 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150 z-[50] flex items-center justify-center font-bold font-mono tabular-nums text-xs ${
                    isComplete 
                      ? 'bg-emerald-500/90 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-90 opacity-75 cursor-default ring-2 ring-emerald-400/40' 
                      : isGuidedActive
                      ? 'bg-blue-600 hover:bg-blue-500 text-white scale-110 shadow-[0_0_30px_rgba(59,130,246,0.95)] cursor-pointer ring-4 ring-cyan-400'
                      : count > 0 
                      ? 'bg-amber-500 hover:bg-amber-400 text-white scale-105 shadow-[0_0_25px_rgba(245,158,11,0.9)] cursor-pointer ring-4 ring-amber-400/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-2 border-slate-500 cursor-pointer active:scale-95'
                  }`}
                  style={{ top: p.top, left: p.left }}
                >
                  {isComplete ? (
                    <Check className="w-6 h-6 stroke-[3]" />
                  ) : (
                    <div className="relative flex items-center justify-center w-full h-full">
                      {/* Precision Foveal Pinhole Crosshair */}
                      <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                      <span className="absolute -bottom-5 text-[10px] font-mono tabular-nums bg-slate-900/90 px-1.5 py-0.2 rounded text-slate-200 border border-slate-700">
                        {count}/{clicksPerPoint}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          /* Interactive 5-Target Accuracy Verification & Spot-Refinement Arena */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            {/* 5 Interactive Spot-Tune Targets around the arena */}
            {verificationTargets.map((vt) => (
              <button
                key={vt.id}
                type="button"
                onClick={(e) => handleSpotRefineTarget(vt.label, e)}
                style={{ top: vt.top, left: vt.left }}
                title={`Look closely at this bullseye and click to spot-tune ${vt.label}`}
                className="group absolute -translate-x-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-400/60 group-hover:border-emerald-400 bg-slate-800/80 group-hover:bg-emerald-950/70 flex items-center justify-center transition-all shadow-lg group-active:scale-90">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 group-hover:bg-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                </div>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/80">
                  {vt.label} · Click to tune
                </span>
              </button>
            ))}

            {/* Central Verification Control Panel */}
            <div className="max-w-md w-full bg-slate-800/95 rounded-3xl p-6 border border-slate-700 shadow-2xl backdrop-blur-xs z-30 mt-10">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>Calibration Locked — Live Accuracy Arena</span>
              </div>

              <p className="text-slate-300 text-xs mb-4 leading-relaxed">
                Look at any of the <strong>5 cyan bullseye targets</strong> around the screen. If the glowing gaze dot is slightly off on any target, <strong>stare at that target and click it once</strong> to snap it into alignment!
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 mb-5 text-xs text-left space-y-1.5 text-slate-300">
                <div className="font-semibold text-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    Interactive Spot-Tuning Active
                  </span>
                  {refinedCount > 0 && (
                    <span className="text-[11px] font-mono text-emerald-400">
                      +{refinedCount} tuned ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  • Clicking a target refines both WebGazer&apos;s Ridge Regression and your 2D coordinate offset without wiping your calibration.
                </p>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Enter Reading View</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Test Gaze Point Indicator */}
            {testGazePos && (
              <div 
                className="fixed w-5 h-5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] ring-4 ring-cyan-400/40 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 z-[9999]"
                style={{ left: `${testGazePos.x}px`, top: `${testGazePos.y}px` }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
