import React, { useEffect, useState, useRef } from 'react';
import { AppState } from './types';
import { CalibrationScreen } from './components/CalibrationScreen';
import { ReaderScreen } from './components/ReaderScreen';
import { Eye } from 'lucide-react';
import { loadSettings } from './lib/storage';
import { DualAxisFilter } from './lib/oneEuroFilter';
import { 
  applyHeadPoseCompensation, 
  compensateGazeForHead, 
  initHeadTracker, 
  resetHeadTracker, 
  getHeadPoseGazePoint, 
  seedWebgazerBaseline,
  lockInitial2DCalibration,
  startFullRecalibration,
  compute2DHeadReferencedGaze
} from './lib/headPoseTracker';

// Extend window object for webgazer & custom gaze tracking state
declare global {
  interface Window {
    webgazer: any;
    _gazeSettings?: {
      scrollSpeed: number;
      bottomThresholdPct: number;
      topThresholdPct: number;
      smoothingFactor: number;
      scrollMode?: 'step' | 'continuous';
      trackingSource?: 'hybrid' | 'head' | 'eye';
      isPaused: boolean;
    };
    _gazeState?: {
      consecutiveDown: number;
      consecutiveUp: number;
      isPaused?: boolean;
      lastKnownElementId?: string | null;
      isBlinking?: boolean;
      blinkStartTime?: number;
      lastBlinkTime?: number;
      blinkCount?: number;
      smoothedX?: number;
      smoothedY?: number;
      dwellFrames?: number;
      bottomDwellStart?: number | null;
      topDwellStart?: number | null;
      bottomDwellAccumulator?: number;
      topDwellAccumulator?: number;
      lastTimestamp?: number;
      scrollCooldownUntil?: number;
      subpixelScrollY?: number;
    };
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [isWebgazerLoaded, setIsWebgazerLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const gazeFilterRef = useRef<DualAxisFilter>(new DualAxisFilter(0.5, 0.004));
  const rawMotionRef = useRef<{
    lastX: number;
    lastY: number;
    lastTime: number;
    smoothedVelocity: number;
  }>({
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    smoothedVelocity: 0,
  });

  // Initialize gaze settings immediately on mount
  useEffect(() => {
    const initialSettings = loadSettings();
    window._gazeSettings = {
      scrollSpeed: initialSettings.scrollSpeed,
      bottomThresholdPct: initialSettings.bottomThresholdPct,
      topThresholdPct: initialSettings.topThresholdPct,
      smoothingFactor: initialSettings.smoothingFactor,
      scrollMode: initialSettings.scrollMode || 'step',
      trackingSource: initialSettings.trackingSource || 'hybrid',
      isPaused: false,
    };
  }, []);

  // Reset One-Euro filter velocity & history when recenter occurs
  useEffect(() => {
    const handleGazeRecentered = () => {
      gazeFilterRef.current.reset();
      rawMotionRef.current = { lastX: 0, lastY: 0, lastTime: 0, smoothedVelocity: 0 };
    };
    window.addEventListener('gaze-recentered', handleGazeRecentered);
    return () => window.removeEventListener('gaze-recentered', handleGazeRecentered);
  }, []);

  // Initialize WebGazer script loader
  useEffect(() => {
    let checkInterval: number;
    
    // Wait for the script to load globally
    const checkWebgazer = () => {
      if (window.webgazer) {
        setIsWebgazerLoaded(true);
        clearInterval(checkInterval);
      }
    };
    
    checkInterval = window.setInterval(checkWebgazer, 100);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!window.webgazer) {
        setLoadingError("Failed to load the eye-tracking library from CDN. Please check your connection or try disabling ad blockers.");
      }
    }, 30000);
    
    return () => {
      clearInterval(checkInterval);
      try {
        if (window.webgazer && window.webgazer.isReady && window.webgazer.isReady()) {
          window.webgazer.end();
        }
      } catch (e) {
        console.warn("Error during webgazer cleanup:", e);
      }
    };
  }, []);

  const startTracking = async () => {
    if (!window.webgazer) return;
    
    setAppState('CALIBRATING');
    setLoadingError(null);
    
    try {
      window.webgazer.saveDataAcrossSessions(false);
      // Explicitly set tracker to TFFacemesh (MediaPipe 468 landmarks)
      if (typeof window.webgazer.setTracker === 'function') {
        window.webgazer.setTracker("TFFacemesh");
      }
      // Seed baseline anchor points so predict() immediately returns live coordinates
      seedWebgazerBaseline();

      await window.webgazer
        .setGazeListener((data: any, elapsedTime: number) => {
          // Initialize state if not present
          if (!window._gazeState) {
            window._gazeState = { 
              consecutiveDown: 0, 
              consecutiveUp: 0, 
              lastKnownElementId: null,
              isBlinking: false,
              blinkStartTime: 0,
              lastBlinkTime: 0,
              blinkCount: 0,
              dwellFrames: 0,
            };
          }

          // Retrieve active settings
          const currentSettings = window._gazeSettings || {
            scrollSpeed: 1.0,
            bottomThresholdPct: 0.22,
            topThresholdPct: 0.18,
            smoothingFactor: 0.45,
            scrollMode: 'step',
            trackingSource: 'hybrid',
            isPaused: false,
          };

          let rawTargetX: number | null = null;
          let rawTargetY: number | null = null;

          const trackingSource = currentSettings.trackingSource || 'hybrid';
          if (trackingSource === 'head') {
            const headPoint = getHeadPoseGazePoint(window.innerWidth, window.innerHeight);
            if (headPoint.detected && !isNaN(headPoint.x) && !isNaN(headPoint.y)) {
              rawTargetX = headPoint.x;
              rawTargetY = headPoint.y;
            }
          }

          // If not head mode or head mode not detected, try eye gaze data
          if ((rawTargetX === null || rawTargetY === null) && data && typeof data.x === 'number' && typeof data.y === 'number' && !isNaN(data.x) && !isNaN(data.y)) {
            // Keep latestRawGaze updated for exact uncompensated recenter calculations
            initHeadTracker();
            if (window._headTrackerState) {
              window._headTrackerState.latestRawGaze = { x: data.x, y: data.y };
            }

            if (trackingSource === 'hybrid') {
              const compensated = applyHeadPoseCompensation(data.x, data.y);
              if (!isNaN(compensated.x) && !isNaN(compensated.y)) {
                rawTargetX = compensated.x;
                rawTargetY = compensated.y;
              }
            } else {
              const manX = window._headTrackerState?.manualOffsetX || 0;
              const manY = window._headTrackerState?.manualOffsetY || 0;
              rawTargetX = Math.max(0, Math.min(window.innerWidth, data.x + manX));
              rawTargetY = Math.max(0, Math.min(window.innerHeight, data.y + manY));
            }
          }

          // Blink detection or signal loss
          if (rawTargetX === null || rawTargetY === null || isNaN(rawTargetX) || isNaN(rawTargetY)) {
            if (!window._gazeState.isBlinking) {
              window._gazeState.isBlinking = true;
              window._gazeState.blinkStartTime = Date.now();
            }
            return;
          } else {
            window._gazeState.isBlinking = false;
          }

          const now = performance.now();

          // 1. Calculate eye movement velocity & position-based center stability
          const motion = rawMotionRef.current;
          let currentVelocity = 0;
          if (motion.lastTime > 0) {
            const dtVelocity = Math.max(0.001, (now - motion.lastTime) / 1000.0);
            const dist = Math.hypot(rawTargetX - motion.lastX, rawTargetY - motion.lastY);
            const instVelocity = dist / dtVelocity; // pixels per second
            // Smooth velocity with leaky moving average to reject single-frame tracking noise
            motion.smoothedVelocity = (instVelocity * 0.35) + (motion.smoothedVelocity * 0.65);
            currentVelocity = motion.smoothedVelocity;
          }
          motion.lastX = rawTargetX;
          motion.lastY = rawTargetY;
          motion.lastTime = now;

          // 2. Normalized velocity scale: 0 = stationary reading fixation, 1 = rapid saccade / glance
          const speedNorm = Math.min(1.0, currentVelocity / 950.0);

          // 3. Screen Center Proximity (1.0 at screen center, 0.0 near top/bottom scroll margins)
          const screenHeight = window.innerHeight || 800;
          const distFromCenterNorm = Math.min(1.0, Math.abs(rawTargetY - (screenHeight * 0.5)) / (screenHeight * 0.5));
          // Quadratic ease: creates a wide, calm sweet spot across the central reading corridor
          const centerReadingFactor = Math.max(0.0, 1.0 - Math.pow(distFromCenterNorm / 0.70, 2));

          // 4. Dynamically compute One-Euro filter minCutoff and beta:
          // Center reading at low velocity: minCutoff = 0.65 Hz, beta = 0.0045 (solid stability)
          // Margins or rapid saccades: minCutoff up to 3.2 Hz, beta up to 0.03 (lightning-fast response for scrolling)
          const dynamicMinCutoff = 0.65 + (1.20 * (1.0 - centerReadingFactor)) + (1.35 * speedNorm);
          const dynamicBeta = 0.0045 + (0.008 * (1.0 - centerReadingFactor)) + (0.018 * speedNorm);

          // Adaptive One-Euro Filter with dynamically calculated constants
          const filtered = gazeFilterRef.current.filter(rawTargetX, rawTargetY, now, dynamicMinCutoff, dynamicBeta);
          const currentX = filtered.x;
          const currentY = filtered.y;
          window._gazeState.smoothedX = currentX;
          window._gazeState.smoothedY = currentY;

          // Visual indicator position update
          const indicator = document.getElementById('gaze-indicator');
          if (indicator) {
            indicator.style.opacity = '1';
            indicator.style.left = `${currentX}px`;
            indicator.style.top = `${currentY}px`;
          }

          // Active Reading mode interactions
          const isPaused = currentSettings.isPaused || window._gazeState?.isPaused;
          if (document.getElementById('reader-mode-active') && !isPaused) {
            
            const bottomPct = currentSettings.bottomThresholdPct ?? 0.22;
            const topPct = currentSettings.topThresholdPct ?? 0.18;
            const bottomThreshold = screenHeight * (1 - bottomPct);
            const topThreshold = screenHeight * topPct;
            const scrollMode = currentSettings.scrollMode ?? 'step';
            const speedMultiplier = Math.max(0.4, currentSettings.scrollSpeed ?? 1.0);
            const dwellProgressEl = document.getElementById('gaze-dwell-progress');
            const topDwellProgressEl = document.getElementById('gaze-top-dwell-progress');

            // Always update lastTimestamp with a tightly clamped dt on EVERY frame
            const lastTime = window._gazeState.lastTimestamp || now;
            const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000.0));
            window._gazeState.lastTimestamp = now;

            const isCooldown = (window._gazeState.scrollCooldownUntil || 0) > now;
            const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const canScrollUp = currentScrollY > 10;
            
            // Allow scroll trigger anywhere across reading viewport (protect controls only deep in sidebar x < 180)
            const isInsideSidebar = currentX < 180;
            const inAdvanceZone = !isInsideSidebar && currentY > bottomThreshold;
            const inRetreatZone = !isInsideSidebar && currentY < topThreshold && canScrollUp;

            if (scrollMode === 'step') {
              // Deliberate 500ms dwell at 1.0x speed, scales inversely with user scroll speed setting
              const baseDwellSec = Math.max(0.35, 0.50 / speedMultiplier);

              if (inAdvanceZone && !isCooldown) {
                // Charge bottom accumulator
                window._gazeState.bottomDwellAccumulator = Math.min(
                  1.0, 
                  (window._gazeState.bottomDwellAccumulator || 0) + (dt / baseDwellSec)
                );
                // Drain opposing top accumulator
                window._gazeState.topDwellAccumulator = Math.max(
                  0, 
                  (window._gazeState.topDwellAccumulator || 0) - (dt * 2.5 / baseDwellSec)
                );
                if (indicator) {
                  indicator.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
                  indicator.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.7)';
                }
              } else if (inRetreatZone && !isCooldown) {
                // Charge top accumulator
                window._gazeState.topDwellAccumulator = Math.min(
                  1.0, 
                  (window._gazeState.topDwellAccumulator || 0) + (dt / baseDwellSec)
                );
                // Drain opposing bottom accumulator
                window._gazeState.bottomDwellAccumulator = Math.max(
                  0, 
                  (window._gazeState.bottomDwellAccumulator || 0) - (dt * 2.5 / baseDwellSec)
                );
                if (indicator) {
                  indicator.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
                  indicator.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.7)';
                }
              } else {
                // In neutral reading corridor or sidebar:
                // Forgiving decay so natural reading saccades or micro-blinks don't harsh-wipe progress
                window._gazeState.bottomDwellAccumulator = Math.max(
                  0, 
                  (window._gazeState.bottomDwellAccumulator || 0) - (dt * 1.1 / baseDwellSec)
                );
                window._gazeState.topDwellAccumulator = Math.max(
                  0, 
                  (window._gazeState.topDwellAccumulator || 0) - (dt * 1.1 / baseDwellSec)
                );
                if (indicator) {
                  indicator.style.backgroundColor = '';
                  indicator.style.boxShadow = '';
                }
              }

              // Update visual progress bars
              const bProgress = window._gazeState.bottomDwellAccumulator || 0;
              const tProgress = window._gazeState.topDwellAccumulator || 0;
              const bPct = isCooldown ? 0 : Math.min(100, Math.round(bProgress * 100));
              const tPct = isCooldown ? 0 : Math.min(100, Math.round(tProgress * 100));

              if (dwellProgressEl) {
                dwellProgressEl.style.width = `${bPct}%`;
                dwellProgressEl.style.opacity = bPct > 0 ? '1' : '0';
              }
              if (topDwellProgressEl) {
                topDwellProgressEl.style.width = `${tPct}%`;
                topDwellProgressEl.style.opacity = tPct > 0 ? '1' : '0';
              }

              // Fire paragraph advance (scaled comfortably with speed)
              if (bProgress >= 1.0 && !isCooldown) {
                const advanceAmount = Math.round(Math.min(screenHeight * 0.40, 240 * Math.max(0.7, speedMultiplier)));
                window.scrollBy({ top: advanceAmount, behavior: 'smooth' });
                window._gazeState.bottomDwellAccumulator = 0;
                // Restful cooldown: guarantees text remains still for reader to find new anchor lines
                window._gazeState.scrollCooldownUntil = now + Math.max(550, 750 / speedMultiplier);
                if (dwellProgressEl) {
                  dwellProgressEl.style.width = '100%';
                  setTimeout(() => {
                    if (dwellProgressEl) dwellProgressEl.style.opacity = '0';
                  }, 120);
                }
              }

              // Fire paragraph retreat (scroll up)
              if (tProgress >= 1.0 && !isCooldown) {
                const retreatAmount = Math.round(Math.min(screenHeight * 0.40, 240 * Math.max(0.7, speedMultiplier)));
                window.scrollBy({ top: -retreatAmount, behavior: 'smooth' });
                window._gazeState.topDwellAccumulator = 0;
                window._gazeState.scrollCooldownUntil = now + Math.max(550, 750 / speedMultiplier);
                if (topDwellProgressEl) {
                  topDwellProgressEl.style.width = '100%';
                  setTimeout(() => {
                    if (topDwellProgressEl) topDwellProgressEl.style.opacity = '0';
                  }, 120);
                }
              }

            } else {
              // Continuous Teleprompter Mode:
              // Glides down/up proportional to gaze depth beyond the threshold.
              // Uses subpixel accumulator so browser float truncation NEVER freezes the page.
              const maxVelocityPxPerSec = 135 * speedMultiplier;

              if (inAdvanceZone) {
                const depth = Math.min(1, Math.max(0, (currentY - bottomThreshold) / Math.max(20, screenHeight - bottomThreshold)));
                const smoothDepth = depth * depth;
                const scrollPixels = smoothDepth * maxVelocityPxPerSec * dt;

                window._gazeState.subpixelScrollY = (window._gazeState.subpixelScrollY || 0) + scrollPixels;
                const intPixels = Math.trunc(window._gazeState.subpixelScrollY);
                if (intPixels !== 0) {
                  window.scrollBy({ top: intPixels, behavior: 'auto' });
                  window._gazeState.subpixelScrollY -= intPixels;
                }
                if (indicator) {
                  indicator.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
                  indicator.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.6)';
                }
              } else if (inRetreatZone) {
                const depth = Math.min(1, Math.max(0, (topThreshold - currentY) / Math.max(20, topThreshold)));
                const smoothDepth = depth * depth;
                const scrollPixels = smoothDepth * (maxVelocityPxPerSec * 0.9) * dt;

                window._gazeState.subpixelScrollY = (window._gazeState.subpixelScrollY || 0) - scrollPixels;
                const intPixels = Math.trunc(window._gazeState.subpixelScrollY);
                if (intPixels !== 0) {
                  window.scrollBy({ top: intPixels, behavior: 'auto' });
                  window._gazeState.subpixelScrollY -= intPixels;
                }
                if (indicator) {
                  indicator.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
                  indicator.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.6)';
                }
              } else {
                window._gazeState.subpixelScrollY = 0;
                if (indicator) {
                  indicator.style.backgroundColor = '';
                  indicator.style.boxShadow = '';
                }
              }

              if (dwellProgressEl) dwellProgressEl.style.opacity = '0';
              if (topDwellProgressEl) topDwellProgressEl.style.opacity = '0';
            }

            // 2. Button Dwell Logic for Sidebar Action Controls
            if (indicator) indicator.style.pointerEvents = 'none';
            const hoveredElement = document.elementFromPoint(currentX, currentY);
            const targetBtn = hoveredElement?.closest('[data-gaze-action]') as HTMLElement | null;
            
            // Clear hover styling from non-targeted buttons
            document.querySelectorAll('.gaze-hovered').forEach(el => {
              if (el !== targetBtn) {
                el.classList.remove('gaze-hovered', 'ring-2', 'ring-blue-500', 'scale-105');
                const fill = el.querySelector('.dwell-fill') as HTMLElement | null;
                if (fill) fill.style.height = '0%';
              }
            });
            
            if (targetBtn) {
              const targetId = targetBtn.id || targetBtn.getAttribute('data-gaze-action') || 'btn';
              targetBtn.classList.add('gaze-hovered', 'ring-2', 'ring-blue-500', 'scale-105');
              
              if (window._gazeState.lastKnownElementId === targetId) {
                window._gazeState.dwellFrames = (window._gazeState.dwellFrames || 0) + 1;
                
                const fillEl = targetBtn.querySelector('.dwell-fill') as HTMLElement | null;
                if (fillEl) {
                  const pct = Math.min(100, Math.round((window._gazeState.dwellFrames / 30) * 100));
                  fillEl.style.height = `${pct}%`;
                }

                // ~30 frames corresponds to approx 500ms of steady intentional glance
                if (window._gazeState.dwellFrames > 30 && !scrollTimeoutRef.current) {
                  const action = targetBtn.getAttribute('data-gaze-action');
                  const isDown = action === 'scroll-down' || targetId.includes('down');
                  const scrollAmount = Math.min(window.innerHeight * 0.45, 260);
                  
                  window.scrollBy({ 
                    top: isDown ? scrollAmount : -scrollAmount, 
                    behavior: 'smooth' 
                  });
                  
                  targetBtn.classList.add('brightness-125');
                  setTimeout(() => targetBtn.classList.remove('brightness-125'), 350);

                  window._gazeState.dwellFrames = 0;
                  if (fillEl) fillEl.style.height = '0%';

                  scrollTimeoutRef.current = window.setTimeout(() => {
                    scrollTimeoutRef.current = null;
                  }, 650);
                }
              } else {
                window._gazeState.lastKnownElementId = targetId;
                window._gazeState.dwellFrames = 0;
              }
            } else {
              window._gazeState.lastKnownElementId = null;
              window._gazeState.dwellFrames = 0;
            }
          }
        })
        .begin();
        
        // Remove default mouse event listeners so moving/clicking the mouse never hijacks or retrains gaze predictions
        if (typeof window.webgazer.removeMouseEventListeners === 'function') {
          window.webgazer.removeMouseEventListeners();
        }

        // Hide standard webgazer prediction points during calibration or show as needed
        window.webgazer.showVideoPreview(true).showPredictionPoints(true);
    } catch (err: any) {
      console.error("Failed to start webgazer:", err);
      setAppState('IDLE');
      setLoadingError("Camera permission denied. Please click the icon in your address bar to allow camera access, then try again.");
      
      try {
        if (window.webgazer) {
          window.webgazer.end();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  const handleCalibrationComplete = () => {
    // Ensure mouse movement listeners are completely stripped
    if (typeof window.webgazer?.removeMouseEventListeners === 'function') {
      window.webgazer.removeMouseEventListeners();
    }
    // Lock the 2D Head Reference Point at completion of 9-point calibration
    lockInitial2DCalibration();
    setAppState('READING');
    rawMotionRef.current = { lastX: 0, lastY: 0, lastTime: 0, smoothedVelocity: 0 };
    gazeFilterRef.current.reset();
    // Hide standard webgazer video/prediction points during reading
    window.webgazer.showVideoPreview(false).showPredictionPoints(false);
  };

  if (appState === 'IDLE') {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xs">
              <Eye className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-2 tracking-tight">Gaze Reader</h1>
            <p className="text-stone-600 text-sm mb-6 leading-relaxed">
              Read long PDFs, research manuscripts, and notes completely hands-free using webcam pupil tracking.
            </p>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 mb-6 text-left space-y-2 text-xs text-stone-600">
              <div className="flex items-center gap-2 font-semibold text-stone-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                New in this version:
              </div>
              <ul className="space-y-1 list-disc list-inside opacity-90 pl-1">
                <li>Upload custom PDFs, plain text (.txt), and Markdown (.md)</li>
                <li>Saved reading progress memory per document</li>
                <li>Customizable scroll speed, trigger zones & themes (Sepia, Dark, E-Ink)</li>
              </ul>
            </div>
            
            {loadingError ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 mb-4">
                {loadingError}
              </div>
            ) : !isWebgazerLoaded ? (
              <div className="flex items-center justify-center gap-2.5 text-stone-500 py-3 text-sm">
                <div className="w-4 h-4 border-2 border-stone-300 border-t-blue-600 rounded-full animate-spin" />
                Loading Eye-Tracking Engine...
              </div>
            ) : (
              <button
                onClick={startTracking}
                className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
              >
                Enable Camera & Calibrate
              </button>
            )}
            
            <p className="mt-5 text-[11px] text-stone-400">
              Your video stream is processed 100% locally in your browser. No video or biometric data is ever stored or transmitted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'CALIBRATING') {
    return <CalibrationScreen onCalibrationComplete={handleCalibrationComplete} />;
  }

  const handleRecalibrate = async () => {
    if (window.webgazer) {
      if (typeof window.webgazer.removeMouseEventListeners === 'function') {
        window.webgazer.removeMouseEventListeners();
      }
      // Step A & B: Wipe WebGazer old regressions and 2D Head Reference state so they don't fight new calibration
      startFullRecalibration();
      seedWebgazerBaseline();
      rawMotionRef.current = { lastX: 0, lastY: 0, lastTime: 0, smoothedVelocity: 0 };
      gazeFilterRef.current.reset();
      if (window._gazeState) {
        window._gazeState.smoothedX = undefined;
        window._gazeState.smoothedY = undefined;
        window._gazeState.bottomDwellStart = null;
        window._gazeState.topDwellStart = null;
        window._gazeState.bottomDwellAccumulator = 0;
        window._gazeState.topDwellAccumulator = 0;
        window._gazeState.subpixelScrollY = 0;
      }
      if (typeof window.webgazer.setVideoViewerSize === 'function') {
        window.webgazer.setVideoViewerSize(320, 240);
      }
      window.webgazer.showVideoPreview(true).showPredictionPoints(true);
      setAppState('CALIBRATING');
    }
  };

  return (
    <>
      <div id="reader-mode-active" className="hidden" />
      <ReaderScreen documentId="demo-research-paper" onRecalibrate={handleRecalibrate} />
    </>
  );
}
