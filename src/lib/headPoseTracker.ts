// src/lib/headPoseTracker.ts
/**
 * 2D Moving Head-Center Reference Point & Precision Calibration Architecture
 *
 * Combines WebGazer's 2D Ridge Regression with:
 * - Post-calibration residual zeroing & span scaling (scaleX, scaleY, manualOffsetX, manualOffsetY)
 * - Live spot-refinement on verification targets (`refineCalibrationAtPoint`)
 * - 3-Point In-Reader Quick Recalibration (`applyQuick3PointCalibration`)
 * - Deadzoned 2D head-pose compensation & 1-key posture recentering (`R`)
 */

export interface Head2DReference {
  // 2D center of the head in the camera plane
  centerX: number;
  centerY: number;
  // Face width in pixels (used to normalize 2D movement when leaning in/out)
  faceSize: number;
  // Head tilt ratios (nose relative to eye-line midpoint in 2D)
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
  // Live vector telemetry for the 2D Reference Scope HUD
  headShiftX: number;
  headShiftY: number;
  eyeDeltaX: number;
  eyeDeltaY: number;
}

export interface CalibrationPointPair {
  rawX: number;
  rawY: number;
  targetX: number;
  targetY: number;
}

export interface HeadTrackerState {
  // The locked 2D Head Reference Point (averaged during Calibration, or updated on Recenter)
  calibration: (Head2DReference & { toleranceLevel?: 'low' | 'balanced' | 'high' }) | null;
  // Samples collected during multi-point calibration so baseline reflects average reading posture
  calibrationSamples: Head2DReference[];
  // Paired (rawGaze -> target) samples for post-calibration affine span & offset refinement
  calibrationPairs: CalibrationPointPair[];
  // Current live 2D Head position
  currentHead: Head2DReference | null;
  // The shifting 2D Reference Point mapped onto screen space (px)
  screenReferencePoint: { x: number; y: number };
  // Rolling history of recent frames (so clicking a sidebar button doesn't skew recenter)
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
  // Explicit recenter / residual calibration offset
  manualOffsetX: number;
  manualOffsetY: number;
  // Post-calibration span gain around screen center (corrects Ridge Regression L2 shrinkage)
  scaleX: number;
  scaleY: number;
  headCompensationEnabled: boolean;
  toleranceLevel?: 'low' | 'balanced' | 'high';
  // Live normalized vectors for HUD visualization
  lastHeadShift: { x: number; y: number };
  lastEyeDelta: { x: number; y: number };
  // Real-time Multi-Modal (EAR + Eye-Patch Contrast) Double-Blink Detector state
  doubleBlinkEnabled: boolean;
  blinkSensitivity: 'easy' | 'normal' | 'strict';
  openEarBaseline: number;
  currentEar: number;
  openContrastBaseline: number;
  currentContrast: number;
  liveOpennessRatio: number; // 1.0 = wide open, < threshold = blink closed
  isEyeClosed: boolean;
  eyeClosedAt: number;
  minEarDuringClosure: number;
  lastValidBlinkTime: number;
  blinkStreak: number;
  doubleBlinkCooldownUntil: number;
  lastBlinkFreezeUntil: number;
  lastBlinkSampleTime: number;
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
    const cy = window.innerHeight * 0.5;
    window._headTrackerState = {
      calibration: null,
      calibrationSamples: [],
      calibrationPairs: [],
      currentHead: null,
      screenReferencePoint: { x: cx, y: cy },
      frameHistory: [],
      smoothedX: cx,
      smoothedY: cy,
      smoothedGaze: { x: cx, y: cy },
      latestRawGaze: null,
      manualOffsetX: 0,
      manualOffsetY: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      headCompensationEnabled: true,
      toleranceLevel: 'balanced',
      lastHeadShift: { x: 0, y: 0 },
      lastEyeDelta: { x: 0, y: 0 },
      doubleBlinkEnabled: true,
      blinkSensitivity: 'normal',
      openEarBaseline: 0.26,
      currentEar: 0.26,
      openContrastBaseline: 0.32,
      currentContrast: 0.32,
      liveOpennessRatio: 1.0,
      isEyeClosed: false,
      eyeClosedAt: 0,
      minEarDuringClosure: 0.26,
      lastValidBlinkTime: 0,
      blinkStreak: 0,
      doubleBlinkCooldownUntil: 0,
      lastBlinkFreezeUntil: 0,
      lastBlinkSampleTime: 0,
    };
  }
  return window._headTrackerState;
}

export function initHeadTracker(): void {
  getState();
  ensureHighSpeedBlinkLoop();
}

if (typeof window !== "undefined") {
  getState();
}

function faceWidthIsInvalid(size: number): boolean {
  return !Number.isFinite(size) || size < 8;
}

/**
 * Apply a smooth deadzone so natural head micro-movements during reading
 * never disturb WebGazer's calibrated eye gaze prediction.
 */
