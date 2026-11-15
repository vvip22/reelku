import React from 'react';
import { Clock, Plus, Minus, Check } from 'lucide-react';
import { DurationConfig } from '../types';

interface DurationSelectorProps {
  durationConfig: DurationConfig;
  onDurationChange: (updated: DurationConfig) => void;
  voiceDuration?: number;
  numImages?: number;
  mediaType: 'video' | 'images' | 'preset';
}

export const DurationSelector: React.FC<DurationSelectorProps> = ({
  durationConfig,
  onDurationChange,
  voiceDuration = 5.0,
  numImages = 0,
  mediaType,
}) => {
  const isAuto = durationConfig.mode === 'auto';
  const autoCalculatedDuration = Math.max(Number((voiceDuration + 0.9).toFixed(1)), 4.0);
  const activeDuration = isAuto ? autoCalculatedDuration : durationConfig.customDuration;

  const adjustDuration = (delta: number) => {
    const next = Math.max(3, Math.min(60, Number((activeDuration + delta).toFixed(1))));
    onDurationChange({
      ...durationConfig,
      mode: 'custom',
      customDuration: next,
    });
  };

  const activeFps = durationConfig.fps || 30;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Durasi &amp; Kehalusan Video</h3>
        </div>
        <span className="text-xs text-amber-400 font-mono font-bold">
          {activeDuration.toFixed(1)}s · {activeFps} FPS
        </span>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => onDurationChange({ ...durationConfig, mode: 'auto' })}
          className={`py-1.5 px-3 rounded-lg font-medium cursor-pointer transition-colors ${
            isAuto ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Otomatis ({autoCalculatedDuration.toFixed(1)}s)
        </button>
        <button
          onClick={() =>
            onDurationChange({
              ...durationConfig,
              mode: 'custom',
              customDuration: activeDuration,
            })
          }
          className={`py-1.5 px-3 rounded-lg font-medium cursor-pointer transition-colors ${
            !isAuto ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Atur Manual
        </button>
      </div>

      {/* Precision Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">
            Durasi Video
            {mediaType === 'images' && numImages > 0
              ? ` (~${(activeDuration / numImages).toFixed(1)}s/foto)`
              : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustDuration(-1)}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono text-amber-400 font-bold px-1.5">
              {activeDuration.toFixed(1)}s
            </span>
            <button
              onClick={() => adjustDuration(1)}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <input
          type="range"
          min={3}
          max={60}
          step={0.5}
          value={activeDuration}
          onChange={(e) =>
            onDurationChange({
              ...durationConfig,
              mode: 'custom',
              customDuration: parseFloat(e.target.value),
            })
          }
          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </div>

      {/* Frame Rate Selector */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
        <button
          onClick={() => onDurationChange({ ...durationConfig, fps: 30 })}
          className={`p-2 rounded-xl border text-left cursor-pointer flex items-center justify-between text-xs ${
            activeFps === 30
              ? 'bg-amber-400/15 border-amber-400 text-white font-semibold'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <span>30 FPS (Cepat)</span>
          {activeFps === 30 && <Check className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        <button
          onClick={() => onDurationChange({ ...durationConfig, fps: 60 })}
          className={`p-2 rounded-xl border text-left cursor-pointer flex items-center justify-between text-xs ${
            activeFps === 60
              ? 'bg-amber-400/15 border-amber-400 text-white font-semibold'
              : 'bg-slate-950/70 border-slate-800 text-slate-400'
          }`}
        >
          <span>60 FPS (Halus)</span>
          {activeFps === 60 && <Check className="w-3.5 h-3.5 text-amber-400" />}
        </button>
      </div>
    </div>
  );
};
