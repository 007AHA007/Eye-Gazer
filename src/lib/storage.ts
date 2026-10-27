import { ReaderSettings, ReadingProgress, DocumentData } from '../types';

const SETTINGS_KEY = 'gaze_reader_settings_v1';
const PROGRESS_KEY_PREFIX = 'gaze_reader_progress_';
const RECENT_DOCS_KEY = 'gaze_reader_recent_docs_v1';

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 'base',
  scrollSpeed: 1.0, // Calm, steady pacing
  bottomThresholdPct: 0.22, // Bottom 22% (bottom margin)
  topThresholdPct: 0.18,    // Top 18% (top margin)
  smoothingFactor: 0.45,    // Fast, zero-drag tracking
  showGazeIndicator: true,
  indicatorSize: 'md',
  showZoneGuides: true,
  scrollMode: 'step',
  trackingSource: 'hybrid',
};

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Failed to load settings from localStorage, using defaults:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Also sync to global gaze settings if running
    if (typeof window !== 'undefined') {
      window._gazeSettings = {
        scrollSpeed: settings.scrollSpeed,
        bottomThresholdPct: settings.bottomThresholdPct,
        topThresholdPct: settings.topThresholdPct,
        smoothingFactor: settings.smoothingFactor,
        scrollMode: settings.scrollMode,
        trackingSource: settings.trackingSource || 'hybrid',
        isPaused: window._gazeSettings?.isPaused ?? false,
      };
    }
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

export function getDocumentProgress(documentId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${documentId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed to read progress for ${documentId}:`, err);
    return null;
  }
}

export function saveDocumentProgress(
  documentId: string,
  scrollY: number,
  percentage: number,
  page?: number,
  totalPages?: number
): void {
  try {
    const progress: ReadingProgress = {
      documentId,
      scrollY,
      percentage: Math.min(100, Math.max(0, Math.round(percentage))),
      page,
      totalPages,
      lastReadAt: Date.now(),
    };
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${documentId}`, JSON.stringify(progress));
  } catch (err) {
    console.warn(`Failed to save progress for ${documentId}:`, err);
  }
}

export function clearDocumentProgress(documentId: string): void {
  try {
    localStorage.removeItem(`${PROGRESS_KEY_PREFIX}${documentId}`);
  } catch (err) {
    console.warn(`Failed to clear progress for ${documentId}:`, err);
  }
}

export function getRecentDocuments(): DocumentData[] {
  try {
    const raw = localStorage.getItem(RECENT_DOCS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function saveRecentDocument(doc: DocumentData): void {
  try {
    const recents = getRecentDocuments().filter((d) => d.id !== doc.id);
    // Store metadata and content if not excessively huge
    const docToStore: DocumentData = {
      ...doc,
      // If content is very large (> 2MB), don't store raw content in localStorage to avoid quota issues
      content: doc.content && doc.content.length > 1_500_000 ? doc.content.slice(0, 1_500_000) : doc.content,
    };
    const updated = [docToStore, ...recents].slice(0, 5);
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save recent document to localStorage:', err);
  }
}
