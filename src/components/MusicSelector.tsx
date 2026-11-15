import React, { useRef } from 'react';
import { Music, Upload, Play, Pause, Volume2 } from 'lucide-react';
import { AudioSettings } from '../types';

interface MusicSelectorProps {
  audioSettings: AudioSettings;
  onChange: (updated: AudioSettings) => void;
  onPreviewMusic: (trackId: string) => void;
  isPlayingMusic: boolean;
  activePlayingTrackId?: string;
  onTestMix: () => void;
  isPlayingMix: boolean;
  onCustomMusicUploaded: (file: File) => void;
}

export const MusicSelector: React.FC<MusicSelectorProps> = ({
  audioSettings,
  onChange,
  onTestMix,
  isPlayingMix,
  onCustomMusicUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onCustomMusicUploaded(file);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Custom Audio File Upload */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-amber-400" />
            <span>Musik Latar (Audio / Lagu Sendiri)</span>
          </h3>
          {audioSettings.customAudioName && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...audioSettings,
                  musicTrackId: 'none',
                  customAudioName: undefined,
                })
              }
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Hapus Musik
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`p-4 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-between gap-3 ${
            audioSettings.musicTrackId === 'custom'
              ? 'bg-amber-400/10 border-amber-400 text-white'
              : 'border-slate-700 bg-slate-950/50 hover:border-slate-600 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {audioSettings.customAudioName || 'Upload Musik / Lagu Sendiri (MP3 / WAV)'}
              </p>
              <p className="text-[11px] text-slate-400">
                Gunakan lagu atau instrumen dari file perangkat Anda
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium shrink-0 cursor-pointer"
          >
            {audioSettings.customAudioName ? 'Ganti File' : 'Pilih File'}
          </button>
        </div>
      </div>

      {/* Audio Balance & Mix Control */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-400" />
          <span>Pengaturan Volume Musik & Narasi</span>
        </label>

        {/* Music Volume Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">Volume Musik Latar (BGM)</span>
            <span className="font-mono text-amber-400">
              {Math.round(audioSettings.musicVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audioSettings.musicVolume}
            onChange={(e) =>
              onChange({ ...audioSettings, musicVolume: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <p className="text-[11px] text-slate-400">
            Disarankan 20% - 30% agar suara wanita narasi terdengar jernih dan dominan di Reel Facebook.
          </p>
        </div>

        {/* Mix Test Button */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-300 font-medium">
            Tes Hasil Gabungan (Narasi + Musik):
          </span>
          <button
            onClick={onTestMix}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {isPlayingMix ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Hentikan Tes Audio</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Dengarkan Mix Audio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
