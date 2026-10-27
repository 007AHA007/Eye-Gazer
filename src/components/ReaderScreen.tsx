import React, { useEffect, useRef, useState } from 'react';
import { 
  FileText, 
  Upload, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  RefreshCcw, 
  Settings as SettingsIcon, 
  Sliders, 
  CheckCircle2, 
  RotateCcw, 
  X, 
  Bookmark, 
  BookOpen, 
  FileUp, 
  ChevronRight,
  ListOrdered,
  Flame,
  ScanLine,
  Download,
  Crosshair,
  Camera
} from 'lucide-react';
import { 
  ReaderSettings, 
  DocumentData, 
  ExtractedPdfPage, 
  ReadingProgress 
} from '../types';
import { 
  loadSettings, 
  saveSettings, 
  getDocumentProgress, 
  saveDocumentProgress, 
  clearDocumentProgress,
  getRecentDocuments,
  saveRecentDocument
} from '../lib/storage';
import { extractTextFromPdf } from '../lib/pdfExtractor';
import { SettingsDrawer } from './SettingsDrawer';
import { HeadPostureHUD } from './HeadPostureHUD';
import {
  applyQuick3PointCalibration,
  setDoubleBlinkEnabled,
  getBlinkTelemetry,
  setBlinkSensitivity
} from '../lib/headPoseTracker';
import {
  captureGazeViewportScreenshot,
  downloadSnapshotPng,
  playShutterSound,
  GazeSnapshotItem
} from '../lib/gazeScreenshot';

interface Props {
  documentId: string;
  onRecalibrate?: () => void;
}

interface BookmarkedPassage {
  paraId: string;
  pageNumber: number;
  snippet: string;
  dwellSeconds: number;
  savedAt: number;
}

const DEMO_PAPER: DocumentData = {
  id: 'demo-research-paper',
  title: 'Attention Dynamics in Passive Webcam Gaze Interaction for Dense Document Reading',
  type: 'demo',
  wordCount: 3840,
  uploadedAt: Date.now(),
  pages: [
    {
      pageNumber: 1,
      text: `Abstract\n\nPassive gaze-assisted document navigation represents a significant milestone in accessible human-computer interfaces. Traditional eye-tracking systems have historically necessitated specialized, high-cost infrared optical hardware, calibrated chin rests, and rigid lighting conditions. Recent advances in browser-based machine vision have enabled real-time iris landmark estimation through commodity optical webcams.\n\nThis paper examines the physiological and cognitive dynamics of passive gaze scrolling during deep cognitive engagement with dense academic texts. By analyzing the interaction between natural saccadic sweeps, regressions, and vertical fixation drift, we present a velocity-modulated teleprompter scrolling architecture. Our empirical findings demonstrate a 41% reduction in motor interruptions compared to traditional mouse-wheel scrolling, with zero manual input required across extended 45-minute reading trials.\n\nKeywords: Eye-tracking, Human-Computer Interaction, WebGazer, Teleprompter Scrolling, Assistive Technology.`
    },
    {
      pageNumber: 2,
      text: `1. Introduction & Background\n\nReading dense scientific literature demands sustained visual focus and cognitive throughput. In conventional graphical user interfaces, users must continually interleave cognitive reading with mechanical input (scrolling with a mouse wheel, trackpad swipes, or keyboard down-arrows). These motor events—while brief—introduce micro-disruptions that fragment working memory.\n\nThe human eye undergoes three primary movements during reading:\n1. Fixations: Moments of stationary gaze lasting 200–350 ms where visual information is acquired.\n2. Saccades: Rapid ballistic movements (20–40 ms) traversing 7–9 character spaces across the line of text.\n3. Regressions: Backward saccades made to re-read or verify ambiguous syntactic structures.\n\nWhen a reader approaches the bottom quadrant of their display, an ergonomic friction point arises: either the user must manually pan the viewport downward to bring subsequent paragraphs into central vision, or their gaze is forced into an unnatural neck-flexed posture.`
    },
    {
      pageNumber: 3,
      text: `2. Machine Vision & Pupil Tracking Pipeline\n\nOur client-side pipeline leverages WebGazer.js, utilizing a multi-stage convolutional landmark estimator. Rather than executing heavy neural inference on external cloud servers, the video frame (typically 640x480 at 30 fps) is processed entirely in the browser using WebGL and HTML5 Canvas.\n\nTo compensate for webcam noise, optical aberration, and ambient illumination variance, raw gaze coordinates (X, Y) are piped through a dynamic One-Euro adaptive low-pass filter with velocity-modulated cutoff frequency:\n\n    X_smoothed(t) = α * X_raw(t) + (1 - α) * X_smoothed(t-1)\n\nwhere α scales dynamically with ocular velocity: when the reader executes an expansive saccade between the sidebar and the main document body, cutoff frequency increases to maximize responsiveness. During stationary reading fixations, cutoff decays, eliminating ocular micro-tremor (nystagmus) and preventing erratic viewport movement.`
    },
    {
      pageNumber: 4,
      text: `3. The Continuous Teleprompter Interaction Model\n\nPrior gaze-reading implementations have frequently relied on binary "chunk" scrolling: once the gaze crosses a predefined bottom margin, the viewport executes an instantaneous jump of 400 pixels. Empirical testing revealed that chunk scrolling causes severe visual disorientation; readers lose their anchor line and are forced to spend several seconds scanning to locate where they left off.\n\nTo overcome this limitation, our system implements a continuous, velocity-proportional teleprompter scroll. We partition the vertical viewport into three continuous zones:\n\n• Top Scroll-Up Zone (0% to 25% of viewport height): When a reader looks back to verify an earlier passage or equation, the document pans smoothly upward.\n• Neutral Reading Zone (25% to 70% of viewport height): Zero scrolling occurs. Readers can freely scan lines horizontally without activating any mechanical response.\n• Bottom Scroll-Down Zone (70% to 100% of viewport height): As the reader reaches the lower lines of the visible page, the canvas glides downward with speed proportional to the gaze depth:\n\n    Speed = BaseSpeed + (Depth * MaxVelocityMultiplier)`
    },
    {
      pageNumber: 5,
      text: `4. Experimental Methodology & Participant Feedback\n\nWe conducted a controlled study across 24 participants (14 undergraduate researchers, 10 graduate students) tasked with reading two 5,000-word peer-reviewed neuroscience papers. Each subject completed one paper using standard trackpad scrolling and one paper using the continuous gaze-reading system.\n\nKey Metrics Measured:\n• Reading Speed (Words Per Minute): Average 284 WPM (Gaze Reader) vs. 268 WPM (Standard).\n• Self-Reported Eye Fatigue: Rated 2.4/5 on a standard Likert scale.\n• Focus Retention: 87% of participants reported feeling 'significantly more immersed' due to the elimination of hand gestures while reading.\n\nParticipants particularly praised the subtle foveal paragraph spotlight and marginal fixation telemetry, noting that it provided gentle subconscious reassurance that the system was tracking accurately.`
    },
    {
      pageNumber: 6,
      text: `5. Future Trajectories & Accessibility Implications\n\nThe implications of robust, zero-cost gaze navigation extend far beyond academic productivity. Individuals experiencing severe motor impairments—such as Amyotrophic Lateral Sclerosis (ALS), high-level spinal cord injuries, or cerebral palsy—often face steep economic barriers when accessing specialized assistive eye-tracking hardware.\n\nBy optimizing consumer webcams with 2D head-reference compensation and ergonomic zone controls, we democratize hands-free educational and informational access. Ongoing work explores the integration of dwell-based contextual glossaries, gaze-guided section bookmarks, and local reading comprehension heatmaps.\n\nReferences:\n[1] Papoutsaki, A., et al. (2016). WebGazer: Scalable Webcam EyeTracking Using User Interactions. IJCAI.\n[2] Rayner, K. (1998). Eye movements in reading and information processing: 20 years of research. Psychological Bulletin.\n[3] Holmqvist, K., et al. (2011). Eye Tracking: A comprehensive guide to methods and measures. Oxford University Press.`
    }
  ]
};

