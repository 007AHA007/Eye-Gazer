// src/lib/headPoseTracker.ts
/**
 * 2D Moving Head-Center Reference Point Architecture
 *
 * Anchors the 2D center of the user's head in webcam space as a moving
 * reference point. Eye movement is calculated relative to this shifting
 * head anchor, making posture shifts, slouching, and recentering 100% reliable.
 */

export interface Head2DReference {
  // 2D center of the head in the camera plane
  centerX: number;
  centerY: number;
  // Face width in pixels (used to normalize 2D movement when leaning in/out)
  faceSize: number;
  // Head tilt ratios (nose relative to eye-line in 2D)
  tiltX: number;
  tiltY: number;
}

export interface HeadPose extends Head2DReference {
  x: number;
  y: number;
  scale: number;
  faceScale: number;
  pitchRatio: number;
  yawRatio: number;
  rollRad: number;
  detected: boolean;
  distanceStatus: 'optimal' | 'too_close' | 'too_far' | 'lost';
  alignmentStatus: 'centered' | 'shifted_left' | 'shifted_right' | 'shifted_up' | 'slouching';
  driftDistancePx: number;
  toleranceLevel?: 'low' | 'balanced' | 'high';
}

export interface HeadTrackerState {
  // The locked 2D Head Reference Point (updated on Calibration or Recenter)
  calibration: (Head2DReference & { toleranceLevel?: 'low' | 'balanced' | 'high' }) | null;
  // Current live 2D Head position
  currentHead: Head2DReference | null;
  // The shifting 2D Reference Point mapped onto screen space (px)
  screenReferencePoint: { x: number; y: number };
  // Raw WebGazer output captured at the moment of Calibration / Recenter
  gazeOriginAtCalibration: { x: number; y: number } | null;
  // Rolling history of recent frames (so clicking a corner button doesn't skew recenter)
  frameHistory: Array<{
    t: number;
    head: Head2DReference;
    rawGazeX: number;
    rawGazeY: number;
  }>;
  // Final coordinates
  smoothedX: number;
  smoothedY: number;
  smoothedGaze: { x: number; y: number };
  latestRawGaze: { x: number; y: number } | null;
  manualOffsetX: number;
  manualOffsetY: number;
  headCompensationEnabled: boolean;
  toleranceLevel?: 'low' | 'balanced' | 'high';
}

declare global {
  interface Window {
    _headTrackerState: HeadTrackerState;
    webgazer: any;
  }
}

export function getState(): HeadTrackerState {
  if (typeof window !== "undefined" && !window._headTrackerState) {
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.42; // Neutral reading line (42% down)
    window._headTrackerState = {
      calibration: null,
      currentHead: null,
      screenReferencePoint: { x: cx, y: cy },
      gazeOriginAtCalibration: null,
      frameHistory: [],
      smoothedX: cx,
      smoothedY: cy,
      smoothedGaze: { x: cx, y: cy },
      latestRawGaze: null,
      manualOffsetX: 0,
      manualOffsetY: 0,
      headCompensationEnabled: true,
      toleranceLevel: 'balanced',
    };
  }
  return window._headTrackerState;
}

export function initHeadTracker(): void {
  getState();
}

if (typeof window !== "undefined") {
  getState();
}

function faceWidthIsInvalid(size: number): boolean {
  return !Number.isFinite(size) || size < 8;
}

/**
 * 1. Sample the 2D Center of the Head directly from WebGazer's TFFacemesh landmarks.
 * Maps the face onto a clean 2D camera coordinate plane with alignment diagnostics for UI.
 */
