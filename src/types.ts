export type AppState = 'IDLE' | 'CALIBRATING' | 'READING';

export interface Point {
  x: number;
  y: number;
}

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'e-ink';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderFontSize = 'sm' | 'base' | 'lg' | 'xl';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: ReaderFontSize;
  scrollSpeed: number; // 0.5 to 2.5
  bottomThresholdPct: number; // 0.20 to 0.45
  topThresholdPct: number; // 0.15 to 0.35
  smoothingFactor: number; // 0.15 to 0.50
  showGazeIndicator: boolean;
  indicatorSize: 'sm' | 'md' | 'lg';
  showZoneGuides: boolean;
  scrollMode: 'step' | 'continuous';
  trackingSource: 'hybrid' | 'head' | 'eye';
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface DocumentData {
  id: string;
  title: string;
  type: 'demo' | 'text' | 'pdf';
  content?: string;
  pages?: ExtractedPdfPage[];
  totalPages?: number;
  wordCount?: number;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: number;
}

export interface ReadingProgress {
  documentId: string;
  scrollY: number;
  percentage: number;
  page?: number;
  totalPages?: number;
  lastReadAt: number;
}
