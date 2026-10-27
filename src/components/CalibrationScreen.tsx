import React, { useEffect, useState } from 'react';
import { recordHeadBaseline, resetHeadTracker, sampleHeadPose, HeadPose, seedWebgazerBaseline } from '../lib/headPoseTracker';
import { CheckCircle2, ArrowRight, Eye, RefreshCw, Sparkles, Check, AlertTriangle, UserCheck } from 'lucide-react';

interface Props {
  onCalibrationComplete: () => void;
}

type CalibrationMode = 'quick5' | 'full9';

export function CalibrationScreen({ onCalibrationComplete }: Props) {
  const [mode, setMode] = useState<CalibrationMode>('quick5');
  const [clickCounts, setClickCounts] = useState<Record<number, number>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [testGazePos, setTestGazePos] = useState<{ x: number; y: number } | null>(null);
  const [headPose, setHeadPose] = useState<HeadPose | null>(null);

  // When Calibration Screen mounts: WIPE all previous data and seed initial anchor points
  useEffect(() => {
    if (window.webgazer) {
      try {
        if (typeof window.webgazer.removeMouseEventListeners === 'function') {
          window.webgazer.removeMouseEventListeners();
        }
        if (typeof window.webgazer.clearData === 'function') {
          window.webgazer.clearData();
          seedWebgazerBaseline();
        }
        if (typeof window.webgazer.setVideoViewerSize === 'function') {
          window.webgazer.setVideoViewerSize(320, 240);
        }
      } catch (err) {
        console.warn("Could not clear webgazer state on mount:", err);
      }
    }
    resetHeadTracker();
    if (window._gazeState) {
      window._gazeState.smoothedX = undefined;
      window._gazeState.smoothedY = undefined;
      window._gazeState.bottomDwellStart = null;
      window._gazeState.topDwellStart = null;
    }
  }, []);

  // Poll live head posture at 10Hz to give instant visibility feedback
  useEffect(() => {
    const interval = setInterval(() => {
      const pose = sampleHeadPose();
      setHeadPose({ ...pose });
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // 5-point fast calibration (Center + 4 corners)
  const quickPoints = [
    { id: 1, top: '20%', left: '20%' },
    { id: 2, top: '20%', left: '80%' },
    { id: 3, top: '50%', left: '50%' },
    { id: 4, top: '80%', left: '20%' },
    { id: 5, top: '80%', left: '80%' },
  ];

  // 9-point comprehensive grid
  const fullPoints = [
    { id: 1, top: '15%', left: '15%' },
    { id: 2, top: '15%', left: '50%' },
    { id: 3, top: '15%', left: '85%' },
    { id: 4, top: '50%', left: '15%' },
    { id: 5, top: '50%', left: '50%' },
    { id: 6, top: '50%', left: '85%' },
    { id: 7, top: '85%', left: '15%' },
    { id: 8, top: '85%', left: '50%' },
    { id: 9, top: '85%', left: '85%' },
  ];

  const points = mode === 'quick5' ? quickPoints : fullPoints;
  const clicksPerPoint = mode === 'quick5' ? 3 : 5;

  const handlePointClick = (id: number, e: React.MouseEvent) => {
    // Explicitly record exact screen coordinates into WebGazer's regression
    if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
      window.webgazer.recordScreenPosition(e.clientX, e.clientY, 'click');
    }

    setClickCounts(prev => {
      const newCounts = { ...prev, [id]: (prev[id] || 0) + 1 };
      return newCounts;
    });
  };

  const totalClicks = (Object.values(clickCounts) as number[]).reduce((a, b) => a + b, 0);
  const maxPossibleClicks = points.length * clicksPerPoint;
  const percentComplete = Math.min(100, Math.round((totalClicks / maxPossibleClicks) * 100));

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
      if (window._gazeState?.smoothedX && window._gazeState?.smoothedY) {
        setTestGazePos({
          x: window._gazeState.smoothedX,
          y: window._gazeState.smoothedY,
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isVerifying]);

  const handleResetCalibration = () => {
    setClickCounts({});
    setIsVerifying(false);
    resetHeadTracker();
    if (window.webgazer && window.webgazer.clearData) {
      window.webgazer.clearData();
      seedWebgazerBaseline();
    }
  };

  const handleFinish = () => {
    if (typeof window.webgazer?.removeMouseEventListeners === 'function') {
      window.webgazer.removeMouseEventListeners();
    }
    recordHeadBaseline();
    // Ensure regression matrix has baseline anchor points if skipped
    seedWebgazerBaseline();
    onCalibrationComplete();
  };

  return (
    <div className="fixed inset-0 flex bg-slate-900 text-white font-sans select-none">
      <style>{`
        #webgazerVideoContainer {
          top: 0 !important;
          left: 0 !important;
          width: 320px !important;
          height: 240px !important;
          border-bottom: 1px solid #334155;
          background-color: #000;
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
              <h2 className="text-base font-bold text-slate-100">Eye-Tracker Calibration</h2>
              <p className="text-xs text-slate-400">
                Stare directly at each circle and click it.
              </p>
            </div>

            {/* Live Head Position Monitor */}
            <div className="p-2.5 rounded-xl border border-slate-700/60 bg-slate-900/60 text-xs">
              <div className="flex items-center justify-between font-semibold mb-1">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Head In Webcam:
                </span>
                <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${headPose?.detected ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                  {headPose?.detected ? 'Detected ✓' : 'Detecting...'}
                </span>
              </div>
              
              {headPose?.detected ? (
                <div className="text-[11px] text-slate-300">
                  {headPose.x > 200 ? (
                    <span className="text-blue-300 font-medium">Head Shifted Right (+{Math.round(headPose.x - 160)}px) — System will train for this posture!</span>
                  ) : headPose.x < 120 ? (
                    <span className="text-blue-300 font-medium">Head Shifted Left ({Math.round(headPose.x - 160)}px) — Ready to train!</span>
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mode</span>
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
                <span>{isVerifying ? 'Calibration Ready' : 'Sampling Progress'}</span>
                <span className="font-mono text-blue-400">{isVerifying ? '100%' : `${percentComplete}%`}</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${isVerifying ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${isVerifying ? 100 : percentComplete}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {isVerifying ? 'Points mapped to your posture' : `${totalClicks} of ${maxPossibleClicks} clicks registered`}
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
              Recalibrate Points
            </button>
          )}
        </div>
      </div>

      {/* Main Calibration Area */}
      <div className="flex-1 relative">
        {!isVerifying ? (
          <>
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none z-50">
              <h2 className="text-xl font-bold mb-1 text-white">
                {mode === 'quick5' ? 'Quick 5-Point Calibration' : 'Full 9-Point Calibration'}
              </h2>
              <p className="text-xs text-slate-400">
                Stare directly at the circle and click it <strong>{clicksPerPoint} times</strong>.
              </p>
            </div>
            
            {points.map((p) => {
              const count = clickCounts[p.id] || 0;
              const isComplete = count >= clicksPerPoint;
              
              return (
                <button
                  key={p.id}
                  onClick={(e) => handlePointClick(p.id, e)}
                  disabled={isComplete}
                  className={`absolute w-12 h-12 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150 z-[50] flex items-center justify-center font-bold text-xs ${
                    isComplete 
                      ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-95 opacity-80 cursor-default ring-4 ring-emerald-400/30' 
                      : count > 0 
                      ? 'bg-amber-500 hover:bg-amber-400 text-white scale-110 shadow-[0_0_25px_rgba(245,158,11,0.9)] cursor-pointer ring-4 ring-amber-400/50'
                      : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.8)] cursor-pointer ring-4 ring-red-400/40 active:scale-95'
                  }`}
                  style={{ top: p.top, left: p.left }}
                >
                  {isComplete ? (
                    <Check className="w-6 h-6 stroke-[3]" />
                  ) : (
                    <span>{count}/{clicksPerPoint}</span>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          /* Live Accuracy Verification Screen */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md w-full bg-slate-800/90 rounded-3xl p-8 border border-slate-700 shadow-2xl backdrop-blur-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Calibration Successful!</h2>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                Move your eyes around the screen. You should see the glowing gaze dot following your focus.
              </p>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 mb-6 text-xs text-left space-y-2 text-slate-300">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Calibrated for Your Current Posture:
                </div>
                <p>
                  • <strong>Reading Flow:</strong> The page remains completely static while reading, and gently glides down only when your eyes finish a page.
                </p>
                <p>
                  • <strong>Press R:</strong> If you shift your sitting posture again later, press <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono font-bold">R</kbd> to re-anchor in 0.1s.
                </p>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
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