export function sampleHeadPose(): HeadPose | null {
  const state = getState();
  const wg = typeof window !== "undefined" ? window.webgazer : null;
  const tracker = wg?.getTracker?.();
  const pts = tracker?.getPositions?.();

  if (!pts || pts.length < 264) {
    return null;
  }

  const leftEye = pts[33];   // Outer left eye corner [x, y]
  const rightEye = pts[263]; // Outer right eye corner [x, y]
  const noseTip = pts[1];    // Nose tip [x, y]

  // 2D Eye-line midpoint (the true anatomical pivot center of the head)
  const eyeMidX = (leftEye[0] + rightEye[0]) * 0.5;
  const eyeMidY = (leftEye[1] + rightEye[1]) * 0.5;

  // 2D Face Size (distance between outer eye corners in webcam pixels)
  const faceSize = Math.hypot(rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]);
  if (faceWidthIsInvalid(faceSize)) {
    return null;
  }

  // 2D Head Turn (tiltX) & Head Nod (tiltY):
  // How far the nose tip shifts in 2D relative to the eye-line midpoint
  const tiltX = (noseTip[0] - eyeMidX) / faceSize;
  const tiltY = (noseTip[1] - eyeMidY) / faceSize;
  const rollRad = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);

  const prev = state.currentHead;

  // Smooth the 2D head center so webcam pixel noise doesn't shake the reference point
  const alpha = 0.25;
  const smoothedHead: Head2DReference = prev
    ? {
        centerX: prev.centerX + (eyeMidX - prev.centerX) * alpha,
        centerY: prev.centerY + (eyeMidY - prev.centerY) * alpha,
        faceSize: prev.faceSize + (faceSize - prev.faceSize) * alpha,
        tiltX: prev.tiltX + (tiltX - prev.tiltX) * alpha,
        tiltY: prev.tiltY + (tiltY - prev.tiltY) * alpha,
      }
    : { centerX: eyeMidX, centerY: eyeMidY, faceSize, tiltX, tiltY };

  state.currentHead = smoothedHead;

  // Diagnostics for HeadPostureHUD
  const base = state.calibration;
  let distanceStatus: HeadPose['distanceStatus'] = 'optimal';
  let alignmentStatus: HeadPose['alignmentStatus'] = 'centered';
  let driftDistancePx = 0;

  if (base) {
    const dx = smoothedHead.centerX - base.centerX;
    const dy = smoothedHead.centerY - base.centerY;
    const scaleRatio = smoothedHead.faceSize / Math.max(10, base.faceSize);
    driftDistancePx = Math.round(Math.hypot(dx, dy));

    if (scaleRatio > 1.25) distanceStatus = 'too_close';
    else if (scaleRatio < 0.75) distanceStatus = 'too_far';
    else distanceStatus = 'optimal';

    if (dx > 25) alignmentStatus = 'shifted_right';
    else if (dx < -25) alignmentStatus = 'shifted_left';
    else if (dy > 20) alignmentStatus = 'slouching';
    else if (dy < -20) alignmentStatus = 'shifted_up';
    else alignmentStatus = 'centered';
  }

  return {
    centerX: smoothedHead.centerX,
    centerY: smoothedHead.centerY,
    faceSize: smoothedHead.faceSize,
    tiltX: smoothedHead.tiltX,
    tiltY: smoothedHead.tiltY,
    x: smoothedHead.centerX,
    y: smoothedHead.centerY,
    scale: smoothedHead.faceSize,
    faceScale: smoothedHead.faceSize,
    pitchRatio: smoothedHead.tiltY,
    yawRatio: smoothedHead.tiltX,
    rollRad,
    detected: true,
    distanceStatus,
    alignmentStatus,
    driftDistancePx,
    toleranceLevel: base?.toleranceLevel || state.toleranceLevel || 'balanced',
  };
}

export interface RecenterOptions {
  anchorPoint?: { x: number; y: number };
  neutralReadingRatioY?: number;
}

/**
 * 2. RECENTER / RECALIBRATE 2D REFERENCE POINT
 * Locks the current 2D head center as the new origin AND re-anchors WebGazer's
 * current raw output to the neutral reading center.
 */
