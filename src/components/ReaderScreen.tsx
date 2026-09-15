import React, { useEffect, useRef, useState } from 'react';
import { getReadingPosition, saveReadingPosition } from '../lib/supabase';
import { FileText, Save, CheckCircle2, Upload, ArrowUp, ArrowDown, Eye, EyeOff, RefreshCcw } from 'lucide-react';

interface Props {
  documentId: string;
  onRecalibrate?: () => void;
}

export function ReaderScreen({ documentId, onRecalibrate }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('Eye-Tracking Research Document');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial position
  useEffect(() => {
    async function loadPosition() {
      const position = await getReadingPosition(documentId);
      if (position && position > 0) {
        if (window.confirm('You have a saved reading position. Would you like to resume?')) {
          window.scrollTo({ top: position, behavior: 'smooth' });
        }
      }
    }
    loadPosition();
  }, [documentId]);

  // Save position on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveReadingPosition(documentId, window.scrollY);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [documentId]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    await saveReadingPosition(documentId, window.scrollY);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const toggleAutoScroll = () => {
    const nextState = !isAutoScrollPaused;
    setIsAutoScrollPaused(nextState);
    if (window._gazeState) {
      window._gazeState.isPaused = nextState;
    }
  };

  const handleManualScroll = (direction: 'up' | 'down') => {
    window.scrollBy({ top: direction === 'down' ? 400 : -400, behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentTitle(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setDocumentContent(event.target.result as string);
        window.scrollTo(0, 0); // Reset scroll for new document
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-serif leading-relaxed flex">
      {/* Sidebar Controls */}
      <div className="w-64 fixed top-0 left-0 bottom-0 bg-stone-100 border-r border-stone-200 p-6 flex flex-col gap-8 z-50 font-sans shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-6 text-stone-800">
            <Eye className="w-6 h-6 text-blue-600" />
            <h2 className="font-bold text-lg">Gaze Controls</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={toggleAutoScroll}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                isAutoScrollPaused 
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span className="font-medium text-sm">
                {isAutoScrollPaused ? 'Auto-scroll Paused' : 'Auto-scroll Active'}
              </span>
              {isAutoScrollPaused ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {onRecalibrate && (
              <button
                onClick={onRecalibrate}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all text-sm font-medium"
              >
                <RefreshCcw className="w-4 h-4" />
                Recalibrate Tracker
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-stone-200 w-full" />

        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Manual Scrolling</h3>
          <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded text-xs text-blue-800 space-y-2">
            <p><strong>Option 1 (Continuous):</strong> Look at the bottom 30% of the screen to scroll down like a teleprompter. Look at the top 25% to scroll up. (Speed increases the further you look).</p>
            <p><strong>Option 2 (Manual Jump):</strong> Look at a button below continuously for 1.5 seconds.</p>
          </div>
          <div className="flex gap-2">
            <button
              id="scroll-up-btn"
              data-gaze-action="up"
              onClick={() => handleManualScroll('up')}
              className="flex-1 flex flex-col items-center justify-center py-3 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ArrowUp className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Up</span>
            </button>
            <button
              id="scroll-down-btn"
              data-gaze-action="down"
              onClick={() => handleManualScroll('down')}
              className="flex-1 flex flex-col items-center justify-center py-3 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ArrowDown className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Down</span>
            </button>
          </div>
        </div>

        <div className="h-px bg-stone-200 w-full" />

        <div>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">Document</h3>
          <input
            type="file"
            accept=".txt,.md"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all text-sm font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Upload className="w-4 h-4" />
            Import Text File
          </button>
          <button 
            onClick={handleManualSave}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {saveStatus === 'saved' ? (
              <><CheckCircle2 className="w-4 h-4 text-green-500" /> Saved</>
            ) : (
              <><Save className="w-4 h-4" /> Save Position</>
            )}
          </button>
        </div>
      </div>

      {/* Main Document Content Area */}
      <div className="flex-1 ml-64 min-h-screen">
        <div className="max-w-3xl mx-auto pt-16 pb-32 px-12" ref={contentRef}>
          <div className="flex items-center gap-3 mb-10 pb-6 border-b border-stone-200">
            <FileText className="w-6 h-6 text-stone-400" />
            <h1 className="text-3xl font-bold font-sans text-stone-800">{documentTitle}</h1>
          </div>
          
          {documentContent ? (
            <div className="text-lg text-stone-800 whitespace-pre-wrap leading-loose">
              {documentContent}
            </div>
          ) : (
            <>
              <p className="text-xl text-stone-600 mb-12">
                An exploration into human-computer interaction, hands-free navigation, and reading optimization using standard webcams.
                <br /><br />
                <em>You can now import your own text files (.txt or .md) using the sidebar!</em>
              </p>
              
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="mb-8">
                  <h2 className="text-2xl font-bold mb-4 font-sans text-stone-800">Section {i + 1}: Methodology and Implications</h2>
                  <p className="mb-4 text-lg">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                  </p>
                  <p className="mb-4 text-lg">
                    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.
                    Eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      
      {/* Eye Position Indicator (Optional subtle visual feedback) */}
      <div id="gaze-indicator" className="fixed w-3 h-3 rounded-full bg-blue-500/50 pointer-events-none z-[9999] mix-blend-multiply opacity-0 transition-all duration-300"></div>
    </div>
  );
}
