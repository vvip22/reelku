import React, { useRef } from 'react';
import { Download, CheckCircle2, Film, X, AlertCircle, RotateCcw } from 'lucide-react';
import { ExportProgress } from '../utils/videoExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isExporting: boolean;
  progress: ExportProgress;
  exportedBlob: Blob | null;
  exportedUrl: string | null;
  quoteAuthor: string;
  fps?: 30 | 60;
  exportError?: string | null;
  audioWarning?: string | null;
  onRetry?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  isExporting,
  progress,
  exportedBlob,
  exportedUrl,
  quoteAuthor,
  fps = 30,
  exportError,
  audioWarning,
  onRetry,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!exportedUrl) return;
    const cleanAuthor = (quoteAuthor || 'ReelQuote').replace(/[^a-zA-Z0-9]/g, '_');
    const ext = exportedBlob?.type.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = exportedUrl;
    a.download = `Facebook_Reel_1080p_${cleanAuthor}_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fileSizeMB = exportedBlob ? (exportedBlob.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isExporting
                  ? 'Merender Video 1080p MP4...'
                  : exportError
                  ? 'Gagal Merender Video'
                  : 'Video 1080p Siap Didownload'}
              </h2>
              <p className="text-[11px] text-slate-400">
                1080 × 1920 · {fps} FPS
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Exporting Progress */}
        {isExporting && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{progress.statusText}</span>
              <span className="font-mono text-amber-400 font-semibold">
                {Math.round(progress.progress * 100)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-amber-400 transition-all duration-150 rounded-full"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Export Error */}
        {!isExporting && exportError && (
          <div className="flex flex-col gap-4 py-1">
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-rose-300">Terjadi kendala saat rendering:</span>
                <span className="text-rose-200/80 leading-relaxed">{exportError}</span>
              </div>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Coba Render Ulang</span>
              </button>
            )}
          </div>
        )}

        {/* Export Complete */}
        {!isExporting && !exportError && exportedUrl && (
          <div className="flex flex-col gap-4">
            <div className="relative aspect-[9/16] max-h-[300px] mx-auto rounded-xl overflow-hidden bg-black border border-slate-800">
              <video
                ref={videoRef}
                src={exportedUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Render 1080p Berhasil
              </span>
              <span className="font-mono">~{fileSizeMB} MB</span>
            </div>

            {audioWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-[11px] text-amber-200 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{audioWarning}</span>
              </div>
            )}

            <button
              onClick={handleDownload}
              className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Video MP4 (1080p)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
