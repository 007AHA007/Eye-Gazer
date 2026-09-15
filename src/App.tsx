import React, { useEffect, useState, useRef } from 'react';
import { AppState } from './types';
import { CalibrationScreen } from './components/CalibrationScreen';
import { ReaderScreen } from './components/ReaderScreen';
import { Eye, Settings } from 'lucide-react';

// Using dynamic import for webgazer as it might not be compatible with standard ESM imports in all environments
declare global {
  interface Window {
    webgazer: any;
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
    };
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [isWebgazerLoaded, setIsWebgazerLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Initialize WebGazer
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
              blinkCount: 0
            };
          }

          // Blink Detection Logic (using null data as a proxy for closed eyes)
          if (!data) {
            if (!window._gazeState.isBlinking) {
              window._gazeState.isBlinking = true;
              window._gazeState.blinkStartTime = Date.now();
            }
            return;
          }

          // Smooth the coordinates to prevent erratic jittering
          const smoothingFactor = 0.3; // Increased for better responsiveness while still smoothing
          if (window._gazeState.smoothedX === undefined || window._gazeState.smoothedY === undefined) {
            window._gazeState.smoothedX = data.x;
            window._gazeState.smoothedY = data.y;
          } else {
            window._gazeState.smoothedX += (data.x - window._gazeState.smoothedX) * smoothingFactor;
            window._gazeState.smoothedY += (data.y - window._gazeState.smoothedY) * smoothingFactor;
          }

          const currentX = window._gazeState.smoothedX;
          const currentY = window._gazeState.smoothedY;
          
          // Visual indicator update
          const indicator = document.getElementById('gaze-indicator');
          if (indicator) {
            indicator.style.opacity = '1';
            indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
          }

          // Track what we are looking at (Gaze Hover & Dwell)
          if (document.getElementById('reader-mode-active') && !window._gazeState?.isPaused) {
            
            // 1. Natural Reading Auto-Scroll (Continuous Teleprompter Style)
            const screenHeight = window.innerHeight;
            const bottomThreshold = screenHeight * 0.70; // Bottom 30%
            const topThreshold = screenHeight * 0.25; // Top 25%
            
            // X threshold: > 250 to ensure they are off the sidebar
            if (currentX > 250) { 
              if (currentY > bottomThreshold) {
                // Looked at bottom -> Scroll Down continuously
                const depth = Math.min(1, (currentY - bottomThreshold) / (screenHeight - bottomThreshold));
                // Speed scales based on how far down they look (2px to 15px per frame)
                const speed = 2 + (depth * 13);
                window.scrollBy({ top: speed, behavior: 'auto' });
                
                if (indicator) indicator.style.backgroundColor = 'rgba(34, 197, 94, 0.7)'; // Green tint
                
              } else if (currentY < topThreshold) {
                // Looked at top -> Scroll Up continuously
                const depth = Math.min(1, (topThreshold - currentY) / topThreshold);
                const speed = 2 + (depth * 13);
                window.scrollBy({ top: -speed, behavior: 'auto' });
                
                if (indicator) indicator.style.backgroundColor = 'rgba(59, 130, 246, 0.7)'; // Blue tint
                
              } else {
                // Neutral zone (middle of text)
                if (indicator) indicator.style.backgroundColor = '';
              }
            } else {
               // Looking at sidebar
               if (indicator) indicator.style.backgroundColor = '';
            }

            // 2. Button Dwell Logic
            // Find element under gaze
            if (indicator) indicator.style.pointerEvents = 'none';
            const hoveredElement = document.elementFromPoint(currentX, currentY);
            const targetBtn = hoveredElement?.closest('[data-gaze-action]');
            
            // Manage hover styling
            document.querySelectorAll('.gaze-hovered').forEach(el => el.classList.remove('gaze-hovered', 'ring-2', 'ring-blue-500', 'bg-blue-50'));
            
            if (targetBtn) {
              const targetId = targetBtn.id;
              targetBtn.classList.add('gaze-hovered', 'ring-2', 'ring-blue-500', 'bg-blue-50');
              
              // Dwell logic
              if (window._gazeState.lastKnownElementId === targetId) {
                // Keep dwelling
                window._gazeState.dwellFrames = (window._gazeState.dwellFrames || 0) + 1;
                
                // If looked at for approx 1.5 seconds (assuming ~30-60fps, let's say 40 frames)
                if (window._gazeState.dwellFrames > 40 && !scrollTimeoutRef.current) {
                  // Trigger Action!
                  const scrollAmount = Math.min(window.innerHeight * 0.7, 400);
                  window.scrollBy({ 
                    top: targetId === 'scroll-down-btn' ? scrollAmount : -scrollAmount, 
                    behavior: 'smooth' 
                  });
                  
                  // Visual flash
                  targetBtn.classList.add('bg-blue-200');
                  setTimeout(() => targetBtn.classList.remove('bg-blue-200'), 500);

                  window._gazeState.dwellFrames = 0; // Reset
                  scrollTimeoutRef.current = window.setTimeout(() => {
                    scrollTimeoutRef.current = null;
                  }, 2000); // 2 second cooldown
                }
              } else {
                // Started looking at a new button
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
        
        // Hide the video preview during calibration to focus on dots, or keep it.
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
    setAppState('READING');
    // Hide standard webgazer UI during reading
    window.webgazer.showVideoPreview(false).showPredictionPoints(false);
  };

  if (appState === 'IDLE') {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Eye className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 mb-2">Gaze Reader</h1>
            <p className="text-stone-600 mb-8">
              Navigate dense research papers and long PDFs using just your eyes. The page will automatically smooth-scroll when you look at the bottom.
            </p>
            
            {loadingError ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                {loadingError}
              </div>
            ) : !isWebgazerLoaded ? (
              <div className="flex items-center justify-center gap-2 text-stone-500">
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                Loading Eye-Tracking Engine...
              </div>
            ) : (
              <button
                onClick={startTracking}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                Enable Camera & Calibrate
              </button>
            )}
            
            <p className="mt-6 text-xs text-stone-400">
              Your camera feed is processed entirely locally in your browser. No video is ever sent to a server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'CALIBRATING') {
    return <CalibrationScreen onCalibrationComplete={handleCalibrationComplete} />;
  }

  const handleRecalibrate = () => {
    if (window.webgazer) {
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