function applyDeadzone(val: number, deadzone: number): number {
  if (Math.abs(val) <= deadzone) return 0;
  return val > 0 ? val - deadzone : val + deadzone;
}

interface BinocularBlinkTracker {
  isClosed: boolean;
  closedAt: number;
  lastOpenedAt: number;
  minRatioDuringClosure: number;
  lastBlinkTime: number;
  streakStartedAt: number;
  streak: number;
  leftOpenBaseline: number;
  rightOpenBaseline: number;
}

const earBlinkTracker: BinocularBlinkTracker = {
  isClosed: false,
  closedAt: 0,
  lastOpenedAt: 0,
  minRatioDuringClosure: 1.0,
  lastBlinkTime: 0,
  streakStartedAt: 0,
  streak: 0,
  leftOpenBaseline: 0.26,
  rightOpenBaseline: 0.26,
};

let lastProcessedMeshCoord = { x: -1, y: -1 };
let lastHeadPoseCacheTime = 0;
let lastHeadPoseCachedResult: HeadPose | null = null;

/**
 * Zero-copy Binocular Eye Aspect Ratio (EAR) blink detector directly from FaceMesh landmarks.
 * Runs exclusively in CPU memory (<0.002ms) with zero canvas/GPU readbacks so WebGazer's
 * WebGL tracking pipeline runs at full native frame rate without any contention.
 */