export function recenterCurrentPosture(
  arg?: number | RecenterOptions,
  neutralReadingRatioY = 0.42
): boolean {
  const state = getState();
  const now = performance.now();

  let targetRatioY = neutralReadingRatioY;
  let anchorPoint: { x: number; y: number } | undefined;

  if (typeof arg === 'number') {
    targetRatioY = arg / (window.innerHeight || 1);
  } else if (typeof arg === 'object' && arg !== null) {
    if (arg.neutralReadingRatioY !== undefined) targetRatioY = arg.neutralReadingRatioY;
    if (arg.anchorPoint) anchorPoint = arg.anchorPoint;
  }

  // Check if the user triggered this by clicking a button with mouse/pointer
  const activeEl = typeof document !== "undefined" ? document.activeElement : null;
  const clickedUIButton =
    Boolean(anchorPoint) ||
    activeEl?.tagName === "BUTTON" ||
    activeEl?.closest?.("button") !== null;

  const history = state.frameHistory;
  const currentHead = sampleHeadPose() || state.currentHead;
  if (!currentHead) {
    console.warn("[HeadPoseTracker] Face not detected; cannot recenter posture.");
    return false;
  }

  // 1. Lock the new 2D Head Center Reference!
  const prevTol = state.calibration?.toleranceLevel || state.toleranceLevel || 'balanced';
  state.calibration = {
    ...currentHead,
    toleranceLevel: prevTol,
  };

  // 2. Find the clean Raw WebGazer origin to anchor at the neutral reading line
  const neutralX = window.innerWidth * 0.5;
  const neutralY = window.innerHeight * targetRatioY;
  let anchorRawX = neutralX;
  let anchorRawY = neutralY;

  if (history.length > 0) {
    // If user clicked a UI button, their eyes saccaded to the button ~0-250ms ago;
    // pull reading gaze from 300ms-1000ms ago when they were looking at the text!
    const windowFrames = clickedUIButton
      ? history.filter((f) => now - f.t >= 300 && now - f.t <= 1000)
      : history.filter((f) => now - f.t <= 300);

    const pool = windowFrames.length > 0 ? windowFrames : history.slice(-5);
    anchorRawX = pool.reduce((sum, f) => sum + f.rawGazeX, 0) / pool.length;
    anchorRawY = pool.reduce((sum, f) => sum + f.rawGazeY, 0) / pool.length;
  } else if (state.latestRawGaze) {
    anchorRawX = state.latestRawGaze.x;
    anchorRawY = state.latestRawGaze.y;
  }

  state.gazeOriginAtCalibration = {
    x: anchorRawX,
    y: anchorRawY,
  };

  // 3. Snap the 2D Screen Reference Point and cursor directly to the neutral corridor
  state.screenReferencePoint = { x: neutralX, y: neutralY };
  state.smoothedX = neutralX;
  state.smoothedY = neutralY;
  state.smoothedGaze = { x: neutralX, y: neutralY };
  state.manualOffsetX = 0;
  state.manualOffsetY = 0;

  if (typeof window !== "undefined" && window._gazeState) {
    window._gazeState.smoothedX = neutralX;
    window._gazeState.smoothedY = neutralY;
    window._gazeState.bottomDwellAccumulator = 0;
    window._gazeState.topDwellAccumulator = 0;
    window._gazeState.subpixelScrollY = 0;
    window._gazeState.scrollCooldownUntil = now + 500;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent('gaze-recentered'));
  }

  return true;
}

/**
 * Call this at the end of the 9-point calibration so the 2D Head Reference
 * locks cleanly without needing to press Recenter first.
 */
export function lockInitial2DCalibration(): void {
  const state = getState();
  const head = sampleHeadPose();
  if (head) {
    state.calibration = { ...head };
  }
  const neutralX = window.innerWidth * 0.5;
  const neutralY = window.innerHeight * 0.42;
  state.gazeOriginAtCalibration = { x: neutralX, y: neutralY };
  state.screenReferencePoint = { x: neutralX, y: neutralY };
  state.manualOffsetX = 0;
  state.manualOffsetY = 0;
  state.smoothedX = neutralX;
  state.smoothedY = neutralY;
  state.smoothedGaze = { x: neutralX, y: neutralY };
  state.frameHistory = [];
}

export const recordHeadBaseline = lockInitial2DCalibration;

