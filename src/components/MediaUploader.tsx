import React, { useRef, useState } from 'react';
import { Upload, Video, Images, Trash2, Sliders, Play, MessageSquarePlus, Eye, ImageDown } from 'lucide-react';
import { BackgroundSettings, ImageSlide } from '../types';

interface MediaUploaderProps {
  background: BackgroundSettings;
  onChange: (updated: BackgroundSettings) => void;
  onVideoLoaded: (videoEl: HTMLVideoElement) => void;
  defaultQuoteText?: string;
  defaultAuthor?: string;
  onPreviewSlide?: (index: number) => void;
  onDownloadImage?: (slideIndex?: number) => void;
  isDownloadingImage?: boolean;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  background,
  onChange,
  onVideoLoaded,
  defaultQuoteText = '',
  defaultAuthor = '',
  onPreviewSlide,
  onDownloadImage,
  isDownloadingImage = false,
}) => {
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'auto';
    video.src = url;
    video.onloadedmetadata = () => {
      onVideoLoaded(video);
      onChange({
        ...background,
        type: 'video',
        videoUrl: url,
        videoDuration: video.duration,
      });
    };
    video.load();
  };

  const handlePhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSlides: ImageSlide[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      duration: 3,
    }));

    const nextIdx = background.images.length;
    onChange({
      ...background,
      type: 'images',
      images: [...background.images, ...newSlides],
    });
    e.target.value = '';
    if (onPreviewSlide) {
      setTimeout(() => onPreviewSlide(nextIdx), 60);
    }
  };

  const handleRemovePhoto = (id: string) => {
    onChange({
      ...background,
      images: background.images.filter((img) => img.id !== id),
    });
    if (editingSlideId === id) {
      setEditingSlideId(null);
    }
  };

  const handleUpdateSlideQuote = (id: string, patch: Partial<ImageSlide>) => {
    onChange({
      ...background,
      type: 'images',
      images: background.images.map((slide) =>
        slide.id === id ? { ...slide, ...patch } : slide
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Media Type Selector Tabs */}
      <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1">
        <button
          onClick={() => onChange({ ...background, type: 'images' })}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            background.type !== 'video'
              ? 'bg-amber-400 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Images className="w-3.5 h-3.5" />
          <span>Foto &amp; Gambar ({background.images.length})</span>
        </button>

        <button
          onClick={() => onChange({ ...background, type: 'video' })}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            background.type === 'video'
              ? 'bg-amber-400 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Video Background</span>
        </button>
      </div>

      {/* Mode 1: Video Upload */}
      {background.type === 'video' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-400" />
              <span>Upload Video Background</span>
            </h3>
            {background.videoUrl && (
              <span className="text-xs text-amber-400 font-mono">
                {Math.round(background.videoDuration || 0)}s
              </span>
            )}
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />

          {!background.videoUrl ? (
            <div
              onClick={() => videoInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-400/80 rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-950/50 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-amber-400" />
              <p className="text-xs font-medium text-white">Pilih Video MP4 / WebM / MOV</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xs text-white font-medium">
                  Video Terpasang ({Math.round(background.videoDuration || 0)}s)
                </span>
              </div>
              <button
                onClick={() => videoInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Ganti Video
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Multi-Photo Upload */}
      {background.type !== 'video' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Images className="w-4 h-4 text-amber-400" />
              <span>Upload Foto / Banyak Foto</span>
            </h3>
            <span className="text-xs text-amber-400 font-mono">
              {background.images.length} Foto
            </span>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosUpload}
            className="hidden"
          />

          <div
            onClick={() => photoInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-amber-400/80 rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 bg-slate-950/50 cursor-pointer"
          >
            <Upload className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-medium text-white">
              + Pilih Foto dari HP / Komputer
            </span>
            <span className="text-[11px] text-slate-400">
              Bisa upload 1 foto atau banyak foto sekaligus
            </span>
          </div>

          {/* Transition Selector */}
          {background.images.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">Transisi Foto:</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => onChange({ ...background, photoTransition: 'kenburns' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                    background.photoTransition === 'kenburns'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Zoom Halus
                </button>
                <button
                  onClick={() => onChange({ ...background, photoTransition: 'fade' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                    background.photoTransition === 'fade'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Crossfade
                </button>
              </div>
            </div>
          )}

          {/* Touch-friendly Uploaded Photos List */}
          {background.images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {background.images.map((slide, idx) => {
                const isEditing = editingSlideId === slide.id;
                const hasCustomQuote = Boolean(slide.customQuote && slide.customQuote.trim());
                return (
                  <div
                    key={slide.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => onPreviewSlide?.(idx)}
                        className="relative w-12 h-16 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-black cursor-pointer"
                        title="Lihat di preview"
                      >
                        <img src={slide.url} alt={slide.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0.5 left-0.5 bg-black/75 px-1 rounded text-[9px] text-white font-mono">
                          #{idx + 1}
                        </span>
                      </button>

                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">
                            Foto #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            {onPreviewSlide && (
                              <button
                                type="button"
                                onClick={() => onPreviewSlide(idx)}
                                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                title="Lihat preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(slide.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Hapus foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate">
                          {hasCustomQuote ? `"${slide.customQuote}"` : 'Pakai quotes utama'}
                        </p>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isEditing && !hasCustomQuote) {
                                handleUpdateSlideQuote(slide.id, {
                                  customQuote: defaultQuoteText,
                                  customAuthor: defaultAuthor,
                                });
                              }
                              setEditingSlideId(isEditing ? null : slide.id);
                              onPreviewSlide?.(idx);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-medium cursor-pointer whitespace-nowrap"
                          >
                            <MessageSquarePlus className="w-3 h-3" />
                            <span>{isEditing ? 'Tutup' : hasCustomQuote ? 'Edit Quote' : '+ Quote'}</span>
                          </button>

                          {onDownloadImage && (
                            <button
                              type="button"
                              onClick={() => onDownloadImage(idx)}
                              disabled={isDownloadingImage}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer whitespace-nowrap"
                              title="Download PNG"
                            >
                              <ImageDown className="w-3 h-3 text-amber-400" />
                              <span>PNG</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                        <textarea
                          rows={2}
                          value={slide.customQuote ?? ''}
                          onChange={(e) =>
                            handleUpdateSlideQuote(slide.id, { customQuote: e.target.value })
                          }
                          placeholder="Ketik teks quote untuk foto ini..."
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={slide.customAuthor ?? ''}
                            onChange={(e) =>
                              handleUpdateSlideQuote(slide.id, { customAuthor: e.target.value })
                            }
                            placeholder="Author"
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSlideQuote(slide.id, { customQuote: '', customAuthor: '' })
                            }
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] whitespace-nowrap cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Global Dark Scrim Slider */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <label className="font-medium text-slate-300 flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Gelap Latar (Agar Teks Kontras)</span>
          </label>
          <span className="font-mono text-amber-400">
            {Math.round(background.overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={0.85}
          step={0.05}
          value={background.overlayOpacity}
          onChange={(e) =>
            onChange({ ...background, overlayOpacity: parseFloat(e.target.value) })
          }
          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </div>
    </div>
  );
};