export function processEyeBlinkLandmarks(pts?: number[][]): void {
  const state = getState();
  if (!state.doubleBlinkEnabled) return;

  const now = performance.now();
  const activePts = pts || window.webgazer?.getTracker?.()?.getPositions?.();
  if (!activePts || activePts.length < 387) return;

  const lOut = activePts[33];
  const lIn = activePts[133];
  const lTop1 = activePts[159];
  const lBot1 = activePts[145];
  const lTop2 = activePts[158];
  const lBot2 = activePts[153];
  const lTop3 = activePts[160];
  const lBot3 = activePts[144];

  const rOut = activePts[263];
  const rIn = activePts[362];
  const rTop1 = activePts[386];
  const rBot1 = activePts[374];
  const rTop2 = activePts[385];
  const rBot2 = activePts[380];
  const rTop3 = activePts[387];
  const rBot3 = activePts[373];

  if (!lOut || !lIn || !lTop1 || !lBot1 || !rOut || !rIn || !rTop1 || !rBot1) return;

  // Expire partial streak if user pauses > 950ms after the 1st blink
  if (
    earBlinkTracker.streak > 0 &&
    (now - earBlinkTracker.lastBlinkTime > 950 || now - earBlinkTracker.streakStartedAt > 1400)
  ) {
    earBlinkTracker.streak = 0;
    earBlinkTracker.streakStartedAt = 0;
    state.blinkStreak = 0;
  }

  // Only process when FaceMesh has produced a new landmark frame
  if (lOut[0] === lastProcessedMeshCoord.x && lOut[1] === lastProcessedMeshCoord.y) {
    return;
  }
  lastProcessedMeshCoord = { x: lOut[0], y: lOut[1] };
  state.lastBlinkSampleTime = now;

  const leftWidth = Math.hypot(lIn[0] - lOut[0], lIn[1] - lOut[1]);
  const rightWidth = Math.hypot(rIn[0] - rOut[0], rIn[1] - rOut[1]);
  if (leftWidth < 4 || rightWidth < 4) return;

  const d1L = Math.hypot(lTop1[0] - lBot1[0], lTop1[1] - lBot1[1]);
  const d2L = lTop2 && lBot2 ? Math.hypot(lTop2[0] - lBot2[0], lTop2[1] - lBot2[1]) : d1L;
  const d3L = lTop3 && lBot3 ? Math.hypot(lTop3[0] - lBot3[0], lTop3[1] - lBot3[1]) : d1L;
  const leftEar = Math.min(0.48, Math.max(0.02, (d1L + d2L + d3L) / (3.0 * leftWidth)));

  const d1R = Math.hypot(rTop1[0] - rBot1[0], rTop1[1] - rBot1[1]);
  const d2R = rTop2 && rBot2 ? Math.hypot(rTop2[0] - rBot2[0], rTop2[1] - rBot2[1]) : d1R;
  const d3R = rTop3 && rBot3 ? Math.hypot(rTop3[0] - rBot3[0], rTop3[1] - rBot3[1]) : d1R;
  const rightEar = Math.min(0.48, Math.max(0.02, (d1R + d2R + d3R) / (3.0 * rightWidth)));

  const ear = (leftEar + rightEar) * 0.5;
  state.currentEar = ear;

  const leftRatio = leftEar / Math.max(0.10, earBlinkTracker.leftOpenBaseline);
  const rightRatio = rightEar / Math.max(0.10, earBlinkTracker.rightOpenBaseline);
  const earRatio = (leftRatio + rightRatio) * 0.5;

  const closeRatioThreshold =
    state.blinkSensitivity === 'easy'
      ? 0.82
      : state.blinkSensitivity === 'strict'
      ? 0.72
      : 0.77;
  const openRatioThreshold = Math.min(0.92, closeRatioThreshold + 0.09);

  // Both eyes must dip together (binocular symmetry rejects head turn or single-eye landmark jitter)
  const bothEyesDipped =
    earRatio < closeRatioThreshold &&
    leftRatio < closeRatioThreshold + 0.04 &&
    rightRatio < closeRatioThreshold + 0.04;

  if (!earBlinkTracker.isClosed) {
    const openRecoveryMs = now - earBlinkTracker.lastOpenedAt;
    if (bothEyesDipped && openRecoveryMs >= 105) {
      earBlinkTracker.isClosed = true;
      earBlinkTracker.closedAt = now;
      earBlinkTracker.minRatioDuringClosure = earRatio;
    } else if (earRatio >= openRatioThreshold) {
      // Adapt open-eye baseline smoothly while eyes are comfortably open
      earBlinkTracker.leftOpenBaseline = earBlinkTracker.leftOpenBaseline * 0.92 + leftEar * 0.08;
      earBlinkTracker.rightOpenBaseline = earBlinkTracker.rightOpenBaseline * 0.92 + rightEar * 0.08;
      state.openEarBaseline = (earBlinkTracker.leftOpenBaseline + earBlinkTracker.rightOpenBaseline) * 0.5;
    } else {
      // Slow adaptation when looking slightly down so baseline tracks reading posture without triggering blinks
      earBlinkTracker.leftOpenBaseline = earBlinkTracker.leftOpenBaseline * 0.96 + leftEar * 0.04;
      earBlinkTracker.rightOpenBaseline = earBlinkTracker.rightOpenBaseline * 0.96 + rightEar * 0.04;
      state.openEarBaseline = (earBlinkTracker.leftOpenBaseline + earBlinkTracker.rightOpenBaseline) * 0.5;
    }
  } else {
    if (earRatio < earBlinkTracker.minRatioDuringClosure) {
      earBlinkTracker.minRatioDuringClosure = earRatio;
    }

    if (earRatio >= openRatioThreshold) {
      const duration = now - earBlinkTracker.closedAt;
      const minDip = earBlinkTracker.minRatioDuringClosure;
      earBlinkTracker.isClosed = false;
      earBlinkTracker.lastOpenedAt = now;

      const isGenuineBlinkWaveform =
        duration >= 55 &&
        duration <= 380 &&
        minDip <= closeRatioThreshold - 0.02;

      if (isGenuineBlinkWaveform && now > state.doubleBlinkCooldownUntil) {
        const sincePrev = now - earBlinkTracker.lastBlinkTime;
        if (
          earBlinkTracker.streak >= 1 &&
          sincePrev >= 180 &&
          sincePrev <= 950 &&
          now - earBlinkTracker.streakStartedAt <= 1400
        ) {
          earBlinkTracker.streak += 1;
        } else {
          earBlinkTracker.streak = 1;
          earBlinkTracker.streakStartedAt = now;
        }
        earBlinkTracker.lastBlinkTime = now;

        if (earBlinkTracker.streak >= 2) {
          earBlinkTracker.streak = 0;
          earBlinkTracker.lastBlinkTime = 0;
          earBlinkTracker.streakStartedAt = 0;
          state.blinkStreak = 0;
          state.lastValidBlinkTime = 0;
          state.doubleBlinkCooldownUntil = now + 3500;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gaze-double-blink', {
                detail: { timestamp: now, ear: state.currentEar, streak: 2 },
              })
            );
          }
        } else {
          state.blinkStreak = earBlinkTracker.streak;
          state.lastValidBlinkTime = now;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gaze-single-blink', {
                detail: {
                  timestamp: now,
                  ear: state.currentEar,
                  streak: earBlinkTracker.streak,
                },
              })
            );
          }
        }
      } else if (duration > 440) {
        earBlinkTracker.streak = 0;
        earBlinkTracker.streakStartedAt = 0;
        state.blinkStreak = 0;
        earBlinkTracker.leftOpenBaseline = leftEar;
        earBlinkTracker.rightOpenBaseline = rightEar;
        state.openEarBaseline = ear;
      }
    } else if (now - earBlinkTracker.closedAt > 440) {
      // Sustained downward gaze at bottom of page -> re-anchor open baseline immediately
      earBlinkTracker.isClosed = false;
      earBlinkTracker.lastOpenedAt = now;
      earBlinkTracker.streak = 0;
      earBlinkTracker.streakStartedAt = 0;
      state.blinkStreak = 0;
      earBlinkTracker.leftOpenBaseline = leftEar;
      earBlinkTracker.rightOpenBaseline = rightEar;
      state.openEarBaseline = ear;
    }
  }

  state.isEyeClosed = earBlinkTracker.isClosed;
  state.blinkStreak = earBlinkTracker.streak;
  state.liveOpennessRatio = Math.max(0, Math.min(1.15, earRatio));
}

