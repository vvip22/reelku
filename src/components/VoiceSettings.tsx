import React from 'react';
import { Mic, Play, Pause, Volume2, RefreshCw, Gauge, Check } from 'lucide-react';
import { FemaleVoiceId, VoiceSettings } from '../types';
import { FEMALE_VOICE_PROFILES } from '../utils/ttsClient';

interface VoiceSettingsProps {
  voice: VoiceSettings;
  onChange: (updated: VoiceSettings) => void;
  onGenerateVoice: () => void;
  isGenerating: boolean;
  onTestPlayVoice: () => void;
  isPlayingVoice: boolean;
  audioDuration?: number;
}

const SPEED_PRESETS = [
  { rate: 0.76, label: '0.76x', tag: 'Sangat Tenang' },
  { rate: 0.84, label: '0.84x', tag: 'Pas Quotes' },
  { rate: 0.92, label: '0.92x', tag: 'Sedang' },
  { rate: 1.0, label: '1.00x', tag: 'Normal' },
];

export const VoiceSettingsPanel: React.FC<VoiceSettingsProps> = ({
  voice,
  onChange,
  onGenerateVoice,
  isGenerating,
  onTestPlayVoice,
  isPlayingVoice,
  audioDuration,
}) => {
  const activeVoiceId: FemaleVoiceId = voice.geminiVoice || 'Kore';
  const currentRate = voice.rate ?? 0.84;

  const handleSelectVoice = (voiceId: FemaleVoiceId) => {
    if (voiceId === activeVoiceId) return;
    const profile = FEMALE_VOICE_PROFILES.find((p) => p.id === voiceId);
    onChange({
      ...voice,
      geminiVoice: voiceId,
      pitch: profile?.browserPitch ?? 1.05,
    });
  };

  const handleRateChange = (newRate: number) => {
    const clamped = Math.max(0.7, Math.min(1.15, Number(newRate.toFixed(2))));
    onChange({
      ...voice,
      rate: clamped,
    });
  };

  const getRateDescription = (r: number) => {
    if (r <= 0.78) return 'Sangat Tenang & Reflektif';
    if (r <= 0.87) return 'Kalem & Pas untuk Quotes';
    if (r <= 0.95) return 'Mengalir Natural';
    return 'Cepat & Tegas';
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Female English Voice Selector */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-400" />
              <span>Pilihan Suara Wanita Bahasa Inggris</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih karakter suara wanita yang berbeda sesuai nuansa quotes Anda
            </p>
          </div>
          {audioDuration && (
            <span className="text-xs text-amber-400 font-mono tabular-nums shrink-0">
              {audioDuration.toFixed(1)}s
            </span>
          )}
        </div>

        {/* 4 Selectable Female Voice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FEMALE_VOICE_PROFILES.map((profile) => {
            const isSelected = activeVoiceId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleSelectVoice(profile.id)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'border-amber-400 bg-amber-400/10 shadow-sm shadow-amber-400/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{profile.label}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                      {profile.badge}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="text-[11px] font-medium text-amber-300/90">{profile.subtitle}</span>
                <p className="text-[11px] text-slate-400 leading-snug">{profile.description}</p>
              </button>
            );
          })}
        </div>

        {voice.provider === 'browser' && (
          <p className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 leading-relaxed">
            Mode suara browser aktif: karakter suara &amp; sinkronisasi kata otomatis mengikuti profil{' '}
            <span className="text-amber-400 font-medium">{activeVoiceId}</span> yang Anda pilih.
          </p>
        )}

        {/* Play & Re-sync Voice Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onTestPlayVoice}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPlayingVoice ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white text-white" />
                <span>Stop Suara</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white text-white" />
                <span>Dengarkan Suara ({activeVoiceId})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onGenerateVoice}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Menyesuaikan Suara...' : 'Sinkronkan Audio & Subtitle'}</span>
          </button>
        </div>
      </div>

      {/* Speech Speed / Pacing Control */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <label className="font-medium text-slate-200 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>Kecepatan Bicara (Pacing Quotes)</span>
          </label>
          <span className="font-mono text-amber-400 tabular-nums">
            {currentRate.toFixed(2)}x · {getRateDescription(currentRate)}
          </span>
        </div>

        {/* Speed Presets */}
        <div className="grid grid-cols-4 gap-2">
          {SPEED_PRESETS.map((preset) => {
            const isActive = Math.abs(currentRate - preset.rate) < 0.025;
            return (
              <button
                key={preset.rate}
                type="button"
                onClick={() => handleRateChange(preset.rate)}
                className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="text-xs font-mono">{preset.label}</span>
                <span className={`text-[10px] ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                  {preset.tag}
                </span>
              </button>
            );
          })}
        </div>

        <input
          type="range"
          min={0.7}
          max={1.15}
          step={0.02}
          value={currentRate}
          onChange={(e) => handleRateChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Lebih Lambat &amp; Tenang (0.70x)</span>
          <span>Lebih Cepat (1.15x)</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-medium text-slate-300 flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Volume Suara Narasi</span>
          </label>
          <span className="font-mono text-amber-400 tabular-nums">
            {Math.round(voice.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={voice.volume}
          onChange={(e) =>
            onChange({
              ...voice,
              volume: parseFloat(e.target.value),
            })
          }
          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </div>
    </div>
  );
};

