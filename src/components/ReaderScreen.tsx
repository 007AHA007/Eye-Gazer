import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Clock, 
  FileUp, 
  ChevronRight,
  ListOrdered,
  FileCode,
  Sparkles,
  Info,
  Crosshair
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
import { recenterCurrentPosture } from '../lib/headPoseTracker';

interface Props {
  documentId: string;
  onRecalibrate?: () => void;
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
      text: `2. Machine Vision & Pupil Tracking Pipeline\n\nOur client-side pipeline leverages WebGazer.js, utilizing a multi-stage convolutional landmark estimator. Rather than executing heavy neural inference on external cloud servers, the video frame (typically 640x480 at 30 fps) is processed entirely in the browser using WebGL and HTML5 Canvas.\n\nTo compensate for webcam noise, optical aberration, and ambient illumination variance, raw gaze coordinates (X, Y) are piped through a dynamic Exponential Moving Average (EMA) filter with velocity-adaptive smoothing:\n\n    X_smoothed(t) = α * X_raw(t) + (1 - α) * X_smoothed(t-1)\n\nwhere α (0.15 < α < 0.50) scales dynamically: when the reader executes an expansive saccade between the sidebar and the main document body, α increases to maximize responsiveness. During stationary reading fixations, α decays, eliminating ocular micro-tremor (nystagmus) and preventing erratic viewport movement.`
    },
    {
      pageNumber: 4,
      text: `3. The Continuous Teleprompter Interaction Model\n\nPrior gaze-reading implementations have frequently relied on binary "chunk" scrolling: once the gaze crosses a predefined bottom margin, the viewport executes an instantaneous jump of 400 pixels. Empirical testing revealed that chunk scrolling causes severe visual disorientation; readers lose their anchor line and are forced to spend several seconds scanning to locate where they left off.\n\nTo overcome this limitation, our system implements a continuous, velocity-proportional teleprompter scroll. We partition the vertical viewport into three continuous zones:\n\n• Top Scroll-Up Zone (0% to 25% of viewport height): When a reader looks back to verify an earlier passage or equation, the document pans smoothly upward.\n• Neutral Reading Zone (25% to 70% of viewport height): Zero scrolling occurs. Readers can freely scan lines horizontally without activating any mechanical response.\n• Bottom Scroll-Down Zone (70% to 100% of viewport height): As the reader reaches the lower lines of the visible page, the canvas glides downward with speed proportional to the gaze depth:\n\n    Speed = BaseSpeed + (Depth * MaxVelocityMultiplier)`
    },
    {
      pageNumber: 5,
      text: `4. Experimental Methodology & Participant Feedback\n\nWe conducted a controlled study across 24 participants (14 undergraduate researchers, 10 graduate students) tasked with reading two 5,000-word peer-reviewed neuroscience papers. Each subject completed one paper using standard trackpad scrolling and one paper using the continuous gaze-reading system.\n\nKey Metrics Measured:\n• Reading Speed (Words Per Minute): Average 284 WPM (Gaze Reader) vs. 268 WPM (Standard).\n• Self-Reported Eye Fatigue: Rated 2.4/5 on a standard Likert scale.\n• Focus Retention: 87% of participants reported feeling 'significantly more immersed' due to the elimination of hand gestures while reading.\n\nParticipants particularly praised the subtle green/blue visual feedback from the gaze indicator, noting that it provided gentle subconscious reassurance that the system was tracking accurately.`
    },
    {
      pageNumber: 6,
      text: `5. Future Trajectories & Accessibility Implications\n\nThe implications of robust, zero-cost gaze navigation extend far beyond academic productivity. Individuals experiencing severe motor impairments—such as Amyotrophic Lateral Sclerosis (ALS), high-level spinal cord injuries, or cerebral palsy—often face steep economic barriers when accessing specialized assistive eye-tracking hardware.\n\nBy optimizing consumer webcams with intelligent filtering and ergonomic zone controls, we democratize hands-free educational and informational access. Ongoing work explores the integration of dwell-based contextual glossaries, gaze-guided section bookmarks, and local reading comprehension heatmaps.\n\nReferences:\n[1] Papoutsaki, A., et al. (2016). WebGazer: Scalable Webcam EyeTracking Using User Interactions. IJCAI.\n[2] Rayner, K. (1998). Eye movements in reading and information processing: 20 years of research. Psychological Bulletin.\n[3] Holmqvist, K., et al. (2011). Eye Tracking: A comprehensive guide to methods and measures. Oxford University Press.`
    }
  ]
};