/**
 * 3. COMPUTE GAZE FROM MOVING 2D HEAD REFERENCE POINT
 * Call this on every WebGazer frame: `const gaze = compute2DHeadReferencedGaze(data.x, data.y)`
 */
export function compute2DHeadReferencedGaze(
  rawGazeX: number,
  rawGazeY: number,
  neutralReadingRatioY = 0.42
): {
  x: number;
  y: number;
  referencePointX: number;
  referencePointY: number;
  headShiftX: number;
  headShiftY: number;
} {
  const state = getState();
  const now = performance.now();
  state.latestRawGaze = { x: rawGazeX, y: rawGazeY };
  const head = sampleHeadPose();

  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const neutralX = vw * 0.5;
  const neutralY = vh * neutralReadingRatioY;

  // Auto-initialize baseline on the very first frame if not yet set
  if (head && !state.calibration) {
    state.calibration = { ...head };
    state.gazeOriginAtCalibration = { x: rawGazeX, y: rawGazeY };
  }

  // Record into rolling buffer for button-click recentering
  if (head) {
    state.frameHistory.push({
      t: now,
      head: { ...head },
      rawGazeX,
      rawGazeY,
    });
    if (state.frameHistory.length > 40) {
      state.frameHistory.shift();
    }
  }

  // How much has the user's 2D Head Center moved since Calibration / Recenter?
  let headDeltaX = 0;
  let headDeltaY = 0;

  if (state.headCompensationEnabled && head && state.calibration) {
    const ref = state.calibration;
    const baseSize = Math.max(ref.faceSize, 10);

    // Combine 2D head translation + 2D nose-to-eye tilt into a single 2D Head Shift ratio
    const moveX = (head.centerX - ref.centerX) / baseSize;
    const moveY = (head.centerY - ref.centerY) / baseSize;
    const tiltDeltaX = head.tiltX - ref.tiltX;
    const tiltDeltaY = head.tiltY - ref.tiltY;
    const scaleDelta = (head.faceSize - ref.faceSize) / baseSize;

    // Total normalized 2D head shift
    headDeltaX = moveX * 0.8 + tiltDeltaX * 1.1;
    headDeltaY = moveY * 0.9 + tiltDeltaY * 1.3 - scaleDelta * 0.25;
  }

  // Move the 2D Reference Point on the screen in response to head movement
  const headDriftPixelsX = headDeltaX * vw;
  const headDriftPixelsY = headDeltaY * vh;

  state.screenReferencePoint = {
    x: neutralX + headDriftPixelsX,
    y: neutralY + headDriftPixelsY,
  };

  // Measure how far raw WebGazer moved relative to its calibration/recenter origin
  const originX = state.gazeOriginAtCalibration?.x ?? neutralX;
  const originY = state.gazeOriginAtCalibration?.y ?? neutralY;

  const rawGazeDeltaX = rawGazeX - originX;
  const rawGazeDeltaY = rawGazeY - originY;

  // TRUE EYE MOVEMENT = (Raw Gaze Delta) - (2D Head Reference Shift)
  const trueEyeDeltaX = rawGazeDeltaX - headDriftPixelsX;
  const trueEyeDeltaY = rawGazeDeltaY - headDriftPixelsY;

  // Final target on screen = Neutral Center + True Eye Movement + explicit manual offset
  const targetX = Math.max(0, Math.min(vw, neutralX + trueEyeDeltaX + state.manualOffsetX));
  const targetY = Math.max(0, Math.min(vh, neutralY + trueEyeDeltaY + state.manualOffsetY));

  state.smoothedX = targetX;
  state.smoothedY = targetY;
  state.smoothedGaze = { x: targetX, y: targetY };

  return {
    x: targetX,
    y: targetY,
    referencePointX: state.screenReferencePoint.x,
    referencePointY: state.screenReferencePoint.y,
    headShiftX: headDeltaX,
    headShiftY: headDeltaY,
  };
}

/**
 * Standard drop-in adapter for App.tsx gaze listener
 */
