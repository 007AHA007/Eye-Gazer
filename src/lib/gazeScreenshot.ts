// src/lib/gazeScreenshot.ts
/**
 * High-Resolution Gaze Viewport Screenshot & Visual Snapshot Generator
 * Renders the current reading viewport, active foveal paragraph, and live gaze coordinates
 * onto a crisp 2x Retina HTML5 Canvas and exports a downloadable PNG data URL.
 */

export interface GazeSnapshotItem {
  id: string;
  timestamp: number;
  dataUrl: string;
  documentTitle: string;
  pageNumber: number;
  progressPct: number;
  focusedParagraphId: string | null;
  focusedText: string;
  dwellSeconds: number;
  gazeX: number;
  gazeY: number;
}

/**
 * Plays a subtle, crisp mechanical camera shutter sound using Web Audio API
 */
export function playShutterSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Short white-noise burst + high-pass filter to emulate a physical SLR shutter leaf
    const duration = 0.065;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.28));
      data[i] = (Math.random() * 2 - 1) * env * 0.35;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 150);
  } catch {
    // Ignore audio errors if browser blocks autoplay
  }
}

/**
 * Word-wraps a string into lines that fit within `maxWidth` on the given Canvas 2D context.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Captures the current reading viewport, visible paragraphs, and exact 2D gaze target
 * into a high-resolution PNG screenshot dataUrl.
 */