export function getBlinkTelemetry(): {
  opennessRatio: number;
  thresholdRatio: number;
  isEyeClosed: boolean;
  blinkStreak: number;
  sensitivity: 'easy' | 'normal' | 'strict';
} {
  const state = getState();
  const thresholdRatio =
    state.blinkSensitivity === 'easy'
      ? 0.82
      : state.blinkSensitivity === 'strict'
      ? 0.72
      : 0.77;
  return {
    opennessRatio: state.liveOpennessRatio,
    thresholdRatio,
    isEyeClosed: state.isEyeClosed,
    blinkStreak: state.blinkStreak,
    sensitivity: state.blinkSensitivity,
  };
}

export function ensureHighSpeedBlinkLoop(): void {
  // No-op: blink detection now runs zero-copy inside sampleHeadPose() without background canvas readback timers
}

export function setDoubleBlinkEnabled(enabled: boolean): void {
  const state = getState();
  state.doubleBlinkEnabled = enabled;
}

export function isDoubleBlinkEnabled(): boolean {
  return getState().doubleBlinkEnabled;
}

export function setBlinkSensitivity(level: 'easy' | 'normal' | 'strict'): void {
  const state = getState();
  state.blinkSensitivity = level;
}

export function getBlinkSensitivity(): 'easy' | 'normal' | 'strict' {
  return getState().blinkSensitivity;
}

/**
 * 1. Sample the 2D Center of the Head directly from WebGazer's TFFacemesh landmarks.
 */
export function sampleHeadPose(): HeadPose | null {
  const now = performance.now();
  // Deduplicate redundant calls within the same animation frame (<8ms) so EMA smoothing is never stepped twice per frame
  if (now - lastHeadPoseCacheTime < 8 && lastHeadPoseCachedResult) {
    return lastHeadPoseCachedResult;
  }

  const state = getState();
  const wg = typeof window !== "undefined" ? window.webgazer : null;
  const tracker = wg?.getTracker?.();
  const pts = tracker?.getPositions?.();

  if (!pts || pts.length < 264) {
    return null;
  }

  // Run real-time zero-copy Eye Aspect Ratio (EAR) 4-blink gesture detection
  processEyeBlinkLandmarks(pts);

  const leftEye = pts[33];   // Outer left eye corner [x, y]
  const rightEye = pts[263]; // Outer right eye corner [x, y]
  const noseTip = pts[1];    // Nose tip [x, y]

  // 2D Eye-line midpoint (anatomical pivot center of the head)
  const eyeMidX = (leftEye[0] + rightEye[0]) * 0.5;
  const eyeMidY = (leftEye[1] + rightEye[1]) * 0.5;

  // 2D Face Size (distance between outer eye corners in webcam pixels)
  const faceSize = Math.hypot(rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]);
  if (faceWidthIsInvalid(faceSize)) {
    return null;
  }

  // 2D Head Turn (tiltX) & Head Nod (tiltY):
  // Raw webcam X is un-mirrored, so invert X so +tiltX = turning head right on screen
  const tiltX = -(noseTip[0] - eyeMidX) / faceSize;
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

  const tolMultiplier =
    state.toleranceLevel === 'low' ? 0.7 : state.toleranceLevel === 'high' ? 1.4 : 1.0;

  if (base) {
    const dx = -(smoothedHead.centerX - base.centerX);
    const dy = smoothedHead.centerY - base.centerY;
    const scaleRatio = smoothedHead.faceSize / Math.max(10, base.faceSize);
    driftDistancePx = Math.round(Math.hypot(dx, dy));

    if (scaleRatio > 1.25 * tolMultiplier) distanceStatus = 'too_close';
    else if (scaleRatio < 0.75 / tolMultiplier) distanceStatus = 'too_far';
    else distanceStatus = 'optimal';

    const threshX = 24 * tolMultiplier;
    const threshY = 19 * tolMultiplier;

    if (dx > threshX) alignmentStatus = 'shifted_right';
    else if (dx < -threshX) alignmentStatus = 'shifted_left';
    else if (dy > threshY) alignmentStatus = 'slouching';
    else if (dy < -threshY) alignmentStatus = 'shifted_up';
    else alignmentStatus = 'centered';
  }

  const result: HeadPose = {
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
    headShiftX: state.lastHeadShift.x,
    headShiftY: state.lastHeadShift.y,
    eyeDeltaX: state.lastEyeDelta.x,
    eyeDeltaY: state.lastEyeDelta.y,
  };

  lastHeadPoseCacheTime = now;
  lastHeadPoseCachedResult = result;
  return result;
}

