import React, { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Clock, ImageDown } from 'lucide-react';
import { BackgroundSettings, SubtitleSettings, WordTiming, DurationConfig } from '../types';
import {
  drawCanvasBackground,
  drawCanvasSubtitles,
  resolveActiveQuoteForTime,
  DrawableImage,
} from '../utils/videoExporter';

interface ReelPreviewProps {
  quoteText: string;
  author: string;
  translationId: string;
  background: BackgroundSettings;
  subtitles: SubtitleSettings;
  wordTimings: WordTiming[];
  duration: number;
  currentTime: number;
  subscribeTime?: (listener: (time: number) => void) => () => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onSeek: (time: number) => void;
  videoElement?: HTMLVideoElement | null;
  loadedImages: DrawableImage[];
  durationConfig?: DurationConfig;
  onDurationChange?: (config: DurationConfig) => void;
  onDownloadImage?: () => void;
  isDownloadingImage?: boolean;
}

const formatTime = (secs: number) => {
  const s = Math.floor(secs);
  const ms = Math.floor((secs % 1) * 10);
  return `${s < 10 ? '0' : ''}${s}.${ms}s`;
};

export const ReelPreview: React.FC<ReelPreviewProps> = ({
  quoteText,
  author,
  translationId,
  background,
  subtitles,
  wordTimings,
  duration,
  currentTime,
  subscribeTime,
  isPlaying,
  onPlayToggle,
  onSeek,
  videoElement,
  loadedImages,
  durationConfig,
  onDurationChange,
  onDownloadImage,
  isDownloadingImage = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const timeTextRef = useRef<HTMLSpanElement | null>(null);
  const latestTimeRef = useRef<number>(currentTime);

  const latestPropsRef = useRef({
    quoteText,
    author,
    translationId,
    background,
    subtitles,
    wordTimings,
    duration,
    isPlaying,
    videoElement,
    loadedImages,
  });

  latestPropsRef.current = {
    quoteText,
    author,
    translationId,
    background,
    subtitles,
    wordTimings,
    duration,
    isPlaying,
    videoElement,
    loadedImages,
  };

  const renderFrameAtTime = useCallback((t: number) => {
    latestTimeRef.current = t;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const p = latestPropsRef.current;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (p.videoElement && p.background.type === 'video' && p.videoElement.duration && isFinite(p.videoElement.duration)) {
      const targetTime = t % p.videoElement.duration;
      const driftThreshold = p.isPlaying ? 0.45 : 0.04;
      if (Math.abs(p.videoElement.currentTime - targetTime) > driftThreshold) {
        p.videoElement.currentTime = targetTime;
      }
    }

    drawCanvasBackground(ctx, width, height, t, p.duration, p.background, p.videoElement, p.loadedImages);

    const resolved = resolveActiveQuoteForTime(
      t,
      p.duration,
      p.background,
      p.quoteText,
      p.author,
      p.wordTimings
    );
    drawCanvasSubtitles(
      ctx,
      width,
      height,
      t,
      resolved.quoteText,
      resolved.author,
      p.translationId,
      p.subtitles,
      resolved.wordTimings
    );

    if (sliderRef.current) {
      sliderRef.current.value = String(t);
    }
    if (timeTextRef.current) {
      timeTextRef.current.textContent = `${formatTime(t)}/${formatTime(p.duration)}`;
    }
  }, []);

  // Sync from prop when paused, seeking, or when style/quote/media settings change
  useEffect(() => {
    latestTimeRef.current = currentTime;
    renderFrameAtTime(currentTime);
  }, [
    currentTime,
    duration,
    isPlaying,
    quoteText,
    author,
    translationId,
    background,
    subtitles,
    wordTimings,
    videoElement,
    loadedImages,
    renderFrameAtTime,
  ]);

  // High-FPS direct canvas subscription during playback (bypasses full-app React re-renders)
  useEffect(() => {
    if (!subscribeTime) return;
    return subscribeTime((t) => {
      renderFrameAtTime(t);
    });
  }, [subscribeTime, renderFrameAtTime]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Phone Canvas Container */}
      <div className="relative w-[270px] sm:w-[320px] md:w-[340px] aspect-[9/16] rounded-2xl overflow-hidden border border-slate-800 bg-black select-none">
        <canvas
          ref={canvasRef}
          width={540}
          height={960}
          className="w-full h-full object-contain block cursor-pointer"
          onClick={onPlayToggle}
        />

        {/* Center Play Overlay on Pause */}
        {!isPlaying && (
          <div
            onClick={onPlayToggle}
            className="absolute inset-0 bg-black/25 flex items-center justify-center cursor-pointer z-10"
          >
            <div className="w-13 h-13 rounded-full bg-black/55 border border-white/30 flex items-center justify-center text-white active:scale-95 transition-transform">
              <Play className="w-6 h-6 ml-0.5 fill-white" />
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls & Quick Tools */}
      <div className="w-full max-w-[340px] mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onPlayToggle}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            )}
          </button>

          <button
            onClick={() => onSeek(0)}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Ulangi dari awal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={duration || 6}
            step={0.05}
            defaultValue={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />

          <span
            ref={timeTextRef}
            className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0"
          >
            {formatTime(currentTime)}/{formatTime(duration)}
          </span>
        </div>

        {/* Quick Duration Bar */}
        {onDurationChange && durationConfig && (
          <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
            <span className="flex items-center gap-1 text-slate-400 font-medium shrink-0">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Durasi:</span>
            </span>
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => onDurationChange({ ...durationConfig, mode: 'auto' })}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors shrink-0 cursor-pointer ${
                  durationConfig.mode === 'auto'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                Auto
              </button>
              {[5, 7, 10, 15, 30].map((sec) => {
                const isSelected =
                  durationConfig.mode === 'custom' && Math.abs(durationConfig.customDuration - sec) < 0.2;
                return (
                  <button
                    key={sec}
                    onClick={() =>
                      onDurationChange({
                        ...durationConfig,
                        mode: 'custom',
                        customDuration: sec,
                      })
                    }
                    className={`px-2 py-0.5 rounded-md font-mono transition-colors shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                  >
                    {sec}s
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Download PNG Button */}
        {onDownloadImage && (
          <button
            onClick={onDownloadImage}
            disabled={isDownloadingImage}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <ImageDown className="w-3.5 h-3.5" />
            <span>{isDownloadingImage ? 'Menyimpan Gambar...' : 'Simpan Gambar Quotes (PNG)'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
