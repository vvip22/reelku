import React from 'react';
import { Type, Palette, AlignCenter, Sparkles, Layers, Sliders, LayoutTemplate, Box } from 'lucide-react';
import { SubtitleSettings, SubtitleDisplayMode, SubtitleCardTheme } from '../types';

interface SubtitleStyleEditorProps {
  subtitles: SubtitleSettings;
  onChange: (updated: SubtitleSettings) => void;
}

const FONTS: { id: SubtitleSettings['fontFamily']; name: string; styleClass: string; category: string }[] = [
  { id: 'Playfair Display', name: 'Playfair Display', styleClass: 'font-playfair', category: 'Luxury Serif' },
  { id: 'Outfit', name: 'Outfit', styleClass: 'font-outfit', category: 'Modern Geometric' },
  { id: 'Cinzel', name: 'Cinzel', styleClass: 'font-cinzel', category: 'Cinematic Stoic' },
  { id: 'Bebas Neue', name: 'Bebas Neue', styleClass: 'font-bebas', category: 'Punchy Viral Reel' },
  { id: 'Montserrat', name: 'Montserrat', styleClass: 'font-montserrat', category: 'High Fashion Clean' },
  { id: 'Caveat', name: 'Caveat', styleClass: 'font-caveat', category: 'Handwritten Aesthetic' },
  { id: 'Oswald', name: 'Oswald', styleClass: 'font-oswald', category: 'Condensed Impact' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', styleClass: 'font-jakarta', category: 'Clean Neo-Grotesque' },
];

const DISPLAY_MODES: {
  id: SubtitleDisplayMode;
  name: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: 'dynamic-phrase',
    name: 'Viral Dynamic Phrases',
    badge: 'Rekomendasi Reels',
    desc: 'Teks muncul bergantian per 2-4 kata selaras dengan suara narasi wanita. Sangat fokus, tidak menumpuk, dan tidak menutupi layar.',
  },
  {
    id: 'quote-card',
    name: 'Kartu Quote Sinematik',
    badge: 'Luxury Editorial',
    desc: 'Seluruh quote ditampilkan rapi di dalam kartu kaca mewah dengan tanda kutip emas dan font auto-fit (tidak akan terpotong tepi layar).',
  },
  {
    id: 'word-pop',
    name: 'Word-by-Word Pop',
    badge: 'Alex Hormozi Style',
    desc: 'Kata per kata muncul di tengah dengan huruf tebal berenergi tinggi untuk engagement maksimal.',
  },
];

const CARD_THEMES: { id: SubtitleCardTheme; name: string; desc: string }[] = [
  { id: 'glass', name: 'Frosted Glass', desc: 'Kaca gelap transparan elegan dengan garis tepi tipis' },
  { id: 'none', name: 'Clean Floating', desc: 'Teks melayang tanpa kotak dengan bayangan sinematik' },
  { id: 'solid-dark', name: 'Solid Contrast', desc: 'Kotak hitam tegas berbingkai emas minimalis' },
  { id: 'gradient-pill', name: 'Gradient Pill', desc: 'Kapsul gelap melengkung modern' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Amber Gold', hex: '#fbbf24' },
  { name: 'Electric Cyan', hex: '#38bdf8' },
  { name: 'Neon Green', hex: '#4ade80' },
  { name: 'Rose Red', hex: '#fb7185' },
  { name: 'Pure White', hex: '#ffffff' },
];

export const SubtitleStyleEditor: React.FC<SubtitleStyleEditorProps> = ({
  subtitles,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Subtitle Display Mode (The key fix for user request!) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-amber-400" />
              <span>Model Tampilan Subtitle (Subtitle Layout Mode)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih cara teks quotes muncul di layar video Facebook Reel
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {DISPLAY_MODES.map((mode) => {
            const isSelected = (subtitles.displayMode || 'dynamic-phrase') === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => onChange({ ...subtitles, displayMode: mode.id })}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400/10 border-amber-400 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {mode.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-amber-400/90'
                      }`}
                    >
                      {mode.badge}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-xs text-amber-400 font-bold">✓ Aktif</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {mode.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Card Background Theme */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
        <label className="text-sm font-semibold text-white flex items-center gap-2">
          <Box className="w-4 h-4 text-amber-400" />
          <span>Desain Kotak Latar (Card Backdrop Theme)</span>
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          {CARD_THEMES.map((theme) => {
            const isSelected = (subtitles.cardTheme || 'glass') === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onChange({ ...subtitles, cardTheme: theme.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-amber-400/10 border-amber-400 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xs font-bold text-white">{theme.name}</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {theme.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Font Family Selection */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <span>Pilihan Font Quotes (Font Typography)</span>
          </label>
          <span className="text-xs text-slate-400">
            {subtitles.fontFamily}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {FONTS.map((font) => {
            const isSelected = subtitles.fontFamily === font.id;
            return (
              <button
                key={font.id}
                onClick={() => onChange({ ...subtitles, fontFamily: font.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400/10 border-amber-400 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className={`text-base font-bold truncate ${font.styleClass}`}>
                  Quotes
                </span>
                <div>
                  <p className="text-[11px] font-medium text-white truncate">
                    {font.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {font.category}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Layout, Position & Typography Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Penataan Posisi, Warna & Ukuran Subtitle</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Vertical Position */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-300 font-medium">
              Posisi Teks di Layar:
            </span>
            <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['top', 'center', 'lower-third', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => onChange({ ...subtitles, position: pos })}
                  className={`py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                    subtitles.position === pos
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pos === 'lower-third' ? 'Lower 1/3' : pos}
                </button>
              ))}
            </div>
          </div>

          {/* Text Transform */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-300 font-medium">
              Format Huruf:
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => onChange({ ...subtitles, textTransform: 'uppercase' })}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  subtitles.textTransform === 'uppercase'
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                UPPERCASE (BESAR)
              </button>
              <button
                onClick={() => onChange({ ...subtitles, textTransform: 'none' })}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  subtitles.textTransform === 'none'
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Normal (As Typed)
              </button>
            </div>
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">Ukuran Font Quotes</span>
            <span className="font-mono text-amber-400">{subtitles.fontSize}px</span>
          </div>
          <input
            type="range"
            min={22}
            max={48}
            step={1}
            value={subtitles.fontSize}
            onChange={(e) =>
              onChange({ ...subtitles, fontSize: parseInt(e.target.value, 10) })
            }
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Highlight Color */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Warna Sorotan Kata (Karaoke Highlight)</span>
          </span>
          <div className="flex items-center gap-2">
            {HIGHLIGHT_COLORS.map((col) => (
              <button
                key={col.hex}
                onClick={() => onChange({ ...subtitles, highlightColor: col.hex })}
                style={{ backgroundColor: col.hex }}
                title={col.name}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                  subtitles.highlightColor === col.hex
                    ? 'scale-125 border-white shadow-md'
                    : 'border-transparent hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Indonesian Translation Subtitle Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div>
            <p className="text-xs font-semibold text-white">
              Tampilkan Subtitle Terjemahan Indonesia
            </p>
            <p className="text-[11px] text-slate-400">
              Aktifkan hanya jika quote menggunakan bahasa Inggris dan Anda ingin memunculkan artinya
            </p>
          </div>
          <button
            onClick={() =>
              onChange({ ...subtitles, showIndonesianSub: !subtitles.showIndonesianSub })
            }
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
              subtitles.showIndonesianSub ? 'bg-amber-400' : 'bg-slate-800'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                subtitles.showIndonesianSub ? 'left-6.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