/**
 * Called on each calibration dot click so the baseline posture is the balanced
 * average of the user's posture during calibration.
 */
export function recordCalibrationHeadSample(
  weight = 1,
  pair?: { targetX: number; targetY: number }
): void {
  const state = getState();
  const head = sampleHeadPose();
  if (head) {
    for (let i = 0; i < weight; i++) {
      state.calibrationSamples.push({
        centerX: head.centerX,
        centerY: head.centerY,
        faceSize: head.faceSize,
        tiltX: head.tiltX,
        tiltY: head.tiltY,
      });
    }
  }

  if (pair && state.latestRawGaze) {
    state.calibrationPairs.push({
      rawX: state.latestRawGaze.x,
      rawY: state.latestRawGaze.y,
      targetX: pair.targetX,
      targetY: pair.targetY,
    });
  }
}

/**
 * Spot-refines both WebGazer's regression and our 2D residual offset when the user
 * clicks a Verification Target or a Quick-Tune point while looking at (targetX, targetY).
 */
export function refineCalibrationAtPoint(targetX: number, targetY: number): void {
  const state = getState();
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const cx = vw * 0.5;
  const cy = vh * 0.5;

  // 1. Feed exact screen position into WebGazer's Ridge Regressor
  if (typeof window !== 'undefined' && window.webgazer?.recordScreenPosition) {
    window.webgazer.recordScreenPosition(targetX, targetY, 'click');
    window.webgazer.recordScreenPosition(targetX, targetY, 'click');
  }

  // 2. Measure current predicted position and blend 60% of the residual error into manualOffset
  if (state.latestRawGaze) {
    const rawX = state.latestRawGaze.x;
    const rawY = state.latestRawGaze.y;
    const scaledX = cx + (rawX - cx) * state.scaleX;
    const scaledY = cy + (rawY - cy) * state.scaleY;

    const currentPredX = scaledX + state.manualOffsetX;
    const currentPredY = scaledY + state.manualOffsetY;

    const errX = targetX - currentPredX;
    const errY = targetY - currentPredY;

    state.manualOffsetX = Math.max(-280, Math.min(280, state.manualOffsetX + errX * 0.65));
    state.manualOffsetY = Math.max(-280, Math.min(280, state.manualOffsetY + errY * 0.65));
  }

  // 3. If this target is near the center, also refresh head posture baseline
  if (Math.hypot(targetX - cx, targetY - cy) < Math.min(vw, vh) * 0.22) {
    const head = sampleHeadPose();
    if (head) {
      state.calibration = {
        centerX: head.centerX,
        centerY: head.centerY,
        faceSize: head.faceSize,
        tiltX: head.tiltX,
        tiltY: head.tiltY,
        toleranceLevel: state.toleranceLevel || 'balanced',
      };
    }
  }
}

/**
 * Applies a 3-Point Quick Recalibration (Top, Center, Bottom) directly inside the Reader
 * without wiping the user's existing calibration session.
 */
export function applyQuick3PointCalibration(
  samples: Array<{ rawX: number; rawY: number; targetX: number; targetY: number }>
): void {
  const state = getState();
  if (samples.length === 0) return;

  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const cx = vw * 0.5;
  const cy = vh * 0.5;

  // Compute vertical span scaling if we have top & bottom samples
  if (samples.length >= 2) {
    const sortedByY = [...samples].sort((a, b) => a.targetY - b.targetY);
    const top = sortedByY[0];
    const bottom = sortedByY[sortedByY.length - 1];
    const rawSpanY = Math.max(60, bottom.rawY - top.rawY);
    const targetSpanY = bottom.targetY - top.targetY;
    if (targetSpanY > 150 && rawSpanY > 40) {
      const fittedScaleY = targetSpanY / rawSpanY;
      state.scaleY = Math.max(0.85, Math.min(1.38, fittedScaleY));
    }
  }

  // Compute mean residual offset after applying scale
  let sumErrX = 0;
  let sumErrY = 0;
  for (const s of samples) {
    const scaledX = cx + (s.rawX - cx) * state.scaleX;
    const scaledY = cy + (s.rawY - cy) * state.scaleY;
    sumErrX += s.targetX - scaledX;
    sumErrY += s.targetY - scaledY;
  }

  state.manualOffsetX = Math.max(-280, Math.min(280, sumErrX / samples.length));
  state.manualOffsetY = Math.max(-280, Math.min(280, sumErrY / samples.length));

  // Lock current head posture
  const head = sampleHeadPose();
  if (head) {
    state.calibration = {
      centerX: head.centerX,
      centerY: head.centerY,
      faceSize: head.faceSize,
      tiltX: head.tiltX,
      tiltY: head.tiltY,
      toleranceLevel: state.toleranceLevel || 'balanced',
    };
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gaze-recentered'));
  }
}

