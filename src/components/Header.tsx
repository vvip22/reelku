import React from 'react';
import { Film, Download } from 'lucide-react';

interface HeaderProps {
  onExportClick: () => void;
  activeTab: string;
  setActiveTab: (tab: 'quote' | 'media' | 'voice' | 'music') => void;
  isGeneratingVoice?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onExportClick,
  activeTab,
  setActiveTab,
  isGeneratingVoice = false,
}) => {
  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white">
          <Film className="w-4 h-4" />
        </div>
        <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap font-outfit">
          ReelQuote Studio
        </span>
      </div>

      {/* Desktop 4 Tabs */}
      <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('quote')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'quote'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Quotes
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'media'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          2. Foto &amp; Video
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'voice'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          3. Suara &amp; Font
        </button>
        <button
          onClick={() => setActiveTab('music')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'music'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          4. Musik
        </button>
      </nav>

      {/* Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          onClick={onExportClick}
          disabled={isGeneratingVoice}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 1080p MP4</span>
        </button>
      </div>
    </header>
  );
};