export function ReaderScreen({ documentId, onRecalibrate }: Props) {
  // Settings & Theme State
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Novel Gaze-Contingent Reading Aids
  const [focusMode, setFocusMode] = useState<'off' | 'spotlight' | 'ruler'>('spotlight');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [activeParaId, setActiveParaId] = useState<string | null>(null);
  const [gazeRulerY, setGazeRulerY] = useState<number>(window.innerHeight * 0.42);
  const [paragraphDwell, setParagraphDwell] = useState<Record<string, number>>({});
  const [bookmarks, setBookmarks] = useState<BookmarkedPassage[]>([]);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  // In-Reader Quick 3-Dot Recalibration State
  const [isQuickTuning, setIsQuickTuning] = useState<boolean>(false);
  const [quickTuneSamples, setQuickTuneSamples] = useState<
    Array<{ id: string; rawX: number; rawY: number; targetX: number; targetY: number }>
  >([]);

  // 4-Blink Screenshot & Snapshot Gallery State
  const [doubleBlinkActive, setDoubleBlinkActive] = useState<boolean>(true);
  const [blinkSensitivityLevel, setBlinkSensitivityLevel] = useState<'easy' | 'normal' | 'strict'>('normal');
  const [blinkMeter, setBlinkMeter] = useState<{
    opennessRatio: number;
    thresholdRatio: number;
    isEyeClosed: boolean;
  }>({ opennessRatio: 1.0, thresholdRatio: 0.78, isEyeClosed: false });
  const [autoDownloadBlinkPng, setAutoDownloadBlinkPng] = useState<boolean>(false);
  const [blinkStreakCount, setBlinkStreakCount] = useState<number>(0);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [snapshots, setSnapshots] = useState<GazeSnapshotItem[]>([]);
  const [latestSnapshotToast, setLatestSnapshotToast] = useState<GazeSnapshotItem | null>(null);
  const [activeLightboxSnapshot, setActiveLightboxSnapshot] = useState<GazeSnapshotItem | null>(null);

  // Document State
  const [activeDocument, setActiveDocument] = useState<DocumentData>(() => {
    const recents = getRecentDocuments();
    if (recents.length > 0 && recents[0].id !== DEMO_PAPER.id) {
      return recents[0];
    }
    return DEMO_PAPER;
  });

  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reading Progress & Resuming State
  const [currentProgress, setCurrentProgress] = useState<ReadingProgress | null>(null);
  const [resumeNotification, setResumeNotification] = useState<{
    shown: boolean;
    percentage: number;
    page?: number;
  } | null>(null);

  // Auto-scroll control
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync settings to window global
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Reset paragraph dwell telemetry when switching documents
  useEffect(() => {
    setParagraphDwell({});
    setBookmarks([]);
    setSessionSeconds(0);
  }, [activeDocument.id]);

  // Real-time 10Hz Foveal Paragraph Fixation, Blink Meter & Attention Heatmap Sampler
  useEffect(() => {
    const interval = window.setInterval(() => {
      const bt = getBlinkTelemetry();
      setBlinkMeter({
        opennessRatio: bt.opennessRatio,
        thresholdRatio: bt.thresholdRatio,
        isEyeClosed: bt.isEyeClosed,
      });

      const gs = window._gazeState;
      if (!gs || gs.smoothedY === null) return;

      const y = gs.smoothedY;
      setGazeRulerY(y);

      if (!isAutoScrollPaused) {
        setSessionSeconds((prev) => +(prev + 0.1).toFixed(1));
      }

      // Find which paragraph currently intersects the user's vertical gaze line
      const paraNodes = document.querySelectorAll<HTMLElement>('[data-para-id]');
      let matchedId: string | null = null;
      let closestDist = Infinity;

      for (let i = 0; i < paraNodes.length; i++) {
        const el = paraNodes[i];
        const rect = el.getBoundingClientRect();
        // Check if paragraph is visible in viewport
        if (rect.bottom < 40 || rect.top > window.innerHeight - 40) continue;

        if (y >= rect.top - 12 && y <= rect.bottom + 12) {
          matchedId = el.getAttribute('data-para-id');
          break;
        }

        const center = (rect.top + rect.bottom) * 0.5;
        const dist = Math.abs(y - center);
        if (dist < closestDist && dist < 90) {
          closestDist = dist;
          matchedId = el.getAttribute('data-para-id');
        }
      }

      setActiveParaId(matchedId);

      // Accumulate dwell time when gaze is within the reading canvas (not inside left sidebar)
      if (matchedId && (gs.smoothedX === null || gs.smoothedX > 256)) {
        setParagraphDwell((prev) => ({
          ...prev,
          [matchedId!]: +((prev[matchedId!] || 0) + 0.1).toFixed(1),
        }));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isAutoScrollPaused]);

  // Ref holding latest state for the Double-Blink event listener
  const snapshotContextRef = useRef({
    activeDocument,
    currentProgress,
    settings,
    activeParaId,
    paragraphDwell,
    doubleBlinkActive,
    autoDownloadBlinkPng,
  });

  useEffect(() => {
    snapshotContextRef.current = {
      activeDocument,
      currentProgress,
      settings,
      activeParaId,
      paragraphDwell,
      doubleBlinkActive,
      autoDownloadBlinkPng,
    };
  }, [
    activeDocument,
    currentProgress,
    settings,
    activeParaId,
    paragraphDwell,
    doubleBlinkActive,
    autoDownloadBlinkPng,
  ]);

  const triggerGazeScreenshot = () => {
    const ctx = snapshotContextRef.current;
    const gs = window._gazeState;
    const gazeX = gs?.smoothedX ?? window.innerWidth * 0.5;
    const gazeY = gs?.smoothedY ?? window.innerHeight * 0.48;

    playShutterSound();
    setShutterFlash(true);
    setBlinkStreakCount(0);
    window.setTimeout(() => setShutterFlash(false), 320);

    const snap = captureGazeViewportScreenshot({
      documentTitle: ctx.activeDocument.title,
      pageNumber: ctx.currentProgress?.page || 1,
      progressPct: ctx.currentProgress?.percentage || 0,
      theme: ctx.settings.theme,
      focusedParaId: ctx.activeParaId,
      paragraphDwell: ctx.paragraphDwell,
      gazeX,
      gazeY,
    });

    setSnapshots((prev) => [snap, ...prev].slice(0, 12));
    setLatestSnapshotToast(snap);

    // Also auto-bookmark the fixated paragraph if not already bookmarked
    if (ctx.activeParaId) {
      const paraEl = document.querySelector<HTMLElement>(`[data-para-id="${ctx.activeParaId}"]`);
      const text = paraEl?.innerText?.replace(/^\d+s\s*/, '').trim() || snap.focusedText;
      setBookmarks((prev) => {
        if (prev.some((b) => b.paraId === ctx.activeParaId)) return prev;
        const cleanSnippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
        return [
          ...prev,
          {
            paraId: ctx.activeParaId!,
            pageNumber: ctx.currentProgress?.page || 1,
            snippet: cleanSnippet + (text.length > 120 ? '…' : ''),
            dwellSeconds: ctx.paragraphDwell[ctx.activeParaId!] || 0,
            savedAt: Date.now(),
          },
        ];
      });
    }

    if (ctx.autoDownloadBlinkPng) {
      downloadSnapshotPng(snap);
    }
  };

  // Listen for 1st Blink (1/2) and 2-Blink Screenshot (2/2) gestures + 'B' shortcut
  useEffect(() => {
    let singlePulseTimer: number;
    let toastTimer: number;

    const onSingleBlink = (e: Event) => {
      if (!snapshotContextRef.current.doubleBlinkActive) return;
      const streak = (e as CustomEvent)?.detail?.streak;
      setBlinkStreakCount(typeof streak === 'number' && streak > 0 ? streak : 1);
      window.clearTimeout(singlePulseTimer);
      singlePulseTimer = window.setTimeout(() => {
        setBlinkStreakCount(0);
      }, 950);
    };

    const onDoubleBlink = () => {
      if (!snapshotContextRef.current.doubleBlinkActive) return;
      triggerGazeScreenshot();
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        setLatestSnapshotToast(null);
      }, 6500);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'b' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        triggerGazeScreenshot();
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          setLatestSnapshotToast(null);
        }, 6500);
      }
    };

    window.addEventListener('gaze-single-blink', onSingleBlink);
    window.addEventListener('gaze-double-blink', onDoubleBlink);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('gaze-single-blink', onSingleBlink);
      window.removeEventListener('gaze-double-blink', onDoubleBlink);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(singlePulseTimer);
      window.clearTimeout(toastTimer);
    };
  }, []);

  // Handle Reading Progress tracking on scroll
  useEffect(() => {
    let saveTimeout: number;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percentage = docHeight > 0 ? Math.min(100, Math.max(0, (scrollY / docHeight) * 100)) : 0;

      // Estimate current page
      let currentPage = 1;
      if (activeDocument.pages && activeDocument.pages.length > 0) {
        const total = activeDocument.pages.length;
        currentPage = Math.min(total, Math.max(1, Math.ceil((percentage / 100) * total)));
      }

      setCurrentProgress({
        documentId: activeDocument.id,
        scrollY,
        percentage: Math.round(percentage),
        page: currentPage,
        totalPages: activeDocument.pages?.length || 1,
        lastReadAt: Date.now(),
      });

      // Debounce saving to localStorage
      clearTimeout(saveTimeout);
      saveTimeout = window.setTimeout(() => {
        saveDocumentProgress(
          activeDocument.id,
          scrollY,
          percentage,
          currentPage,
          activeDocument.pages?.length
        );
      }, 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(saveTimeout);
    };
  }, [activeDocument]);

  // Check saved progress on document mount or change
  useEffect(() => {
    const saved = getDocumentProgress(activeDocument.id);
    if (saved && saved.scrollY > 150 && saved.percentage > 3) {
      window.scrollTo({ top: saved.scrollY, behavior: 'smooth' });
      setResumeNotification({
        shown: true,
        percentage: saved.percentage,
        page: saved.page,
      });

      const timer = setTimeout(() => {
        setResumeNotification((prev) => (prev ? { ...prev, shown: false } : null));
      }, 6000);

      return () => clearTimeout(timer);
    } else {
      window.scrollTo(0, 0);
      setResumeNotification(null);
    }
  }, [activeDocument.id]);

  // Handle File Upload (PDF, TXT, MD)
  const processUploadedFile = async (file: File) => {
    const fileName = file.name;
    const isPdf = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    setIsLoadingFile(true);
    setUploadError(null);

    try {
      if (isPdf) {
        setLoadingMessage(`Extracting text from PDF: ${fileName}...`);
        const buffer = await file.arrayBuffer();
        const result = await extractTextFromPdf(buffer);

        const newDoc: DocumentData = {
          id: `pdf_${Date.now()}_${fileName.replace(/\s+/g, '_')}`,
          title: result.title || fileName.replace(/\.[^/.]+$/, ''),
          type: 'pdf',
          fileName,
          fileSize: file.size,
          totalPages: result.totalPages,
          pages: result.pages,
          content: result.fullText,
          wordCount: result.fullText.split(/\s+/).length,
          uploadedAt: Date.now(),
        };

        setActiveDocument(newDoc);
        saveRecentDocument(newDoc);
      } else {
        setLoadingMessage(`Reading ${fileName}...`);
        const text = await file.text();
        const paragraphs = text.split(/\n\s*\n/);
        const pages: ExtractedPdfPage[] = [];
        let curPageText = '';
        let pageIndex = 1;

        for (const p of paragraphs) {
          if ((curPageText + '\n\n' + p).split(/\s+/).length > 450 && curPageText.length > 0) {
            pages.push({ pageNumber: pageIndex++, text: curPageText.trim() });
            curPageText = p;
          } else {
            curPageText += (curPageText ? '\n\n' : '') + p;
          }
        }
        if (curPageText.trim()) {
          pages.push({ pageNumber: pageIndex, text: curPageText.trim() });
        }

        const newDoc: DocumentData = {
          id: `text_${Date.now()}_${fileName.replace(/\s+/g, '_')}`,
          title: fileName.replace(/\.[^/.]+$/, ''),
          type: 'text',
          fileName,
          fileSize: file.size,
          totalPages: pages.length || 1,
          pages: pages.length > 0 ? pages : [{ pageNumber: 1, text }],
          content: text,
          wordCount: text.split(/\s+/).length,
          uploadedAt: Date.now(),
        };

        setActiveDocument(newDoc);
        saveRecentDocument(newDoc);
      }
    } catch (err: any) {
      console.error('Error processing file:', err);
      setUploadError('Could not parse this file. Please upload a valid PDF or plain text document.');
    } finally {
      setIsLoadingFile(false);
      setLoadingMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const toggleAutoScroll = () => {
    const nextState = !isAutoScrollPaused;
    setIsAutoScrollPaused(nextState);
    if (window._gazeSettings) {
      window._gazeSettings.isPaused = nextState;
    }
  };

  const handleManualScroll = (direction: 'up' | 'down') => {
    const scrollAmount = Math.min(window.innerHeight * 0.7, 400);
    window.scrollBy({ top: direction === 'down' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  };

  const handleJumpToPage = (pageNum: number) => {
    const pageEl = document.getElementById(`doc-page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleJumpToParagraph = (paraId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-para-id="${paraId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleBookmarkParagraph = (paraId: string, pageNumber: number, text: string) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.paraId === paraId);
      if (exists) {
        return prev.filter((b) => b.paraId !== paraId);
      }
      const cleanSnippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
      return [
        ...prev,
        {
          paraId,
          pageNumber,
          snippet: cleanSnippet + (text.length > 120 ? '…' : ''),
          dwellSeconds: paragraphDwell[paraId] || 0,
          savedAt: Date.now(),
        },
      ];
    });
  };

  const handleExportReadingReport = () => {
    const totalDwell = (Object.values(paragraphDwell) as number[]).reduce((acc, v) => acc + v, 0);
    const topParagraphs = (Object.entries(paragraphDwell) as [string, number][])
      .filter(([, sec]) => sec >= 1.0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const lines: string[] = [
      `# Gaze Reading Telemetry & Study Report`,
      `**Document:** ${activeDocument.title}`,
      `**Date:** ${new Date().toISOString().slice(0, 10)}`,
      `**Completion:** ${currentProgress?.percentage || 0}% · **Active Gaze Fixation Time:** ${totalDwell.toFixed(1)}s`,
      ``,
      `## 1. Gaze-Bookmarked Passages (${bookmarks.length})`,
    ];

    if (bookmarks.length === 0) {
      lines.push(`_No passages bookmarked during this session._`);
    } else {
      bookmarks.forEach((b, i) => {
        lines.push(`${i + 1}. **[Page ${b.pageNumber} · ${b.dwellSeconds.toFixed(1)}s dwell]** "${b.snippet}"`);
      });
    }

    lines.push(``, `## 2. Highest Cognitive Fixation Passages`);
    if (topParagraphs.length === 0) {
      lines.push(`_Insufficient dwell data collected yet._`);
    } else {
      topParagraphs.forEach(([paraId, sec], idx) => {
        const el = document.querySelector<HTMLElement>(`[data-para-id="${paraId}"]`);
        const rawText = el?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 140) || paraId;
        lines.push(`${idx + 1}. **${sec.toFixed(1)}s fixation** (${paraId}): "${rawText}…"`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDocument.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-gaze-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetProgress = () => {
    clearDocumentProgress(activeDocument.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentProgress({
      documentId: activeDocument.id,
      scrollY: 0,
      percentage: 0,
      page: 1,
      totalPages: activeDocument.pages?.length || 1,
      lastReadAt: Date.now(),
    });
    setResumeNotification(null);
  };

  // Theme styling helpers
  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'sepia':
        return {
          wrapper: 'bg-[#F6ECD9] text-[#433422]',
          sidebar: 'bg-[#EEDFBE] border-[#DFCEAA] text-[#433422]',
          sidebarCard: 'bg-[#F9F4E8] border-[#DFCEAA]',
          cardBorder: 'border-[#DFCEAA]',
          accentText: 'text-[#875529]',
          divider: 'bg-[#DFCEAA]',
          pageDivider: 'border-[#DFCEAA] text-[#875529]',
        };
      case 'dark':
        return {
          wrapper: 'bg-[#18181B] text-[#F4F4F5]',
          sidebar: 'bg-[#27272A] border-[#3F3F46] text-[#F4F4F5]',
          sidebarCard: 'bg-[#18181B] border-[#3F3F46]',
          cardBorder: 'border-[#3F3F46]',
          accentText: 'text-cyan-400',
          divider: 'bg-[#3F3F46]',
          pageDivider: 'border-zinc-800 text-zinc-500',
        };
      case 'e-ink':
        return {
          wrapper: 'bg-white text-black font-serif',
          sidebar: 'bg-[#F2F2F2] border-black text-black',
          sidebarCard: 'bg-white border-black',
          cardBorder: 'border-black',
          accentText: 'text-black font-bold',
          divider: 'bg-black',
          pageDivider: 'border-black text-black',
        };
      case 'light':
      default:
        return {
          wrapper: 'bg-[#FBF9F5] text-stone-900',
          sidebar: 'bg-[#F4EFEA] border-[#E7E2DA] text-stone-900',
          sidebarCard: 'bg-white border-stone-200',
          cardBorder: 'border-stone-200',
          accentText: 'text-blue-600',
          divider: 'bg-stone-200',
          pageDivider: 'border-stone-200 text-stone-400',
        };
    }
  };

  const themeClasses = getThemeClasses();

  // Typography styling
  const getTypographyClasses = () => {
    let font = 'font-serif';
    if (settings.fontFamily === 'sans') font = 'font-sans';
    if (settings.fontFamily === 'mono') font = 'font-mono';

    let size = 'text-lg leading-relaxed';
    if (settings.fontSize === 'sm') size = 'text-[15px] leading-normal';
    if (settings.fontSize === 'lg') size = 'text-xl leading-loose';
    if (settings.fontSize === 'xl') size = 'text-2xl leading-loose';

    return `${font} ${size}`;
  };

  const recentDocs = getRecentDocuments();
  const maxParaDwell = Math.max(4, ...(Object.values(paragraphDwell) as number[]));
  const totalFixationSeconds = (Object.values(paragraphDwell) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div 
      className={`min-h-screen flex transition-colors duration-200 relative ${themeClasses.wrapper}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
      />

      {/* Full-Screen Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[9990] bg-blue-600/90 text-white flex flex-col items-center justify-center p-8 backdrop-blur-xs pointer-events-none animate-in fade-in duration-150">
          <FileUp className="w-20 h-20 mb-4 animate-bounce" />
          <h2 className="text-3xl font-bold font-sans mb-2">Drop your document here</h2>
          <p className="text-lg opacity-90 font-sans">Supports research papers in PDF, Plain Text (.txt), or Markdown (.md)</p>
        </div>
      )}

      {/* Loading Overlay when parsing large PDF */}
      {isLoadingFile && (
        <div className="fixed inset-0 z-[9995] bg-black/60 text-white flex flex-col items-center justify-center p-8 backdrop-blur-xs">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-semibold font-sans mb-1">Parsing Document</h3>
          <p className="text-sm opacity-80 font-sans">{loadingMessage}</p>
        </div>
      )}

      {/* Floating Top Progress Bar */}
      <div className="fixed top-0 left-64 right-0 h-1 bg-black/5 z-40">
        <div 
          className="h-full bg-blue-600 dark:bg-cyan-400 transition-all duration-200"
          style={{ width: `${currentProgress?.percentage || 0}%` }}
        />
      </div>

      {/* Top Dwell Fixation Indicator for Step-Retreat (Scroll Up) */}
      <div className="fixed top-0 left-64 right-0 h-1.5 bg-black/5 dark:bg-white/5 z-50 pointer-events-none">
        <div 
          id="gaze-top-dwell-progress" 
          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] opacity-0 transition-all duration-75"
          style={{ width: '0%' }}
        />
      </div>

      {/* Bottom Dwell Fixation Indicator for Step-Advance */}
      <div className="fixed bottom-0 left-64 right-0 h-1.5 bg-black/5 dark:bg-white/5 z-50 pointer-events-none">
        <div 
          id="gaze-dwell-progress" 
          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] opacity-0 transition-opacity duration-150"
          style={{ width: '0%' }}
        />
      </div>

      {/* Gaze-Locked Horizontal Reading Ruler (When Focus Mode === 'ruler') */}
      {focusMode === 'ruler' && (
        <div
          className="fixed left-64 right-0 h-12 -translate-y-1/2 pointer-events-none z-30 border-y border-blue-500/30 dark:border-cyan-400/30 bg-blue-500/[0.04] dark:bg-cyan-400/[0.05] transition-transform duration-75"
          style={{ top: `${gazeRulerY}px` }}
        />
      )}

      {/* Visual Zone Guides (If enabled in settings) */}
      {settings.showZoneGuides && (
        <>
          <div 
            className="fixed left-64 right-0 pointer-events-none z-30 border-b-2 border-dashed border-blue-400/50 flex justify-end px-6 transition-all"
            style={{ top: `${settings.topThresholdPct * 100}%` }}
          >
            <span className="text-[11px] font-mono font-semibold bg-blue-500/80 text-white px-2 py-0.5 rounded-t -translate-y-full shadow-xs">
              ↑ Look above this line to scroll UP
            </span>
          </div>

          <div 
            className="fixed left-64 right-0 pointer-events-none z-30 border-t-2 border-dashed border-emerald-500/50 flex justify-end px-6 transition-all"
            style={{ bottom: `${settings.bottomThresholdPct * 100}%` }}
          >
            <span className="text-[11px] font-mono font-semibold bg-emerald-600/80 text-white px-2 py-0.5 rounded-b shadow-xs">
              ↓ Look below this line to scroll DOWN
            </span>
          </div>
        </>
      )}

      {/* Fixed Left Sidebar Controls */}
      <aside className={`w-64 fixed top-0 left-0 bottom-0 border-r p-4 flex flex-col justify-between z-50 font-sans shadow-xs transition-colors duration-200 overflow-y-auto ${themeClasses.sidebar}`}>
        
        <div className="space-y-4">
          {/* Header Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm tracking-tight leading-tight">Gaze Reader</h2>
                <div className="text-[11px] opacity-70 font-mono tabular-nums">
                  {isAutoScrollPaused ? 'Standby' : `Active · ${sessionSeconds.toFixed(0)}s`}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg border hover:opacity-80 transition-opacity text-stone-600 dark:text-zinc-300 border-stone-300 dark:border-zinc-700 hover:bg-black/5"
              title="Open Settings Drawer"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-Scroll Toggle */}
          <button
            onClick={toggleAutoScroll}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
              isAutoScrollPaused 
                ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' 
                : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
            }`}
          >
            <span className="flex items-center gap-2">
              {isAutoScrollPaused ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isAutoScrollPaused ? 'Gaze Scroll: PAUSED' : 'Gaze Scroll: ACTIVE'}
            </span>
            <span className="text-[10px] opacity-85 font-mono">
              {isAutoScrollPaused ? 'Resume' : 'Pause'}
            </span>
          </button>

          {/* Novelty: Foveal Focus & Cognitive Attention Controls */}
          <div className={`p-3 rounded-xl border space-y-2.5 ${themeClasses.sidebarCard}`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5 text-blue-500" />
                Foveal Focus Aid
              </span>
              <span className="font-mono tabular-nums text-[10px] opacity-70">
                {totalFixationSeconds.toFixed(1)}s dwell
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg text-[11px] font-medium">
              {(['spotlight', 'ruler', 'off'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFocusMode(mode)}
                  className={`py-1 rounded-md capitalize transition-all ${
                    focusMode === mode
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5 text-[11px]">
              <span className="opacity-75 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Attention Heatmap
              </span>
              <button
                onClick={() => setShowHeatmap((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                  showHeatmap
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-black/5 dark:bg-white/5 opacity-60'
                }`}
              >
                {showHeatmap ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Reading Progress Indicator */}
          <div className={`p-3 rounded-xl border space-y-2 ${themeClasses.sidebarCard}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5 opacity-80">
                <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                Reading Progress
              </span>
              <span className="font-bold font-mono tabular-nums">
                {currentProgress ? `${currentProgress.percentage}%` : '0%'}
              </span>
            </div>

            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-cyan-400 h-full transition-all duration-300"
                style={{ width: `${currentProgress?.percentage || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] opacity-70 font-mono tabular-nums">
              <span>
                {activeDocument.pages && activeDocument.pages.length > 0 
                  ? `Page ${currentProgress?.page || 1} / ${activeDocument.pages.length}`
                  : 'Continuous'}
              </span>
              {currentProgress && currentProgress.percentage > 0 && (
                <button
                  onClick={handleResetProgress}
                  className="hover:underline flex items-center gap-1 hover:text-blue-500 font-sans"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* 2D Head-Reference & Eye Excursion Vector Scope */}
          <HeadPostureHUD theme={settings.theme} />

          {/* 2-Blink Gaze Screenshot Capture & Gallery */}
          <div className={`p-3 rounded-xl border space-y-2 ${themeClasses.sidebarCard}`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                2-Blink Snap ({snapshots.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !doubleBlinkActive;
                  setDoubleBlinkActive(next);
                  setDoubleBlinkEnabled(next);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                  doubleBlinkActive
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-black/5 dark:bg-white/5 opacity-60'
                }`}
              >
                {doubleBlinkActive ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Live 2-Blink Streak Indicator or Instruction */}
            <div
              className={`px-2.5 py-1.5 rounded-lg text-[11px] space-y-1.5 transition-all ${
                blinkStreakCount > 0
                  ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-800 dark:text-cyan-200 font-semibold'
                  : 'bg-black/5 dark:bg-white/5 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>
                  {blinkStreakCount > 0
                    ? '👁️ Blink 1/2 — Blink once more!'
                    : 'Blink twice to capture screenshot'}
                </span>
                <span className="font-mono text-[10px] opacity-75">Key: B</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[1, 2].map((step) => (
                  <div
                    key={step}
                    className={`h-1 rounded-full transition-all duration-150 ${
                      blinkStreakCount >= step
                        ? 'bg-cyan-500 dark:bg-cyan-400'
                        : 'bg-black/15 dark:bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Live Eyelid Openness Sensor Bar & Sensitivity Selector */}
            {doubleBlinkActive && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono opacity-75">
                  <span>
                    Eyelid Sensor: {blinkMeter.isEyeClosed ? 'BLINKING' : `${Math.round(Math.min(100, blinkMeter.opennessRatio * 100))}%`}
                  </span>
                  <span>Trig &lt; {Math.round(blinkMeter.thresholdRatio * 100)}%</span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      blinkMeter.isEyeClosed
                        ? 'bg-cyan-400'
                        : 'bg-emerald-500 dark:bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.max(8, Math.min(100, Math.round(blinkMeter.opennessRatio * 100)))}%`,
                    }}
                  />
                  {/* Threshold marker line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${Math.round(blinkMeter.thresholdRatio * 100)}%` }}
                    title="Blink Trigger Threshold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg text-[10px] font-medium">
                  {(['easy', 'normal', 'strict'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setBlinkSensitivityLevel(lvl);
                        setBlinkSensitivity(lvl);
                      }}
                      className={`py-0.5 rounded capitalize transition-all cursor-pointer ${
                        blinkSensitivityLevel === lvl
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <label className="flex items-center gap-1.5 opacity-80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoDownloadBlinkPng}
                  onChange={(e) => setAutoDownloadBlinkPng(e.target.checked)}
                  className="rounded accent-blue-600 cursor-pointer"
                />
                <span>Auto-save PNG file</span>
              </label>
              <button
                type="button"
                onClick={triggerGazeScreenshot}
                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                title="Capture a Gaze Viewport Screenshot now (or press B)"
              >
                Snap Now
              </button>
            </div>

            {snapshots.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1 pr-1 border-t border-black/5 dark:border-white/5">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-blue-500/10 transition-colors text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveLightboxSnapshot(snap)}
                      className="shrink-0 w-12 h-8 rounded overflow-hidden border border-black/15 dark:border-white/15 bg-black/20 cursor-pointer"
                      title="View Fullscreen Gaze Screenshot"
                    >
                      <img
                        src={snap.dataUrl}
                        alt="Gaze Snapshot"
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLightboxSnapshot(snap)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="font-mono text-[10px] opacity-70">
                        Page {snap.pageNumber} · {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="truncate opacity-90">{snap.focusedText}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSnapshotPng(snap)}
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-blue-600 dark:text-cyan-400 cursor-pointer"
                      title="Download PNG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gaze-Bookmarked Passages & Markdown Export */}
          <div className={`p-3 rounded-xl border space-y-2 ${themeClasses.sidebarCard}`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider opacity-70">
                Gaze Bookmarks ({bookmarks.length})
              </span>
              <button
                onClick={handleExportReadingReport}
                title="Download Markdown Reading Report with Bookmarks & Fixation Heatmap"
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
              >
                <Download className="w-3 h-3" />
                Export .md
              </button>
            </div>

            {bookmarks.length === 0 ? (
              <p className="text-[11px] opacity-60 leading-snug">
                Stare at or click any paragraph&apos;s left margin marker to bookmark key passages hands-free.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {bookmarks.map((b) => (
                  <button
                    key={b.paraId}
                    onClick={() => handleJumpToParagraph(b.paraId)}
                    className="w-full text-left p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-blue-500/10 transition-colors text-[11px]"
                  >
                    <div className="flex items-center justify-between font-mono tabular-nums text-[10px] opacity-65 mb-0.5">
                      <span>Page {b.pageNumber}</span>
                      <span>{b.dwellSeconds.toFixed(1)}s dwell</span>
                    </div>
                    <div className="truncate opacity-90">{b.snippet}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual Gaze Buttons with Dwell Click */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60">Manual Dwell</h3>
              <span className="text-[10px] font-mono opacity-50">Stare 1.5s</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="scroll-up-btn"
                data-gaze-action="up"
                onClick={() => handleManualScroll('up')}
                className={`flex flex-col items-center justify-center py-2 rounded-xl border text-xs font-medium transition-all ${themeClasses.sidebarCard} hover:bg-black/5 focus:outline-none`}
              >
                <ArrowUp className="w-4 h-4 mb-0.5 text-blue-500" />
                <span>Jump Up</span>
              </button>

              <button
                id="scroll-down-btn"
                data-gaze-action="down"
                onClick={() => handleManualScroll('down')}
                className={`flex flex-col items-center justify-center py-2 rounded-xl border text-xs font-medium transition-all ${themeClasses.sidebarCard} hover:bg-black/5 focus:outline-none`}
              >
                <ArrowDown className="w-4 h-4 mb-0.5 text-emerald-500" />
                <span>Jump Down</span>
              </button>
            </div>
          </div>

          {/* Document Management */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60">Document</h3>
              <span className="text-[10px] font-mono opacity-60 uppercase">{activeDocument.type}</span>
            </div>

            {uploadError && (
              <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px]">
                {uploadError}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 text-xs font-semibold transition-all mb-2"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PDF or Text
            </button>

            {activeDocument.id !== DEMO_PAPER.id && (
              <button
                onClick={() => setActiveDocument(DEMO_PAPER)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs opacity-80 hover:opacity-100 hover:bg-black/5 transition-all text-left"
              >
                <span className="truncate flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                  Demo Research Paper
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
              </button>
            )}

            {recentDocs.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] uppercase font-bold opacity-50 block mb-1">Recent Files</span>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {recentDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setActiveDocument(doc)}
                      className={`w-full text-left px-2 py-1 rounded text-xs truncate flex items-center justify-between transition-colors ${
                        activeDocument.id === doc.id 
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-medium' 
                          : 'hover:bg-black/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="truncate">{doc.title}</span>
                      <span className="text-[10px] font-mono opacity-60 shrink-0 ml-1">
                        {doc.type.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-1.5 mt-4">
          <button
            onClick={() => {
              setQuickTuneSamples([]);
              setIsQuickTuning(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Recalibrate Top, Bottom, and Center reading lines in 3 clicks without leaving your page"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Quick 3-Dot Tune
          </button>

          {onRecalibrate && (
            <button
              onClick={onRecalibrate}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 transition-all cursor-pointer"
            >
              <RefreshCcw className="w-3.5 h-3.5 opacity-70" />
              Full Studio Recalibrate
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] opacity-60 pt-1">
            <span>Teleprompter Gaze v2.3</span>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="hover:underline flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" />
              Settings
            </button>
          </div>
        </div>

      </aside>

      {/* Main Reading Canvas */}
      <main className="flex-1 ml-64 min-h-screen px-12 py-16 transition-colors duration-200">
        
        {/* Document Header & Meta */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider font-semibold opacity-60 mb-3">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>{activeDocument.type === 'pdf' ? 'Academic PDF' : activeDocument.type === 'text' ? 'Text Document' : 'Peer-Reviewed Manuscript'}</span>
            <span>·</span>
            <span className="font-mono tabular-nums">{activeDocument.wordCount ? `${activeDocument.wordCount.toLocaleString()} words` : 'Long Form'}</span>
            {activeDocument.totalPages && (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">{activeDocument.totalPages} Pages</span>
              </>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold font-sans tracking-tight mb-4 leading-tight">
            {activeDocument.title}
          </h1>

          {/* Quick Page Jump Controls (if multi-page document) */}
          {activeDocument.pages && activeDocument.pages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-4 pb-2 border-t border-black/10 dark:border-white/10 font-sans text-xs">
              <span className="opacity-60 mr-2 flex items-center gap-1">
                <ListOrdered className="w-3.5 h-3.5" />
                Jump to page:
              </span>
              {activeDocument.pages.map((p) => {
                const isCurrent = currentProgress?.page === p.pageNumber;
                return (
                  <button
                    key={p.pageNumber}
                    onClick={() => handleJumpToPage(p.pageNumber)}
                    className={`px-2.5 py-1 rounded-md transition-all font-mono tabular-nums text-xs ${
                      isCurrent 
                        ? 'bg-blue-600 text-white font-bold shadow-xs' 
                        : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {p.pageNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Document Body with Interactive Gaze-Contingent Paragraphs */}
        <div className="max-w-3xl mx-auto" ref={contentRef}>
          {activeDocument.pages && activeDocument.pages.length > 0 ? (
            <div className="space-y-16">
              {activeDocument.pages.map((page) => {
                const paragraphs = page.text
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean);

                return (
                  <article 
                    key={page.pageNumber} 
                    id={`doc-page-${page.pageNumber}`}
                    className="relative scroll-mt-20"
                  >
                    {/* Subtle Page Divider Banner */}
                    <div className={`flex items-center gap-4 my-8 pb-3 border-b font-sans text-xs uppercase tracking-widest ${themeClasses.pageDivider}`}>
                      <span className="font-semibold">Page {page.pageNumber} of {activeDocument.pages?.length}</span>
                      <div className="flex-1 h-px bg-current opacity-20" />
                      <span className="font-mono tabular-nums text-[10px] opacity-70">
                        {Math.round((page.pageNumber / (activeDocument.pages?.length || 1)) * 100)}% through
                      </span>
                    </div>

                    {/* Interactive Paragraphs with Foveal Spotlight & Marginal Attention Bars */}
                    <div className={`space-y-6 ${getTypographyClasses()}`}>
                      {paragraphs.map((paraText, idx) => {
                        const paraId = `p-${page.pageNumber}-${idx}`;
                        const isFocused = activeParaId === paraId;
                        const dwellSec = paragraphDwell[paraId] || 0;
                        const heatRatio = Math.min(1, dwellSec / maxParaDwell);
                        const isBookmarked = bookmarks.some((b) => b.paraId === paraId);

                        const dimUnfocused =
                          focusMode === 'spotlight' && activeParaId !== null && !isFocused;

                        // Compute subtle thermal background when showHeatmap is enabled
                        const heatmapBg =
                          showHeatmap && dwellSec >= 0.8
                            ? settings.theme === 'dark'
                              ? `rgba(34, 211, 238, ${(heatRatio * 0.11).toFixed(3)})`
                              : `rgba(245, 158, 11, ${(heatRatio * 0.14).toFixed(3)})`
                            : undefined;

                        return (
                          <div
                            key={paraId}
                            data-para-id={paraId}
                            style={{ backgroundColor: heatmapBg }}
                            className={`group relative pl-6 pr-4 py-2 -ml-6 rounded-xl transition-all duration-300 ${
                              dimUnfocused ? 'opacity-45' : 'opacity-100'
                            } ${
                              isFocused && focusMode === 'spotlight'
                                ? 'ring-1 ring-blue-500/25 dark:ring-cyan-400/25 bg-blue-500/[0.03] dark:bg-cyan-400/[0.04]'
                                : ''
                            }`}
                          >
                            {/* Left Marginal Attention Bar + Gaze-Dwell Bookmark Trigger */}
                            <button
                              type="button"
                              data-gaze-action={`bookmark-${paraId}`}
                              onClick={() => toggleBookmarkParagraph(paraId, page.pageNumber, paraText)}
                              title="Click or dwell gaze 1.5s to bookmark this paragraph"
                              className="absolute left-0 top-2 bottom-2 w-4 flex flex-col items-center justify-between py-1 opacity-75 hover:opacity-100 focus:outline-none"
                            >
                              <Bookmark
                                className={`w-3 h-3 transition-transform ${
                                  isBookmarked
                                    ? 'fill-blue-600 text-blue-600 dark:fill-cyan-400 dark:text-cyan-400 scale-110'
                                    : 'opacity-0 group-hover:opacity-60'
                                }`}
                              />
                              <div className="w-1 flex-1 my-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex items-end">
                                <div
                                  className={`w-full transition-all duration-300 ${
                                    isFocused
                                      ? 'bg-blue-600 dark:bg-cyan-400'
                                      : 'bg-amber-500/70 dark:bg-cyan-500/60'
                                  }`}
                                  style={{
                                    height: `${Math.max(isFocused ? 35 : 0, Math.round(heatRatio * 100))}%`,
                                  }}
                                />
                              </div>
                              {dwellSec >= 0.5 && (
                                <span className="text-[9px] font-mono tabular-nums opacity-60 leading-none">
                                  {dwellSec.toFixed(0)}s
                                </span>
                              )}
                            </button>

                            <div className="whitespace-pre-wrap">{paraText}</div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={`whitespace-pre-wrap ${getTypographyClasses()}`}>
              {activeDocument.content}
            </div>
          )}

          {/* End of Document Footer Card */}
          <div className="mt-20 pt-10 border-t border-black/10 dark:border-white/10 text-center font-sans space-y-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">End of Document</h3>
            <p className="text-sm opacity-70 max-w-md mx-auto">
              You have completed reading <span className="font-medium">&ldquo;{activeDocument.title}&rdquo;</span> hands-free.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors shadow-xs"
              >
                Back to Top
              </button>
              <button
                onClick={handleExportReadingReport}
                className="px-4 py-2 rounded-xl border border-black/15 dark:border-white/15 text-xs font-medium hover:bg-black/5 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export Study Report (.md)
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Floating Resume Reading Toast */}
      {resumeNotification?.shown && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 py-3 px-5 rounded-2xl shadow-xl flex items-center gap-4 font-sans text-xs animate-in slide-in-from-bottom duration-300">
          <Bookmark className="w-4 h-4 text-blue-400 dark:text-blue-600 shrink-0" />
          <div>
            <div className="font-semibold font-mono tabular-nums">
              Resumed at {resumeNotification.percentage}% 
              {resumeNotification.page && ` (Page ${resumeNotification.page})`}
            </div>
            <div className="text-[11px] opacity-70 font-sans">Restored from your previous reading session</div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 border-l border-white/20 dark:border-black/20 pl-3">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setResumeNotification(null);
              }}
              className="hover:underline font-semibold text-blue-400 dark:text-blue-600"
            >
              Start Over
            </button>
            <button
              onClick={() => setResumeNotification(null)}
              className="p-1 opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Eye Position Indicator (Pointer feedback) */}
      {settings.showGazeIndicator && (
        <div 
          id="gaze-indicator" 
          className={`fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-[99999] opacity-0 transition-opacity duration-150 ${
            settings.indicatorSize === 'sm' 
              ? 'w-3.5 h-3.5 ring-2 ring-blue-400/40' 
              : settings.indicatorSize === 'lg' 
              ? 'w-6 h-6 ring-4 ring-blue-400/40' 
              : 'w-4.5 h-4.5 ring-4 ring-blue-400/40'
          } ${
            settings.theme === 'dark' 
              ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)] ring-cyan-400/30' 
              : 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.7)] ring-blue-400/40'
          }`}
        />
      )}

      {/* In-Reader Quick 3-Dot Recalibration Overlay */}
      {isQuickTuning && (
        <div className="fixed inset-0 left-64 z-[9992] bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center font-sans text-white select-none animate-in fade-in duration-150">
          <div className="max-w-md text-center px-6 py-4 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl pointer-events-auto">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1">
              In-Page 3-Dot Quick Recalibration ({quickTuneSamples.length}/3)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Stare directly at the <span className="text-white font-semibold">white center pinhole</span> of each target (Top, Bottom, then Center) and click it once to lock your vertical span and reading line.
            </p>
            <button
              type="button"
              onClick={() => setIsQuickTuning(false)}
              className="px-3 py-1 rounded-lg border border-slate-600 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {[
            { id: 'qt-top', label: '1. Top Scroll Line', top: '14%', left: '50%' },
            { id: 'qt-bottom', label: '2. Bottom Scroll Line', top: '86%', left: '50%' },
            { id: 'qt-center', label: '3. Center Reading Line', top: '48%', left: '50%' },
          ].map((pt) => {
            const isDone = quickTuneSamples.some((s) => s.id === pt.id);
            return (
              <button
                key={pt.id}
                type="button"
                disabled={isDone}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const targetX = rect.left + rect.width * 0.5;
                  const targetY = rect.top + rect.height * 0.5;

                  if (window.webgazer?.recordScreenPosition) {
                    window.webgazer.recordScreenPosition(targetX, targetY, 'click');
                    window.webgazer.recordScreenPosition(targetX, targetY, 'click');
                  }

                  const rawX = window._headTrackerState?.latestRawGaze?.x ?? targetX;
                  const rawY = window._headTrackerState?.latestRawGaze?.y ?? targetY;

                  const nextSamples = [
                    ...quickTuneSamples,
                    { id: pt.id, rawX, rawY, targetX, targetY },
                  ];
                  setQuickTuneSamples(nextSamples);

                  if (nextSamples.length >= 3) {
                    applyQuick3PointCalibration(nextSamples);
                    setIsQuickTuning(false);
                  }
                }}
                style={{ top: pt.top, left: pt.left }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 transition-all ${
                  isDone ? 'opacity-40 cursor-default scale-90' : 'cursor-pointer hover:scale-110'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center ring-4 transition-all ${
                    isDone
                      ? 'bg-emerald-600 ring-emerald-400/40'
                      : 'bg-blue-600 ring-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.9)]'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                  )}
                </div>
                <span className="text-[11px] font-mono font-semibold bg-slate-900/95 px-2.5 py-0.5 rounded border border-slate-700 text-slate-200">
                  {pt.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Camera Shutter Flash Overlay on 2-Blink Capture */}
      {shutterFlash && (
        <div className="fixed inset-0 z-[99990] bg-white/80 dark:bg-cyan-200/60 pointer-events-none animate-out fade-out duration-300" />
      )}

      {/* Floating Progressive Blink (1/2) HUD Pill in Top-Right */}
      {blinkStreakCount > 0 && !shutterFlash && (
        <div className="fixed top-5 right-6 z-[9995] bg-slate-900/95 text-cyan-300 border border-cyan-500/40 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 font-sans text-xs font-semibold pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>
            Blink 1/2 — Blink once more to capture screenshot
          </span>
        </div>
      )}

      {/* Floating 2-Blink Captured Screenshot Preview Toast */}
      {latestSnapshotToast && (
        <div className="fixed bottom-6 right-6 z-[9996] w-80 bg-slate-900/95 text-white border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden font-sans animate-in slide-in-from-bottom duration-200">
          <div className="px-3.5 py-2 bg-blue-600/90 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              2-Blink Screenshot Captured!
            </span>
            <button
              type="button"
              onClick={() => setLatestSnapshotToast(null)}
              className="opacity-80 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-2.5">
            <button
              type="button"
              onClick={() => setActiveLightboxSnapshot(latestSnapshotToast)}
              className="w-full h-32 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 block cursor-pointer group relative"
            >
              <img
                src={latestSnapshotToast.dataUrl}
                alt="Captured Gaze Viewport"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-1.5 right-1.5 bg-slate-900/90 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700">
                Click to Enlarge
              </span>
            </button>
            <div className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
              &ldquo;{latestSnapshotToast.focusedText}&rdquo;
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => downloadSnapshotPng(latestSnapshotToast)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save PNG
              </button>
              <button
                type="button"
                onClick={() => setActiveLightboxSnapshot(latestSnapshotToast)}
                className="py-1.5 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Inspect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal for Inspecting Captured Gaze Screenshots */}
      {activeLightboxSnapshot && (
        <div
          onClick={() => setActiveLightboxSnapshot(null)}
          className="fixed inset-0 z-[99995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-6 font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  2-Blink Gaze Viewport Screenshot · Page {activeLightboxSnapshot.pageNumber}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Gaze Coordinates: ({activeLightboxSnapshot.gazeX}px, {activeLightboxSnapshot.gazeY}px) · Captured at {new Date(activeLightboxSnapshot.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSnapshotPng(activeLightboxSnapshot)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLightboxSnapshot(null)}
                  className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950 overflow-auto flex-1 flex items-center justify-center">
              <img
                src={activeLightboxSnapshot.dataUrl}
                alt="Full Resolution Gaze Snapshot"
                className="max-w-full max-h-[68vh] rounded-lg border border-slate-800 shadow-lg"
              />
            </div>
            <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-4">
              <div className="truncate">
                <span className="font-semibold text-cyan-400 mr-1.5">Fixated Passage:</span>
                &ldquo;{activeLightboxSnapshot.focusedText}&rdquo;
              </div>
              {activeLightboxSnapshot.focusedParagraphId && (
                <button
                  type="button"
                  onClick={() => {
                    const pid = activeLightboxSnapshot.focusedParagraphId!;
                    setActiveLightboxSnapshot(null);
                    handleJumpToParagraph(pid);
                  }}
                  className="shrink-0 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium cursor-pointer"
                >
                  Jump to Passage
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings & Ergonomics Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        currentProgress={currentProgress}
        onResetProgress={handleResetProgress}
        onRecalibrate={onRecalibrate}
      />

    </div>
  );
}