/**
 * Allows the user to manually nudge the vertical gaze offset up or down
 */
export function nudgeVerticalOffset(deltaPx: number): number {
  const state = getState();
  state.manualOffsetY = Math.max(-350, Math.min(350, state.manualOffsetY + deltaPx));
  return state.manualOffsetY;
}

export interface RecenterOptions {
  anchorPoint?: { x: number; y: number };
  neutralReadingRatioY?: number;
}

/**
 * 2. RECENTER CURRENT POSTURE (Triggered via `R` key or Sidebar Recenter button)
 * Locks the current 2D head center as the new origin AND computes the exact
 * manualOffset needed to bring the user's current reading gaze to the neutral center (48% Y).
 */
export function recenterCurrentPosture(
  arg?: number | RecenterOptions,
  neutralReadingRatioY = 0.48
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

  // 1. Lock the new 2D Head Center Reference so headContribution drops to 0 in this posture
  const prevTol = state.calibration?.toleranceLevel || state.toleranceLevel || 'balanced';
  state.calibration = {
    centerX: currentHead.centerX,
    centerY: currentHead.centerY,
    faceSize: currentHead.faceSize,
    tiltX: currentHead.tiltX,
    tiltY: currentHead.tiltY,
    toleranceLevel: prevTol,
  };

  // 2. Find the clean Raw WebGazer reading gaze to anchor at the neutral reading line
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const cx = vw * 0.5;
  const cy = vh * 0.5;

  const hasSidebar = Boolean(document.getElementById('reader-mode-active'));
  const neutralX = hasSidebar ? 256 + (vw - 256) * 0.5 : cx;
  const neutralY = vh * targetRatioY;

  let anchorRawX = state.latestRawGaze?.x ?? neutralX;
  let anchorRawY = state.latestRawGaze?.y ?? neutralY;

  if (history.length > 0) {
    const windowFrames = clickedUIButton
      ? history.filter((f) => now - f.t >= 350 && now - f.t <= 1100)
      : history.filter((f) => now - f.t <= 280);

    const pool = windowFrames.length > 0 ? windowFrames : history.slice(-5);
    anchorRawX = pool.reduce((sum, f) => sum + f.rawGazeX, 0) / pool.length;
    anchorRawY = pool.reduce((sum, f) => sum + f.rawGazeY, 0) / pool.length;
  }

  const scaledAnchorX = cx + (anchorRawX - cx) * state.scaleX;
  const scaledAnchorY = cy + (anchorRawY - cy) * state.scaleY;

  // 3. Set manualOffset so scaledAnchor + manualOffset === neutral reading center
  state.manualOffsetX = neutralX - scaledAnchorX;
  state.manualOffsetY = neutralY - scaledAnchorY;

  state.screenReferencePoint = { x: neutralX, y: neutralY };
  state.smoothedX = neutralX;
  state.smoothedY = neutralY;
  state.smoothedGaze = { x: neutralX, y: neutralY };
  state.lastHeadShift = { x: 0, y: 0 };

  if (typeof window !== "undefined" && window._gazeState) {
    window._gazeState.smoothedX = neutralX;
    window._gazeState.smoothedY = neutralY;
    window._gazeState.bottomDwellAccumulator = 0;
    window._gazeState.topDwellAccumulator = 0;
    window._gazeState.subpixelScrollY = 0;
    window._gazeState.scrollCooldownUntil = now + 450;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent('gaze-recentered'));
  }

  return true;
}

/**
 * Called when multi-point calibration completes.
 * Computes averaged head posture and fits a gentle bounded residual offset/scale
 * from the final calibration clicks so the center and edges are locked in.
 */