export function captureGazeViewportScreenshot(options: {
  documentTitle: string;
  pageNumber: number;
  progressPct: number;
  theme: 'light' | 'sepia' | 'dark' | 'e-ink';
  focusedParaId: string | null;
  paragraphDwell: Record<string, number>;
  gazeX: number;
  gazeY: number;
}): GazeSnapshotItem {
  const {
    documentTitle,
    pageNumber,
    progressPct,
    theme,
    focusedParaId,
    paragraphDwell,
    gazeX,
    gazeY,
  } = options;

  const vw = Math.max(800, window.innerWidth || 1280);
  const vh = Math.max(600, window.innerHeight || 800);

  // Create a 1200x760 2x Retina canvas representing the reading viewport
  const width = 1120;
  const height = 720;
  const dpr = 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');

  const palettes = {
    light: {
      bg: '#FBF9F5',
      card: '#FFFFFF',
      text: '#1C1917',
      muted: '#78716C',
      accent: '#2563EB',
      highlightBg: 'rgba(37, 99, 235, 0.08)',
      highlightBorder: '#2563EB',
      border: '#E7E2DA',
    },
    sepia: {
      bg: '#F6ECD9',
      card: '#F9F4E8',
      text: '#433422',
      muted: '#875529',
      accent: '#B45309',
      highlightBg: 'rgba(180, 83, 9, 0.10)',
      highlightBorder: '#B45309',
      border: '#DFCEAA',
    },
    dark: {
      bg: '#18181B',
      card: '#27272A',
      text: '#F4F4F5',
      muted: '#A1A1AA',
      accent: '#22D3EE',
      highlightBg: 'rgba(34, 211, 238, 0.11)',
      highlightBorder: '#22D3EE',
      border: '#3F3F46',
    },
    'e-ink': {
      bg: '#FFFFFF',
      card: '#F4F4F4',
      text: '#000000',
      muted: '#333333',
      accent: '#000000',
      highlightBg: 'rgba(0, 0, 0, 0.06)',
      highlightBorder: '#000000',
      border: '#000000',
    },
  };

  const palette = palettes[theme] || palettes.light;

  // Gather visible paragraphs in the current DOM viewport
  const paraElements = Array.from(document.querySelectorAll<HTMLElement>('[data-para-id]'));
  const visibleParas: Array<{
    id: string;
    text: string;
    topRatio: number;
    isFocused: boolean;
    dwell: number;
  }> = [];

  let capturedFocusText = '';

  for (const el of paraElements) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) continue;
    const id = el.getAttribute('data-para-id') || '';
    const rawText = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const cleanText = rawText.replace(/^\d+s\s*/, '').trim();
    const isFocused = id === focusedParaId;
    if (isFocused) {
      capturedFocusText = cleanText;
    }
    visibleParas.push({
      id,
      text: cleanText,
      topRatio: rect.top / vh,
      isFocused,
      dwell: paragraphDwell[id] || 0,
    });
  }

  // Fallback if no paragraph was directly matched
  if (!capturedFocusText && visibleParas.length > 0) {
    const midPara = visibleParas[Math.floor(visibleParas.length / 2)];
    midPara.isFocused = true;
    capturedFocusText = midPara.text;
  }

  if (ctx) {
    ctx.scale(dpr, dpr);

    // 1. Background fill
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Top Telemetry Header Bar
    ctx.fillStyle = palette.card;
    ctx.fillRect(0, 0, width, 68);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 68);
    ctx.lineTo(width, 68);
    ctx.stroke();

    // Brand badge
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.roundRect(28, 16, 36, 36, 8);
    ctx.fill();

    ctx.fillStyle = theme === 'dark' ? '#09090B' : '#FFFFFF';
    ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('2×', 37, 39);

    // Header Title & Metadata
    ctx.fillStyle = palette.text;
    ctx.font = 'bold 16px ui-sans-serif, system-ui, sans-serif';
    const shortTitle =
      documentTitle.length > 62 ? documentTitle.slice(0, 60) + '…' : documentTitle;
    ctx.fillText(shortTitle, 78, 33);

    ctx.fillStyle = palette.muted;
    ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
    const timeStr = new Date().toLocaleTimeString();
    ctx.fillText(
      `2-BLINK GAZE SNAPSHOT  ·  PAGE ${pageNumber} (${progressPct}%)  ·  CAPTURED AT ${timeStr}`,
      78,
      52
    );

    // 3. Render Visible Document Passages
    let cursorY = 104;
    const contentLeft = 72;
    const contentWidth = width - 144;

    const parasToRender = visibleParas.slice(0, 5);
    for (const p of parasToRender) {
      if (cursorY > height - 95) break;

      ctx.font = p.isFocused
        ? '500 17px Georgia, ui-serif, serif'
        : '400 16px Georgia, ui-serif, serif';
      const lines = wrapCanvasText(ctx, p.text, contentWidth - 40).slice(0, 6);
      const blockHeight = lines.length * 26 + 24;

      if (p.isFocused) {
        // Highlighted Foveal Box
        ctx.fillStyle = palette.highlightBg;
        ctx.beginPath();
        ctx.roundRect(contentLeft - 16, cursorY - 18, contentWidth + 16, blockHeight, 12);
        ctx.fill();

        ctx.strokeStyle = palette.highlightBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(contentLeft - 16, cursorY - 18, contentWidth + 16, blockHeight, 12);
        ctx.stroke();

        // Foveal Focus Pill Tag
        ctx.fillStyle = palette.accent;
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(
          `★ FOVEAL FIXATION TARGET (${p.dwell.toFixed(1)}s DWELL)`,
          contentLeft,
          cursorY - 4
        );
        cursorY += 12;
      }

      ctx.fillStyle = p.isFocused ? palette.text : palette.muted;
      ctx.font = p.isFocused
        ? '17px Georgia, ui-serif, serif'
        : '16px Georgia, ui-serif, serif';

      for (const line of lines) {
        ctx.fillText(line, contentLeft, cursorY + 12);
        cursorY += 26;
      }

      cursorY += 24;
    }

    // 4. Draw Live Gaze Crosshair & Reticle Overlay mapped to canvas space
    // Map screen gaze (256..vw, 0..vh) onto the reading canvas
    const normX = Math.max(0.08, Math.min(0.92, (gazeX - 200) / Math.max(400, vw - 200)));
    const normY = Math.max(0.14, Math.min(0.88, gazeY / vh));
    const reticleX = Math.round(normX * width);
    const reticleY = Math.round(normY * height);

    // Outer glow ring
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(reticleX, reticleY, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bullseye
    ctx.setLineDash([]);
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(reticleX, reticleY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair coordinate tag
    ctx.fillStyle = palette.card;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.5;
    const tagW = 148;
    const tagH = 24;
    const tagX = Math.min(width - tagW - 16, reticleX + 32);
    const tagY = Math.max(78, reticleY - 12);
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.text;
    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`GAZE (${Math.round(gazeX)}, ${Math.round(gazeY)})`, tagX + 10, tagY + 16);
    ctx.restore();

    // 5. Footer Watermark Bar
    ctx.fillStyle = palette.card;
    ctx.fillRect(0, height - 42, width, 42);
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(0, height - 42);
    ctx.lineTo(width, height - 42);
    ctx.stroke();

    ctx.fillStyle = palette.muted;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      'Captured hands-free via Double-Blink Eye Aspect Ratio (EAR) Gesture · Gaze Reader',
      28,
      height - 16
    );
  }

  const dataUrl = canvas.toDataURL('image/png');
  const focusedDwell = focusedParaId ? paragraphDwell[focusedParaId] || 0 : 0;

  return {
    id: `snap_${Date.now()}`,
    timestamp: Date.now(),
    dataUrl,
    documentTitle,
    pageNumber,
    progressPct,
    focusedParagraphId: focusedParaId,
    focusedText:
      capturedFocusText ||
      'Captured viewport snapshot via double-blink gesture.',
    dwellSeconds: focusedDwell,
    gazeX: Math.round(gazeX),
    gazeY: Math.round(gazeY),
  };
}

/**
 * Triggers a browser PNG file download for a GazeSnapshotItem
 */
export function downloadSnapshotPng(snapshot: GazeSnapshotItem): void {
  const a = document.createElement('a');
  a.href = snapshot.dataUrl;
  const slug = snapshot.documentTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32);
  a.download = `gaze-snapshot-${slug}-p${snapshot.pageNumber}-${new Date(snapshot.timestamp)
    .toTimeString()
    .slice(0, 8)
    .replace(/:/g, '')}.png`;
  a.click();
}