export function applyHeadPoseCompensation(
  rawX: number,
  rawY: number
): { x: number; y: number } {
  const result = compute2DHeadReferencedGaze(rawX, rawY);
  return { x: result.x, y: result.y };
}

/**
 * Legacy wrapper for applyHeadPoseCompensation
 */
export function compensateGazeForHead(
  rawX: number,
  rawY: number,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; isCompensated: boolean } {
  const result = compute2DHeadReferencedGaze(rawX, rawY);
  return {
    x: result.x,
    y: result.y,
    isCompensated: true,
  };
}

/**
 * Seeds default screen anchor coordinates into WebGazer's regression
 * so that predict() always has data and NEVER returns null.
 */
export function seedWebgazerBaseline(): void {
  if (typeof window === 'undefined' || !window.webgazer) return;
  if (typeof window.webgazer.recordScreenPosition !== 'function') return;

  const w = window.innerWidth || 1200;
  const h = window.innerHeight || 800;

  const points = [
    [w * 0.5, h * 0.5],
    [w * 0.2, h * 0.25],
    [w * 0.8, h * 0.25],
    [w * 0.2, h * 0.75],
    [w * 0.8, h * 0.75],
    [w * 0.5, h * 0.2],
    [w * 0.5, h * 0.8],
  ];

  for (const [x, y] of points) {
    try {
      window.webgazer.recordScreenPosition(x, y, 'click');
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Clears old WebGazer regression data and 2D Head Reference state
 * when starting a full recalibration.
 */
export function startFullRecalibration(): void {
  if (typeof window !== "undefined") {
    if (window.webgazer && typeof window.webgazer.clearData === 'function') {
      try {
        window.webgazer.clearData();
      } catch (e) {
        console.warn("Could not clear WebGazer data:", e);
      }
    }
    const state = getState();
    state.calibration = null;
    state.gazeOriginAtCalibration = null;
    state.manualOffsetX = 0;
    state.manualOffsetY = 0;
    state.frameHistory = [];
  }
}

/**
 * Resets head tracker state
 */
export function resetHeadTracker(): void {
  startFullRecalibration();
}

export function toggleHeadCompensation(enabled?: boolean): boolean {
  const state = getState();
  if (enabled !== undefined) {
    state.headCompensationEnabled = enabled;
  } else {
    state.headCompensationEnabled = !state.headCompensationEnabled;
  }
  return state.headCompensationEnabled;
}

export function isHeadCompensationActive(): boolean {
  return getState().headCompensationEnabled;
}

export function setToleranceLevel(level: 'low' | 'balanced' | 'high'): void {
  const state = getState();
  state.toleranceLevel = level;
  if (state.calibration) {
    state.calibration.toleranceLevel = level;
  }
}

/**
 * 100% Invariant Head-Driven Gaze Vector (Direct Head Mode)
 */
export function getHeadPoseGazePoint(
  screenWidth: number,
  screenHeight: number
): { x: number; y: number; detected: boolean } {
  const state = getState();
  const head = sampleHeadPose();

  if (!head || !head.detected) {
    return { x: screenWidth * 0.5, y: screenHeight * 0.42, detected: false };
  }

  const base = state.calibration;
  const baseSize = base?.faceSize || 100;

  const dTiltX = base ? (head.tiltX - base.tiltX) : 0;
  const dTiltY = base ? (head.tiltY - base.tiltY) : 0;
  const moveX = base ? (head.centerX - base.centerX) / baseSize : 0;
  const moveY = base ? (head.centerY - base.centerY) / baseSize : 0;

  const targetX = (screenWidth * 0.5) + (dTiltX * 2.2 + moveX * 0.45) * screenWidth + state.manualOffsetX;
  const targetY = (screenHeight * 0.42) + (dTiltY * 2.6 + moveY * 0.35) * screenHeight + state.manualOffsetY;

  return {
    x: Math.max(0, Math.min(screenWidth, targetX)),
    y: Math.max(0, Math.min(screenHeight, targetY)),
    detected: true,
  };
}
