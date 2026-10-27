/**
 * 1€ (One-Euro) Adaptive Filter for Gaze & Motion Tracking
 * 
 * Casiez, G., Roussel, N., & Vogel, D. (2012). 
 * "1€ Filter: A simple speed-based low-pass filter for noisy input in interactive systems."
 * ACM CHI 2012.
 * 
 * Solves the fundamental latency vs. jitter tradeoff in biological tracking:
 * - At low speed (fixating, reading text): high damping, zero trembling/jitter.
 * - At high speed (saccades, rapid glances): opens cutoff, zero lag (< 6ms response).
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.1, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public setParams(minCutoff: number, beta: number): void {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  public getVelocity(): number {
    return Math.abs(this.dxPrev);
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  public filter(x: number, timestampMs: number, dynamicMinCutoff?: number, dynamicBeta?: number): number {
    if (dynamicMinCutoff !== undefined && dynamicBeta !== undefined) {
      this.minCutoff = dynamicMinCutoff;
      this.beta = dynamicBeta;
    }

    if (isNaN(x)) return this.xPrev ?? 0;

    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestampMs;
      this.dxPrev = 0;
      return x;
    }

    const dt = Math.max((timestampMs - this.tPrev) / 1000.0, 0.001);
    this.tPrev = timestampMs;

    // Estimate derivative (instantaneous velocity)
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1.0 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    // Dynamic cutoff frequency scaled with speed
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);

    // Filtered position
    const xHat = a * x + (1.0 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export class DualAxisFilter {
  public filterX: OneEuroFilter;
  public filterY: OneEuroFilter;

  constructor(minCutoff = 1.1, beta = 0.007) {
    this.filterX = new OneEuroFilter(minCutoff, beta);
    this.filterY = new OneEuroFilter(minCutoff, beta);
  }

  public setParams(minCutoff: number, beta: number): void {
    this.filterX.setParams(minCutoff, beta);
    this.filterY.setParams(minCutoff, beta);
  }

  public getVelocity(): number {
    return Math.hypot(this.filterX.getVelocity(), this.filterY.getVelocity());
  }

  public filter(
    x: number, 
    y: number, 
    timestampMs: number, 
    dynamicMinCutoff?: number, 
    dynamicBeta?: number
  ): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, timestampMs, dynamicMinCutoff, dynamicBeta),
      y: this.filterY.filter(y, timestampMs, dynamicMinCutoff, dynamicBeta),
    };
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
