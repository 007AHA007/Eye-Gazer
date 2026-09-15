import React, { useEffect, useState } from 'react';
import { AppState } from '../types';

interface Props {
  onCalibrationComplete: () => void;
}

export function CalibrationScreen({ onCalibrationComplete }: Props) {
  const [clickCounts, setClickCounts] = useState<Record<number, number>>({});
  
  // 9 points across the main calibration area
  const points = [
    { id: 1, top: '15%', left: '15%' },
    { id: 2, top: '15%', left: '50%' },
    { id: 3, top: '15%', left: '85%' },
    { id: 4, top: '50%', left: '15%' },
    { id: 5, top: '50%', left: '50%' },
    { id: 6, top: '50%', left: '85%' },
    { id: 7, top: '85%', left: '15%' },
    { id: 8, top: '85%', left: '50%' },
    { id: 9, top: '85%', left: '85%' },
  ];

  const handlePointClick = (id: number) => {
    setClickCounts(prev => {
      const newCounts = { ...prev, [id]: (prev[id] || 0) + 1 };
      return newCounts;
    });
  };

  useEffect(() => {
    // Check if all 9 points have been clicked at least 5 times
    const allDone = points.every(p => (clickCounts[p.id] || 0) >= 5);
    
    // Only call complete if we actually have clicks (not on initial mount)
    if (Object.keys(clickCounts).length > 0 && allDone) {
      onCalibrationComplete();
    }
  }, [clickCounts, onCalibrationComplete]);

  return (
    <div className="fixed inset-0 flex bg-slate-900 text-white">
      <style>{`
        /* Force WebGazer video container to fit the sidebar */
        #webgazerVideoContainer {
          top: 0 !important;
          left: 0 !important;
          width: 320px !important;
          height: 240px !important;
          border-bottom: 1px solid #334155;
          background-color: #000;
        }
      `}</style>

      {/* Sidebar for Camera Feed */}
      <div className="w-[320px] h-full bg-slate-800 border-r border-slate-700 shrink-0 flex flex-col">
        {/* Placeholder space for the WebGazer video feed (320x240) */}
        <div className="h-[240px] w-full shrink-0" />
        
        <div className="p-6 flex-1">
          <h2 className="text-xl font-bold mb-2 text-slate-100">Camera Feed</h2>
          <p className="text-sm text-slate-400 mb-6">
            Make sure your face is well-lit and fits inside the green tracking box.
          </p>
          
          <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/50">
            <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">Instructions</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">1</span>
                Keep your head completely still.
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">2</span>
                Follow the cursor with your eyes, not your head.
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">3</span>
                Click each red dot 5 times while looking exactly at it.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Calibration Area */}
      <div className="flex-1 relative">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center pointer-events-none z-50">
          <h2 className="text-2xl font-bold mb-2">Calibration Required</h2>
          <p className="text-slate-300">
            Look at the dot and click it 5 times.
          </p>
        </div>
        
        {points.map((p) => {
          const count = clickCounts[p.id] || 0;
          const isComplete = count >= 5;
          
          return (
            <button
              key={p.id}
              onClick={() => handlePointClick(p.id)}
              disabled={isComplete}
              className={`absolute w-8 h-8 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 z-[50] ${
                isComplete ? 'bg-green-500 opacity-50 cursor-not-allowed' : 'bg-red-500 hover:bg-red-400 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.7)]'
              }`}
              style={{ top: p.top, left: p.left }}
            >
              {count > 0 && !isComplete && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