export function lockInitial2DCalibration(): void {
  const state = getState();
  const samples = state.calibrationSamples;
  const currentHead = sampleHeadPose();

  if (samples.length > 0) {
    const n = samples.length;
    const avg = samples.reduce(
      (acc, s) => ({
        centerX: acc.centerX + s.centerX / n,
        centerY: acc.centerY + s.centerY / n,
        faceSize: acc.faceSize + s.faceSize / n,
        tiltX: acc.tiltX + s.tiltX / n,
        tiltY: acc.tiltY + s.tiltY / n,
      }),
      { centerX: 0, centerY: 0, faceSize: 0, tiltX: 0, tiltY: 0 }
    );
    state.calibration = {
      ...avg,
      toleranceLevel: state.toleranceLevel || 'balanced',
    };
  } else if (currentHead) {
    state.calibration = {
      centerX: currentHead.centerX,
      centerY: currentHead.centerY,
      faceSize: currentHead.faceSize,
      tiltX: currentHead.tiltX,
      tiltY: currentHead.tiltY,
      toleranceLevel: state.toleranceLevel || 'balanced',
    };
  }

  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const neutralX = vw * 0.5;
  const neutralY = vh * 0.48;

  state.scaleX = 1.05;
  state.scaleY = 1.08;
  state.manualOffsetX = 0;
  state.manualOffsetY = 0;

  // If we captured center-dot final clicks at the end of calibration, gently zero out
  // any residual center offset (clamped tightly to ±75px so it never over-corrects)
  const centerPairs = state.calibrationPairs.filter(
    (p) => Math.hypot(p.targetX - neutralX, p.targetY - vh * 0.5) < Math.min(vw, vh) * 0.25
  );
  if (centerPairs.length > 0) {
    const lastCenter = centerPairs.slice(-2);
    const avgErrX =
      lastCenter.reduce((acc, p) => acc + (p.targetX - p.rawX), 0) / lastCenter.length;
    const avgErrY =
      lastCenter.reduce((acc, p) => acc + (p.targetY - p.rawY), 0) / lastCenter.length;

    state.manualOffsetX = Math.max(-75, Math.min(75, avgErrX * 0.5));
    state.manualOffsetY = Math.max(-75, Math.min(75, avgErrY * 0.5));
  }

  state.screenReferencePoint = { x: neutralX, y: neutralY };
  state.lastHeadShift = { x: 0, y: 0 };
  state.lastEyeDelta = { x: 0, y: 0 };
  state.frameHistory = [];
}

export const recordHeadBaseline = lockInitial2DCalibration;

/**
 * 3. COMPUTE GAZE WITH SYMMETRIC ZERO-BIAS 2D MAPPING
 */
