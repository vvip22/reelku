import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  BookOpen,
  Check,
  Quote,
  Globe,
} from 'lucide-react';
import { QuoteData } from '../types';

interface QuoteEditorProps {
  quote: QuoteData;
  onChange: (updated: QuoteData) => void;
  onGenerateVoice: (text: string) => void;
  isGeneratingVoice: boolean;
}

const PRESET_QUOTES: QuoteData[] = [
  {
    text: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
    translationId: 'Kamu berkuasa atas pikiranmu, bukan kejadian di luar. Sadari ini, dan kamu akan menemukan kekuatan sejati.',
    category: 'Stoicism',
  },
  {
    text: 'Do not wait for extraordinary opportunities. Seize common occasions and make them great.',
    author: 'Orison Swett Marden',
    translationId: 'Jangan menunggu kesempatan luar biasa. Raih kesempatan biasa dan jadikan itu luar biasa.',
    category: 'Motivation',
  },
  {
    text: 'The secret of change is to focus all of your energy not on fighting the old, but on building the new.',
    author: 'Socrates',
    translationId: 'Rahasia perubahan adalah memusatkan seluruh energimu bukan untuk melawan yang lama, tetapi membangun yang baru.',
    category: 'Wisdom',
  },
  {
    text: 'Your time is limited, so do not waste it living someone else life.',
    author: 'Steve Jobs',
    translationId: 'Waktumu terbatas, jadi jangan sia-siakan untuk menjalani hidup orang lain.',
    category: 'Success',
  },
  {
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
    translationId: 'Disiplin adalah memilih antara apa yang kamu inginkan sekarang dan apa yang paling kamu impikan nanti.',
    category: 'Discipline',
  },
  {
    text: 'Peace comes from within. Do not seek it without.',
    author: 'Buddha',
    translationId: 'Kedamaian datang dari dalam diri. Jangan mencarinya di luar.',
    category: 'Peace',
  },
];

const CATEGORIES = [
  'Motivation',
  'Stoicism',
  'Success',
  'Discipline',
  'Wisdom',
  'Peace',
];

export const QuoteEditor: React.FC<QuoteEditorProps> = ({
  quote,
  onChange,
  onGenerateVoice,
  isGeneratingVoice,
}) => {
  const [libraryTab, setLibraryTab] = useState<'presets' | 'ai'>('presets');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Motivation');
  const [aiGeneratedQuotes, setAiGeneratedQuotes] = useState<QuoteData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateAiQuotes = async () => {
    setIsAiLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/quotes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          count: 4,
          tone: 'Viral, deep, inspirational, concise',
        }),
      });

      const data = await res.json();
      if (data.success && data.quotes && data.quotes.length > 0) {
        setAiGeneratedQuotes(data.quotes);
      } else {
        throw new Error(data.error || 'Failed to generate quotes');
      }
    } catch {
      setErrorMsg('Gagal menghasilkan quotes AI. Silakan coba lagi atau pilih dari koleksi.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSelectQuote = (selected: QuoteData) => {
    onChange(selected);
    onGenerateVoice(selected.text);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Quote Input Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <Quote className="w-4 h-4 text-amber-400" />
            <span>Teks Quotes</span>
          </label>
          <span className="text-xs text-slate-400 font-mono">
            {quote.text.trim().split(/\s+/).filter(Boolean).length} kata
          </span>
        </div>

        <textarea
          rows={3}
          value={quote.text}
          onChange={(e) => onChange({ ...quote, text: e.target.value })}
          placeholder="Ketik atau paste teks quotes Anda di sini..."
          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/80 text-sm leading-relaxed resize-none"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              Author / Tokoh / Akun
            </label>
            <input
              type="text"
              value={quote.author}
              onChange={(e) => onChange({ ...quote, author: e.target.value })}
              placeholder="e.g. Marcus Aurelius"
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Terjemahan (Opsional)</span>
              </label>
              {quote.translationId && (
                <button
                  type="button"
                  onClick={() => onChange({ ...quote, translationId: '' })}
                  className="text-[10px] text-slate-500 hover:text-amber-400 cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>
            <input
              type="text"
              value={quote.translationId}
              onChange={(e) => onChange({ ...quote, translationId: e.target.value })}
              placeholder="Terjemahan Indonesia..."
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => onGenerateVoice(quote.text)}
            disabled={isGeneratingVoice || !quote.text.trim()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingVoice ? 'animate-spin' : ''}`} />
            <span>{isGeneratingVoice ? 'Menyesuaikan Suara...' : 'Update Suara Narasi'}</span>
          </button>
        </div>
      </div>

      {/* Compact Quote Library (Preset vs AI Generator) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setLibraryTab('presets')}
            className={`py-1.5 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              libraryTab === 'presets'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Koleksi Populer</span>
          </button>
          <button
            type="button"
            onClick={() => setLibraryTab('ai')}
            className={`py-1.5 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              libraryTab === 'ai'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generator AI</span>
          </button>
        </div>

        {libraryTab === 'presets' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_QUOTES.map((preset, idx) => {
              const isSelected = quote.text === preset.text;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectQuote(preset)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-colors flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400/10 border-amber-400/80 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs line-clamp-2 leading-relaxed">"{preset.text}"</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="font-medium">— {preset.author}</span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-amber-400 text-[10px]">
                        <Check className="w-3 h-3" /> Aktif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerateAiQuotes}
              disabled={isAiLoading}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? 'Menyusun Quotes...' : 'Buat Quotes Inggris Baru (AI)'}</span>
            </button>

            {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

            {aiGeneratedQuotes.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {aiGeneratedQuotes.map((item, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSelectQuote(item)}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-400/60 text-left cursor-pointer flex flex-col gap-1"
                  >
                    <p className="text-xs font-medium text-slate-200">"{item.text}"</p>
                    <span className="text-[11px] text-slate-400 italic">— {item.author}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