export function ReaderScreen({ documentId, onRecalibrate }: Props) {
  // Settings & Theme State
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const scrollTimeoutRef = useRef<number | null>(null);

  // Sync settings to window global
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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
      // Smoothly restore
      window.scrollTo({ top: saved.scrollY, behavior: 'smooth' });
      setResumeNotification({
        shown: true,
        percentage: saved.percentage,
        page: saved.page,
      });

      // Auto-hide resume notification after 6 seconds
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
        // Text / Markdown
        setLoadingMessage(`Reading ${fileName}...`);
        const text = await file.text();
        // Break into pages for natural navigation (approx 500 words per page)
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
      alert('Could not read this file. Please make sure it is a valid PDF or plain text document.');
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
          badge: 'bg-[#DFCEAA]/60 text-[#433422]',
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
          badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
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
          badge: 'bg-black text-white',
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
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
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

      {/* Visual Zone Guides (If enabled in settings) */}
      {settings.showZoneGuides && (
        <>
          {/* Top Trigger Zone Guide */}
          <div 
            className="fixed left-64 right-0 pointer-events-none z-30 border-b-2 border-dashed border-blue-400/50 flex justify-end px-6 transition-all"
            style={{ top: `${settings.topThresholdPct * 100}%` }}
          >
            <span className="text-[11px] font-mono font-semibold bg-blue-500/80 text-white px-2 py-0.5 rounded-t -translate-y-full shadow-xs">
              ↑ Look above this line to scroll UP
            </span>
          </div>

          {/* Bottom Trigger Zone Guide */}
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
      <aside className={`w-64 fixed top-0 left-0 bottom-0 border-r p-5 flex flex-col justify-between z-50 font-sans shadow-xs transition-colors duration-200 overflow-y-auto ${themeClasses.sidebar}`}>
        
        <div className="space-y-5">
          {/* Header Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm tracking-tight leading-tight">Gaze Reader</h2>
                <div className="flex items-center gap-1.5 text-[11px] opacity-70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Tracking Active</span>
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
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">
              {isAutoScrollPaused ? 'Resume' : 'Pause'}
            </span>
          </button>

          {/* Reading Progress Indicator */}
          <div className={`p-3 rounded-xl border space-y-2 ${themeClasses.sidebarCard}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5 opacity-80">
                <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                Reading Progress
              </span>
              <span className="font-bold font-mono">
                {currentProgress ? `${currentProgress.percentage}%` : '0%'}
              </span>
            </div>

            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-cyan-400 h-full transition-all duration-300"
                style={{ width: `${currentProgress?.percentage || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] opacity-70">
              <span>
                {activeDocument.pages && activeDocument.pages.length > 0 
                  ? `Page ${currentProgress?.page || 1} of ${activeDocument.pages.length}`
                  : 'Continuous'}
              </span>
              {currentProgress && currentProgress.percentage > 0 && (
                <button
                  onClick={handleResetProgress}
                  className="hover:underline flex items-center gap-1 hover:text-blue-500"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Head Posture & Motion Compensator Sentinel */}
          <HeadPostureHUD theme={settings.theme} />

          {/* Manual Gaze Buttons with Dwell Click */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60">Manual Controls</h3>
              <span className="text-[10px] opacity-50">Stare 1.5s</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="scroll-up-btn"
                data-gaze-action="up"
                onClick={() => handleManualScroll('up')}
                className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs font-medium transition-all ${themeClasses.sidebarCard} hover:bg-black/5 focus:outline-none`}
              >
                <ArrowUp className="w-4 h-4 mb-0.5 text-blue-500" />
                <span>Jump Up</span>
              </button>

              <button
                id="scroll-down-btn"
                data-gaze-action="down"
                onClick={() => handleManualScroll('down')}
                className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs font-medium transition-all ${themeClasses.sidebarCard} hover:bg-black/5 focus:outline-none`}
              >
                <ArrowDown className="w-4 h-4 mb-0.5 text-emerald-500" />
                <span>Jump Down</span>
              </button>
            </div>
          </div>

          {/* Document Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60">Document</h3>
              {activeDocument.type === 'pdf' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold">
                  PDF
                </span>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 text-xs font-semibold transition-all mb-2"
            >
              <Upload className="w-4 h-4" />
              Upload PDF or Text File
            </button>

            {/* Switch to Sample Paper if custom doc active */}
            {activeDocument.id !== DEMO_PAPER.id && (
              <button
                onClick={() => setActiveDocument(DEMO_PAPER)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs opacity-80 hover:opacity-100 hover:bg-black/5 transition-all text-left"
              >
                <span className="truncate flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                  Read Demo Research Paper
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
              </button>
            )}

            {/* Recent Uploads quick switch */}
            {recentDocs.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold opacity-50 block mb-1">Recent Files</span>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {recentDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setActiveDocument(doc)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs truncate flex items-center justify-between transition-colors ${
                        activeDocument.id === doc.id 
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-medium' 
                          : 'hover:bg-black/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="truncate">{doc.title}</span>
                      <span className="text-[10px] opacity-60 shrink-0 ml-1">
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
        <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
          {onRecalibrate && (
            <button
              onClick={onRecalibrate}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 transition-all"
            >
              <RefreshCcw className="w-3.5 h-3.5 opacity-70" />
              Recalibrate Camera
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] opacity-60">
            <span>Teleprompter Gaze v2.1</span>
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
      <main className="flex-1 ml-64 min-h-screen px-10 py-16 transition-colors duration-200">
        
        {/* Document Header & Meta */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider font-semibold opacity-60 mb-3">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>{activeDocument.type === 'pdf' ? 'Academic PDF' : activeDocument.type === 'text' ? 'Text Document' : 'Peer-Reviewed Manuscript'}</span>
            <span>•</span>
            <span>{activeDocument.wordCount ? `${activeDocument.wordCount.toLocaleString()} words` : 'Long Form'}</span>
            {activeDocument.totalPages && (
              <>
                <span>•</span>
                <span>{activeDocument.totalPages} Pages</span>
              </>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold font-sans tracking-tight mb-4 leading-tight">
            {activeDocument.title}
          </h1>

          {/* Quick Page Jump Pills (if multi-page document) */}
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
                    className={`px-2.5 py-1 rounded-md transition-all font-mono text-xs ${
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

        {/* Document Body */}
        <div className="max-w-3xl mx-auto" ref={contentRef}>
          {activeDocument.pages && activeDocument.pages.length > 0 ? (
            <div className="space-y-16">
              {activeDocument.pages.map((page) => (
                <article 
                  key={page.pageNumber} 
                  id={`doc-page-${page.pageNumber}`}
                  className="relative scroll-mt-20"
                >
                  {/* Subtle Page Divider Banner */}
                  <div className={`flex items-center gap-4 my-8 pb-3 border-b font-sans text-xs uppercase tracking-widest ${themeClasses.pageDivider}`}>
                    <span className="font-semibold">Page {page.pageNumber} of {activeDocument.pages?.length}</span>
                    <div className="flex-1 h-px bg-current opacity-20" />
                    <span className="font-mono text-[10px] opacity-70">
                      {Math.round((page.pageNumber / (activeDocument.pages?.length || 1)) * 100)}% through
                    </span>
                  </div>

                  {/* Page Text */}
                  <div className={`whitespace-pre-wrap ${getTypographyClasses()}`}>
                    {page.text}
                  </div>
                </article>
              ))}
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
              You have completed reading <span className="font-medium">"{activeDocument.title}"</span> hands-free.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors shadow-xs"
              >
                Back to Top
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl border border-black/15 dark:border-white/15 text-xs font-medium hover:bg-black/5 transition-colors"
              >
                Upload Another Document
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Floating Resume Reading Pill Toast */}
      {resumeNotification?.shown && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 py-3 px-5 rounded-2xl shadow-xl flex items-center gap-4 font-sans text-xs animate-in slide-in-from-bottom duration-300">
          <Bookmark className="w-4 h-4 text-blue-400 dark:text-blue-600 shrink-0" />
          <div>
            <div className="font-semibold">
              Resumed at {resumeNotification.percentage}% 
              {resumeNotification.page && ` (Page ${resumeNotification.page})`}
            </div>
            <div className="text-[11px] opacity-70">Restored from your previous reading session</div>
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

      {/* Floating Quick Recenter Button */}
      <button
        onClick={(e) => {
          // Prevent WebGazer's global click listener from recording this button click as training data
          e.stopPropagation();
          // Pass the button's screen coordinates because user is looking AT the button when clicking it!
          recenterCurrentPosture({
            anchorPoint: { x: e.clientX, y: e.clientY }
          });
          const btn = document.getElementById('floating-recenter-btn');
          if (btn) {
            btn.classList.add('bg-emerald-600', 'text-white');
            setTimeout(() => btn.classList.remove('bg-emerald-600', 'text-white'), 800);
          }
        }}
        id="floating-recenter-btn"
        title="Instantly re-anchor gaze tracking to your current head posture (Shortcut: R)"
        className={`fixed ${resumeNotification?.shown ? 'bottom-20' : 'bottom-6'} right-6 z-40 bg-stone-900/90 hover:bg-stone-900 text-white dark:bg-zinc-800/90 dark:hover:bg-zinc-800 py-2 px-3.5 rounded-xl shadow-lg border border-white/10 flex items-center gap-2 font-sans text-xs transition-all backdrop-blur-xs cursor-pointer hover:shadow-xl`}
      >
        <Crosshair className="w-3.5 h-3.5 text-blue-400 dark:text-cyan-400" />
        <span className="font-medium">Recenter</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px] font-bold">R</kbd>
      </button>

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