export function compute2DHeadReferencedGaze(
  rawGazeX: number,
  rawGazeY: number,
  neutralReadingRatioY = 0.48
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
  const cx = vw * 0.5;
  const cy = vh * 0.5;
  const neutralX = vw * 0.5;
  const neutralY = vh * neutralReadingRatioY;

  // Auto-initialize baseline on the very first frame if not yet set
  if (head && !state.calibration) {
    state.calibration = {
      centerX: head.centerX,
      centerY: head.centerY,
      faceSize: head.faceSize,
      tiltX: head.tiltX,
      tiltY: head.tiltY,
      toleranceLevel: state.toleranceLevel || 'balanced',
    };
  }

  // Record into rolling buffer for button-click recentering
  if (head) {
    state.frameHistory.push({
      t: now,
      head: {
        centerX: head.centerX,
        centerY: head.centerY,
        faceSize: head.faceSize,
        tiltX: head.tiltX,
        tiltY: head.tiltY,
      },
      rawGazeX,
      rawGazeY,
    });
    if (state.frameHistory.length > 45) {
      state.frameHistory.shift();
    }
  }

  let headContributionX = 0;
  let headContributionY = 0;
  let normHeadShiftX = 0;
  let normHeadShiftY = 0;
  let distanceGainY = 1.0;
  let upwardLeanBoost = 1.0;

  const isReadingMode = typeof document !== 'undefined' && Boolean(document.getElementById('reader-mode-active'));

  if (state.headCompensationEnabled && head && state.calibration) {
    const ref = state.calibration;
    const baseSize = Math.max(ref.faceSize, 10);

    // 1. Measure lean-back distance ratio (when leaning back, faceSize shrinks -> scaleRatio < 1.0)
    const scaleRatio = head.faceSize / baseSize;
    const leanBackRatio = Math.max(0, 1.0 - scaleRatio);

    // Optical distance scaling: when farther from the camera, eye-patch pixel excursion shrinks,
    // so we amplify vertical excursion proportionally to (1 / scaleRatio)^1.35
    if (scaleRatio < 0.97) {
      distanceGainY = Math.min(1.60, Math.pow(1.0 / Math.max(0.55, scaleRatio), 1.35));
      upwardLeanBoost = 1.0 + Math.min(0.45, leanBackRatio * 1.5);
    }

    // 2. Measure 2D camera translation & angular head tilt
    const rawMoveX = -(head.centerX - ref.centerX) / baseSize;
    const rawMoveY = (head.centerY - ref.centerY) / baseSize;
    const rawTiltX = head.tiltX - ref.tiltX;
    const rawTiltY = head.tiltY - ref.tiltY;

    // When reclining/leaning back in a chair, the head drops in the frame (rawMoveY > 0)
    // and moves away (leanBackRatio > 0), which causes WebGazer's raw Y to sink downward.
    // Cancel that downward sink with an upward lift (-Y) when leaned back:
    const dzLeanBack = applyDeadzone(leanBackRatio, 0.025);
    const dzReclineDropY = rawMoveY > 0 ? applyDeadzone(rawMoveY, 0.04) : 0;
    const leanBackUpwardLiftNorm = -(dzLeanBack * 0.70 + dzReclineDropY * 0.35);

    const dzTiltX = applyDeadzone(rawTiltX, 0.035);
    const dzTiltY = applyDeadzone(rawTiltY, 0.030);
    const dzMoveX = applyDeadzone(rawMoveX, 0.040);

    // Give upward head pitch (dzTiltY < 0) a stronger 0.70x response so looking up while reclined is effortless
    const tiltAssistY = dzTiltY < 0 ? dzTiltY * 0.70 : dzTiltY * 0.30;

    normHeadShiftX = dzTiltX * 0.35 - dzMoveX * 0.20;
    normHeadShiftY = tiltAssistY + leanBackUpwardLiftNorm;

    if (isReadingMode) {
      headContributionX = Math.max(-180, Math.min(180, normHeadShiftX * vw));
      headContributionY = Math.max(-240, Math.min(180, normHeadShiftY * vh));
    }
  }

  state.lastHeadShift = { x: normHeadShiftX, y: normHeadShiftY };

  state.screenReferencePoint = {
    x: Math.max(0, Math.min(vw, neutralX + headContributionX)),
    y: Math.max(0, Math.min(vh, neutralY + headContributionY)),
  };

  // Apply post-calibration span scale + distance-adaptive upward boost when leaned back
  const scaledRawX = cx + (rawGazeX - cx) * state.scaleX;
  const effectiveScaleY =
    rawGazeY < cy
      ? state.scaleY * distanceGainY * upwardLeanBoost
      : state.scaleY * distanceGainY;
  const scaledRawY = cy + (rawGazeY - cy) * effectiveScaleY;

  const targetX = Math.max(
    0,
    Math.min(vw, scaledRawX + state.manualOffsetX + headContributionX)
  );
  const targetY = Math.max(
    0,
    Math.min(vh, scaledRawY + state.manualOffsetY + headContributionY)
  );

  state.lastEyeDelta = {
    x: (targetX - neutralX) / vw,
    y: (targetY - neutralY) / vh,
  };

  // Never freeze gaze tracking during normal reading or downward glances.
  // Only hold the gaze coordinate steady if the user has already completed 1 intentional blink
  // and is mid-closure on the 2nd blink to capture a screenshot.
  if (
    state.blinkStreak >= 1 &&
    state.isEyeClosed &&
    now - earBlinkTracker.closedAt < 150
  ) {
    return {
      x: state.smoothedX,
      y: state.smoothedY,
      referencePointX: state.screenReferencePoint.x,
      referencePointY: state.screenReferencePoint.y,
      headShiftX: normHeadShiftX,
      headShiftY: normHeadShiftY,
    };
  }

  state.smoothedX = targetX;
  state.smoothedY = targetY;
  state.smoothedGaze = { x: targetX, y: targetY };

  return {
    x: targetX,
    y: targetY,
    referencePointX: state.screenReferencePoint.x,
    referencePointY: state.screenReferencePoint.y,
    headShiftX: normHeadShiftX,
    headShiftY: normHeadShiftY,
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
 * Seeds a fallback center point ONLY if the user skips calibration completely.
 */
export function seedWebgazerBaseline(): void {
  if (typeof window === 'undefined' || !window.webgazer) return;
  if (typeof window.webgazer.recordScreenPosition !== 'function') return;

  const w = window.innerWidth || 1200;
  const h = window.innerHeight || 800;

  try {
    window.webgazer.recordScreenPosition(w * 0.5, h * 0.48, 'click');
  } catch (e) {
    // ignore
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
    state.calibrationSamples = [];
    state.calibrationPairs = [];
    state.manualOffsetX = 0;
    state.manualOffsetY = 0;
    state.scaleX = 1.0;
    state.scaleY = 1.0;
    state.lastHeadShift = { x: 0, y: 0 };
    state.lastEyeDelta = { x: 0, y: 0 };
    state.frameHistory = [];
  }
}

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
    return { x: screenWidth * 0.5, y: screenHeight * 0.48, detected: false };
  }

  const base = state.calibration;
  const baseSize = base?.faceSize || 100;

  const dTiltX = base ? (head.tiltX - base.tiltX) : 0;
  const dTiltY = base ? (head.tiltY - base.tiltY) : 0;
  const moveX = base ? -(head.centerX - base.centerX) / baseSize : 0;
  const moveY = base ? (head.centerY - base.centerY) / baseSize : 0;

  const targetX = (screenWidth * 0.5) + (dTiltX * 2.2 - moveX * 0.20) * screenWidth + state.manualOffsetX;
  const targetY = (screenHeight * 0.48) + (dTiltY * 2.4 + moveY * 0.20) * screenHeight + state.manualOffsetY;

  return {
    x: Math.max(0, Math.min(screenWidth, targetX)),
    y: Math.max(0, Math.min(screenHeight, targetY)),
    detected: true,
  };
}
