/**
 * ReelQuote Studio - Facebook Reels Quote Maker
 * Generate viral 1080p MP4 English quotes videos with AI female voice narration,
 * dynamic synced subtitles, customizable fonts, and background music.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ReelPreview } from './components/ReelPreview';
import { QuoteEditor } from './components/QuoteEditor';
import { MediaUploader } from './components/MediaUploader';
import { VoiceSettingsPanel } from './components/VoiceSettings';
import { SubtitleStyleEditor } from './components/SubtitleStyleEditor';
import { MusicSelector } from './components/MusicSelector';
import { DurationSelector } from './components/DurationSelector';
import { ExportModal } from './components/ExportModal';

import {
  QuoteData,
  BackgroundSettings,
  VoiceSettings,
  SubtitleSettings,
  AudioSettings,
  WordTiming,
  DurationConfig,
  FemaleVoiceId,
} from './types';

import {
  generateProceduralMusicBuffer,
  CURATED_TRACKS,
} from './utils/audioSynthesizer';
import {
  generateFemaleVoiceTTS,
  captureBrowserVoiceToAudioBuffer,
  speakFemaleBrowserVoice,
  stopBrowserSpeech,
  calculateWordTimings,
  estimateSpeechDuration,
  prewarmBrowserVoices,
  TTSResult,
} from './utils/ttsClient';
import {
  exportReelTo1080pMP4,
  exportQuoteImageToPNG,
  ExportProgress,
  DrawableImage,
} from './utils/videoExporter';

export default function App() {
  // Navigation tab state (4 clean tabs, zero duplicates)
  const [activeTab, setActiveTab] = useState<'quote' | 'media' | 'voice' | 'music'>('quote');

  // Duration Settings state
  const [durationConfig, setDurationConfig] = useState<DurationConfig>({
    mode: 'auto',
    customDuration: 10,
    fps: 30,
  });

  // Quote state
  const [quote, setQuote] = useState<QuoteData>({
    text: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
    translationId: 'Kamu berkuasa atas pikiranmu, bukan kejadian di luar. Sadari ini, dan kamu akan menemukan kekuatan sejati.',
    category: 'Stoicism',
  });

  // Background Media state
  const [background, setBackground] = useState<BackgroundSettings>({
    type: 'images',
    presetId: 'night-city',
    images: [],
    overlayOpacity: 0.45,
    blurBackground: false,
    photoTransition: 'kenburns',
  });

  // Female Voice state (calm 0.84x default pacing tailored for quotes)
  const [voice, setVoice] = useState<VoiceSettings>({
    provider: 'gemini',
    geminiVoice: 'Kore',
    style: 'Warm, emotionally resonant female voice tailored for quotes',
    rate: 0.84,
    pitch: 1.04,
    volume: 1.0,
  });

  // Subtitle Settings state
  const [subtitles, setSubtitles] = useState<SubtitleSettings>({
    displayMode: 'dynamic-phrase',
    cardTheme: 'glass',
    fontFamily: 'Playfair Display',
    fontSize: 32,
    textColor: '#ffffff',
    highlightColor: '#fbbf24', // Amber gold
    styleMode: 'karaoke',
    position: 'center',
    textTransform: 'none',
    showIndonesianSub: false,
    showQuoteMarks: true,
    boxOpacity: 0.65,
    lineHeight: 1.35,
    maxWordsPerLine: 4,
  });

  // Audio / Music Settings state
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    musicTrackId: 'none',
    musicVolume: 0.25,
    voiceVolume: 1.0,
  });

  // Playback & Timing state
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(6.5);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const currentTimeRef = useRef<number>(0);
  const timeListenersRef = useRef<Set<(time: number) => void>>(new Set());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<boolean>(false);

  const subscribeTime = useCallback((listener: (time: number) => void) => {
    timeListenersRef.current.add(listener);
    return () => {
      timeListenersRef.current.delete(listener);
    };
  }, []);

  const notifyTimeListeners = useCallback((time: number) => {
    currentTimeRef.current = time;
    timeListenersRef.current.forEach((fn) => fn(time));
  }, []);

  // Synchronize totalDuration with durationConfig
  const voiceDuration = voice.audioDuration || 5.2;
  const computedDuration =
    durationConfig.mode === 'auto'
      ? Math.max(Number((voiceDuration + 0.9).toFixed(1)), 4.0)
      : durationConfig.customDuration;

  useEffect(() => {
    setTotalDuration(computedDuration);
  }, [computedDuration]);

  // Audio buffers & DOM media references
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceBufferRef = useRef<AudioBuffer | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const voiceSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceAudioElRef = useRef<HTMLAudioElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const lastGeneratedQuoteRef = useRef<string>(quote.text);
  const lastGeneratedVoiceKeyRef = useRef<string>('');
  const voiceUrlRef = useRef<string | null>(null);
  const rateRegenTimerRef = useRef<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<DrawableImage[]>([]);

  // Testing states
  const [isPlayingVoiceOnly, setIsPlayingVoiceOnly] = useState<boolean>(false);
  const [isPlayingMusicOnly, setIsPlayingMusicOnly] = useState<boolean>(false);
  const [isPlayingMixOnly, setIsPlayingMixOnly] = useState<boolean>(false);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    progress: 0,
    currentFrame: 0,
    totalFrames: 0,
    statusText: 'Menyiapkan canvas 1080p...',
  });
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportAudioWarning, setExportAudioWarning] = useState<string | null>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);

  // Initialize AudioContext
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Generate / Load Procedural Music Buffer whenever track changes
  useEffect(() => {
    const loadMusic = async () => {
      if (audioSettings.musicTrackId === 'none') {
        musicBufferRef.current = null;
        return;
      }
      const selectedTrack = CURATED_TRACKS.find((t) => t.id === audioSettings.musicTrackId);
      if (selectedTrack && selectedTrack.presetStyle) {
        try {
          const ctx = getAudioContext();
          const buffer = await generateProceduralMusicBuffer(
            selectedTrack.presetStyle,
            16,
            ctx.sampleRate
          );
          musicBufferRef.current = buffer;
        } catch (e) {
          console.warn('Could not generate procedural music buffer:', e);
        }
      }
    };
    loadMusic();
  }, [audioSettings.musicTrackId]);

  // Pre-load & downscale preview images (max 720px) so high-res phone photos never lag mobile canvas
  useEffect(() => {
    let cancelled = false;
    if (background.type === 'images' && background.images.length > 0) {
      Promise.all(
        background.images.map((slide) => {
          return new Promise<DrawableImage>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const maxDim = 720;
              const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
              const w = Math.max(1, Math.round((img.naturalWidth || 540) * scale));
              const h = Math.max(1, Math.round((img.naturalHeight || 960) * scale));
              const off = document.createElement('canvas');
              off.width = w;
              off.height = h;
              const octx = off.getContext('2d');
              if (octx && img.naturalWidth > 0) {
                octx.drawImage(img, 0, 0, w, h);
                resolve(off);
              } else {
                resolve(img);
              }
            };
            img.onerror = () => resolve(img);
            img.src = slide.url;
          });
        })
      ).then((imgs) => {
        if (!cancelled) setLoadedImages(imgs);
      });
    } else {
      setLoadedImages([]);
    }
    return () => {
      cancelled = true;
    };
  }, [background.images, background.type]);

  // Keep wordTimings synced immediately whenever quote text or rate changes without cached Gemini audio
  useEffect(() => {
    if (!voiceBufferRef.current) {
      const targetDur = estimateSpeechDuration(quote.text, voice.rate, voice.geminiVoice);
      setWordTimings(
        calculateWordTimings(quote.text, targetDur, { leadTime: 0.02, tailTime: 0.14 })
      );
      setVoice((prev) =>
        Math.abs((prev.audioDuration || 0) - targetDur) > 0.05
          ? { ...prev, audioDuration: targetDur }
          : prev
      );
    } else if (quote.text !== lastGeneratedQuoteRef.current) {
      const targetDur = estimateSpeechDuration(quote.text, voice.rate, voice.geminiVoice);
      setWordTimings(
        calculateWordTimings(quote.text, targetDur, { leadTime: 0.02, tailTime: 0.14 })
      );
    }
  }, [quote.text, voice.rate, voice.geminiVoice]);

  // Voice narration generation function
  const handleGenerateVoice = async (
    textToSpeak?: string,
    voiceOverride?: FemaleVoiceId,
    rateOverride?: number
  ) => {
    const text = (textToSpeak || quote.text).trim();
    if (!text) return;

    const targetVoice: FemaleVoiceId = voiceOverride || voice.geminiVoice || 'Kore';
    const targetRate = rateOverride ?? voice.rate ?? 0.84;

    setIsGeneratingVoice(true);
    try {
      const ctx = getAudioContext();
      const result: TTSResult = await generateFemaleVoiceTTS(text, {
        voiceName: targetVoice,
        style: 'Calm, clear, charismatic female voice tailored for quotes',
        rate: targetRate,
        audioContext: ctx,
      });

      lastGeneratedQuoteRef.current = text;
      voiceBufferRef.current = result.audioBuffer || null;
      lastGeneratedVoiceKeyRef.current = result.audioBuffer
        ? `${text}|${targetVoice}|${targetRate.toFixed(2)}`
        : '';
      setWordTimings(result.wordTimings);

      if (durationConfig.mode === 'auto') {
        const newDuration = Math.max(Number((result.duration + 0.9).toFixed(1)), 4.0);
        setTotalDuration(newDuration);
      }

      if (voiceUrlRef.current && voiceUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(voiceUrlRef.current);
      }
      voiceUrlRef.current = result.audioUrl || null;

      setVoice((prev) => ({
        ...prev,
        provider: result.provider,
        geminiVoice: targetVoice,
        rate: targetRate,
        audioUrl: result.audioUrl,
        audioDuration: result.duration,
      }));

      // Update or clear HTMLAudioElement cleanly so stale audio never replays
      if (result.audioUrl) {
        voiceAudioElRef.current = new Audio(result.audioUrl);
        voiceAudioElRef.current.preload = 'auto';
      } else {
        voiceAudioElRef.current = null;
      }
    } catch (err) {
      console.error('Error generating voice:', err);
      voiceBufferRef.current = null;
      voiceAudioElRef.current = null;
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Pre-warm browser voices & auto-generate female voice on first load
  useEffect(() => {
    prewarmBrowserVoices(() => {
      if (!voiceBufferRef.current) {
        const recalDur = estimateSpeechDuration(quote.text, voice.rate, voice.geminiVoice);
        setWordTimings(
          calculateWordTimings(quote.text, recalDur, { leadTime: 0.02, tailTime: 0.14 })
        );
        setVoice((prev) => ({ ...prev, audioDuration: recalDur }));
      }
    });
    handleGenerateVoice(quote.text, 'Kore', 0.84);
  }, []);

  // Play / Pause Preview Loop
  useEffect(() => {
    let animId: number;
    let cancelled = false;
    let fallbackTimerId: number | null = null;

    const stopAudioPreview = () => {
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
      try {
        voiceSourceNodeRef.current?.stop();
        musicSourceNodeRef.current?.stop();
      } catch (e) {}
      voiceSourceNodeRef.current = null;
      musicSourceNodeRef.current = null;
      if (voiceAudioElRef.current) {
        voiceAudioElRef.current.pause();
      }
      stopBrowserSpeech();
      if (videoElementRef.current) {
        videoElementRef.current.pause();
      }
    };

    if (isPlaying) {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const initialOffset = currentTimeRef.current;

      // Start background video playback smoothly in sync with preview
      if (videoElementRef.current && background.type === 'video' && videoElementRef.current.duration) {
        const vEl = videoElementRef.current;
        vEl.muted = true;
        vEl.loop = true;
        vEl.currentTime = initialOffset % vEl.duration;
        vEl.play().catch(() => {});
      }

      let waitingForTtsStart = false;
      let ttsStartReal: number | null = null;
      let anchorReal = performance.now();
      let anchorMedia = initialOffset;
      let clockScale = 1.0;
      let useAudioClock = false;
      let audioClockStartCtxTime = ctx.currentTime;
      let latestPlayMedia = initialOffset;
      const activeTimings = [...wordTimings];
      const lastWordEnd =
        activeTimings.length > 0 ? activeTimings[activeTimings.length - 1].endTime : 0;

      // Start female voice narration audio (Gemini WAV or Female Browser Speech fallback)
      if (voiceBufferRef.current) {
        const vSource = ctx.createBufferSource();
        vSource.buffer = voiceBufferRef.current;
        const vGain = ctx.createGain();
        vGain.gain.value = audioSettings.voiceVolume;
        vSource.connect(vGain);
        vGain.connect(ctx.destination);
        const startOffset = Math.min(initialOffset, Math.max(0, voiceBufferRef.current.duration - 0.05));
        if (initialOffset < voiceBufferRef.current.duration) {
          vSource.start(0, startOffset);
          voiceSourceNodeRef.current = vSource;
        }
        useAudioClock = true;
        audioClockStartCtxTime = ctx.currentTime;
      } else if (voiceAudioElRef.current) {
        voiceAudioElRef.current.currentTime = initialOffset;
        voiceAudioElRef.current.volume = Math.min(audioSettings.voiceVolume, 1.0);
        voiceAudioElRef.current.play().catch(() => {});
      } else if (audioSettings.voiceVolume > 0 && initialOffset < totalDuration - 0.4) {
        // Real female English voice via Web Speech API with calibrated start/boundary/end sync
        let startWordIdx = 0;
        if (initialOffset > 0.25 && activeTimings.length > 0) {
          const foundIdx = activeTimings.findIndex((t) => t.endTime > initialOffset + 0.05);
          startWordIdx = foundIdx >= 0 ? foundIdx : 0;
        }

        waitingForTtsStart = true;
        fallbackTimerId = window.setTimeout(() => {
          if (waitingForTtsStart && !cancelled) {
            waitingForTtsStart = false;
            const now = performance.now();
            ttsStartReal = now;
            anchorReal = now;
            anchorMedia = initialOffset;
          }
        }, 320);

        speakFemaleBrowserVoice(quote.text, {
          voiceId: voice.geminiVoice,
          volume: audioSettings.voiceVolume,
          rate: voice.rate,
          pitch: voice.pitch,
          startWordIndex: startWordIdx,
          onStart: () => {
            if (cancelled) return;
            if (fallbackTimerId !== null) {
              window.clearTimeout(fallbackTimerId);
              fallbackTimerId = null;
            }
            const now = performance.now();
            waitingForTtsStart = false;
            ttsStartReal = now;
            anchorReal = now;
            anchorMedia = initialOffset;
          },
          onWordBoundary: (globalWordIdx) => {
            if (cancelled) return;
            const timing = activeTimings[globalWordIdx];
            if (!timing) return;
            const nowB = performance.now();
            const targetMedia = timing.startTime + 0.015;

            if (ttsStartReal !== null && globalWordIdx > startWordIdx) {
              const realElapsed = (nowB - ttsStartReal) / 1000;
              const mediaElapsed = targetMedia - initialOffset;
              if (realElapsed > 0.2 && mediaElapsed > 0.08) {
                const measuredScale = Math.max(0.65, Math.min(1.85, mediaElapsed / realElapsed));
                clockScale = clockScale * 0.35 + measuredScale * 0.65;
              }
            }

            anchorReal = nowB;
            anchorMedia = Math.max(targetMedia, latestPlayMedia - 0.04);
          },
          onEnd: (info) => {
            if (cancelled || !info?.naturalEnd) return;
            // If speech ended slightly before subtitle reached the final word, finish remaining subtitle briskly
            if (lastWordEnd > latestPlayMedia + 0.12) {
              const nowE = performance.now();
              anchorReal = nowE;
              anchorMedia = latestPlayMedia;
              const remainingMedia = lastWordEnd - latestPlayMedia;
              clockScale = Math.max(clockScale, Math.min(5.0, remainingMedia / 0.28));
            }
            if (startWordIdx === 0 && info.actualSeconds >= 1.0) {
              const calibratedDur = Number((info.actualSeconds + 0.14).toFixed(2));
              const updatedTimings = calculateWordTimings(quote.text, calibratedDur, {
                leadTime: 0.02,
                tailTime: 0.14,
              });
              setWordTimings(updatedTimings);
              setVoice((prev) => ({ ...prev, audioDuration: calibratedDur }));
            }
          },
        });
      }

      // Start background music loop
      if (musicBufferRef.current && audioSettings.musicVolume > 0) {
        const mSource = ctx.createBufferSource();
        mSource.buffer = musicBufferRef.current;
        mSource.loop = true;
        const mGain = ctx.createGain();
        mGain.gain.value = audioSettings.musicVolume;
        mSource.connect(mGain);
        mGain.connect(ctx.destination);
        mSource.start(0, initialOffset % musicBufferRef.current.duration);
        musicSourceNodeRef.current = mSource;
      }

      const step = (now: number) => {
        if (cancelled) return;

        let newTime = initialOffset;
        if (useAudioClock) {
          newTime = initialOffset + (ctx.currentTime - audioClockStartCtxTime);
        } else if (!waitingForTtsStart) {
          newTime = anchorMedia + ((now - anchorReal) / 1000) * clockScale;
        }
        latestPlayMedia = newTime;

        if (newTime >= totalDuration) {
          notifyTimeListeners(0);
          setCurrentTime(0);
          setIsPlaying(false);
          stopAudioPreview();
        } else {
          notifyTimeListeners(newTime);
          animId = requestAnimationFrame(step);
        }
      };

      animId = requestAnimationFrame(step);
    } else {
      stopAudioPreview();
      setCurrentTime(currentTimeRef.current);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      stopAudioPreview();
    };
  }, [isPlaying]);

  const handlePlayToggle = () => {
    // Unlock AudioContext immediately inside direct user click gesture
    getAudioContext();
    setIsPlayingVoiceOnly(false);
    if (currentTimeRef.current >= totalDuration - 0.2) {
      notifyTimeListeners(0);
      setCurrentTime(0);
    }
    // If quote was edited since last TTS generation, trigger voice refresh too
    if (quote.text.trim() && quote.text.trim() !== lastGeneratedQuoteRef.current.trim()) {
      handleGenerateVoice(quote.text, voice.geminiVoice, voice.rate);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    notifyTimeListeners(time);
    setCurrentTime(time);
    if (isPlaying) {
      // Re-trigger play from new seek time
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 50);
    }
  };

  // Test listen voice narration only
  const handleTestPlayVoice = () => {
    getAudioContext();
    if (isPlayingVoiceOnly) {
      voiceAudioElRef.current?.pause();
      stopBrowserSpeech();
      setIsPlayingVoiceOnly(false);
      return;
    }

    if (voiceAudioElRef.current && quote.text.trim() === lastGeneratedQuoteRef.current.trim()) {
      voiceAudioElRef.current.currentTime = 0;
      voiceAudioElRef.current.volume = Math.min(audioSettings.voiceVolume, 1.0);
      setIsPlayingVoiceOnly(true);
      voiceAudioElRef.current.onended = () => setIsPlayingVoiceOnly(false);
      voiceAudioElRef.current.play().catch(() => {
        speakFemaleBrowserVoice(quote.text, {
          voiceId: voice.geminiVoice,
          volume: audioSettings.voiceVolume,
          rate: voice.rate,
          pitch: voice.pitch,
          onEnd: (info) => {
            setIsPlayingVoiceOnly(false);
            if (info?.naturalEnd && info.actualSeconds >= 1.0) {
              const calibratedDur = Number((info.actualSeconds + 0.14).toFixed(2));
              setWordTimings(
                calculateWordTimings(quote.text, calibratedDur, { leadTime: 0.02, tailTime: 0.14 })
              );
              setVoice((prev) => ({ ...prev, audioDuration: calibratedDur }));
            }
          },
        });
      });
    } else {
      setIsPlayingVoiceOnly(true);
      speakFemaleBrowserVoice(quote.text, {
        voiceId: voice.geminiVoice,
        volume: audioSettings.voiceVolume,
        rate: voice.rate,
        pitch: voice.pitch,
        onEnd: (info) => {
          setIsPlayingVoiceOnly(false);
          if (info?.naturalEnd && info.actualSeconds >= 1.0) {
            const calibratedDur = Number((info.actualSeconds + 0.14).toFixed(2));
            setWordTimings(
              calculateWordTimings(quote.text, calibratedDur, { leadTime: 0.02, tailTime: 0.14 })
            );
            setVoice((prev) => ({ ...prev, audioDuration: calibratedDur }));
          }
        },
      });
    }
  };

  // Test listen background music
  const handlePreviewMusic = (trackId: string) => {
    if (isPlayingMusicOnly) {
      try {
        musicSourceNodeRef.current?.stop();
      } catch (e) {}
      setIsPlayingMusicOnly(false);
      return;
    }

    const ctx = getAudioContext();
    if (musicBufferRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = musicBufferRef.current;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = audioSettings.musicVolume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      musicSourceNodeRef.current = source;
      setIsPlayingMusicOnly(true);
    }
  };

  // Test listen Combined Mix (Voice + BGM)
  const handleTestMix = () => {
    if (isPlayingMixOnly) {
      setIsPlaying(false);
      setIsPlayingMixOnly(false);
    } else {
      setCurrentTime(0);
      setIsPlaying(true);
      setIsPlayingMixOnly(true);
    }
  };

  // Custom music upload handler
  const handleCustomMusicUploaded = async (file: File) => {
    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx = getAudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      musicBufferRef.current = decoded;
      setAudioSettings((prev) => ({
        ...prev,
        musicTrackId: 'custom',
        customAudioName: file.name,
      }));
    } catch (err) {
      console.error('Failed to decode uploaded music:', err);
    }
  };

  // Export 1080p MP4 Trigger
  const handleExportClick = async () => {
    setIsPlaying(false);
    stopBrowserSpeech();
    setIsExportModalOpen(true);
    setIsExporting(true);
    setExportError(null);
    setExportAudioWarning(null);
    if (exportedUrl) {
      URL.revokeObjectURL(exportedUrl);
    }
    setExportedBlob(null);
    setExportedUrl(null);

    const exportFps = durationConfig.fps || 30;
    const trimmedQuote = quote.text.trim();
    const targetVoice: FemaleVoiceId = voice.geminiVoice || 'Kore';
    const targetRate = voice.rate ?? 0.84;
    const expectedVoiceKey = `${trimmedQuote}|${targetVoice}|${targetRate.toFixed(2)}`;

    try {
      const ctx = getAudioContext();
      let resolvedVoiceBuffer: AudioBuffer | undefined =
        voiceBufferRef.current && lastGeneratedVoiceKeyRef.current === expectedVoiceKey
          ? voiceBufferRef.current
          : undefined;
      let resolvedWordTimings = wordTimings;
      let resolvedDuration = totalDuration;

      // Ensure voice audio buffer is freshly available before encoding MP4
      if (audioSettings.voiceVolume > 0 && trimmedQuote && !resolvedVoiceBuffer) {
        setExportProgress({
          progress: 0.03,
          currentFrame: 0,
          totalFrames: 1,
          statusText: 'Menyiapkan audio narasi suara wanita agar video bersuara...',
        });

        const ttsResult = await generateFemaleVoiceTTS(trimmedQuote, {
          voiceName: targetVoice,
          style: 'Warm, emotionally resonant female voice tailored for quotes',
          rate: targetRate,
          audioContext: ctx,
        });

        if (ttsResult.audioBuffer) {
          resolvedVoiceBuffer = ttsResult.audioBuffer;
          voiceBufferRef.current = ttsResult.audioBuffer;
          lastGeneratedQuoteRef.current = trimmedQuote;
          lastGeneratedVoiceKeyRef.current = expectedVoiceKey;
          resolvedWordTimings = ttsResult.wordTimings;
          setWordTimings(ttsResult.wordTimings);

          if (durationConfig.mode === 'auto') {
            resolvedDuration = Math.max(Number((ttsResult.duration + 0.9).toFixed(1)), 4.0);
            setTotalDuration(resolvedDuration);
          }

          if (voiceUrlRef.current && voiceUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(voiceUrlRef.current);
          }
          voiceUrlRef.current = ttsResult.audioUrl || null;
          if (ttsResult.audioUrl) {
            voiceAudioElRef.current = new Audio(ttsResult.audioUrl);
            voiceAudioElRef.current.preload = 'auto';
          }
          setVoice((prev) => ({
            ...prev,
            provider: ttsResult.provider,
            audioUrl: ttsResult.audioUrl,
            audioDuration: ttsResult.duration,
          }));
        } else {
          // Static hosting fallback (e.g. Cloudflare Pages without API key): capture tab audio if desktop supports it
          setExportProgress({
            progress: 0.04,
            currentFrame: 0,
            totalFrames: 1,
            statusText: 'Merekam suara narasi browser (pilih Tab ini & centang Bagikan Audio Tab)...',
          });

          const capturedBuffer = await captureBrowserVoiceToAudioBuffer(trimmedQuote, {
            voiceId: targetVoice,
            rate: targetRate,
            pitch: voice.pitch,
            audioContext: ctx,
          });

          if (capturedBuffer) {
            const capturedDuration = Math.max(1.2, Number(capturedBuffer.duration.toFixed(2)));
            const syncedTimings = calculateWordTimings(trimmedQuote, capturedDuration, {
              leadTime: 0.02,
              tailTime: 0.14,
            });
            resolvedVoiceBuffer = capturedBuffer;
            voiceBufferRef.current = capturedBuffer;
            lastGeneratedQuoteRef.current = trimmedQuote;
            lastGeneratedVoiceKeyRef.current = expectedVoiceKey;
            resolvedWordTimings = syncedTimings;
            setWordTimings(syncedTimings);

            if (durationConfig.mode === 'auto') {
              resolvedDuration = Math.max(Number((capturedDuration + 0.9).toFixed(1)), 4.0);
              setTotalDuration(resolvedDuration);
            }
            setVoice((prev) => ({
              ...prev,
              provider: 'browser',
              audioDuration: capturedDuration,
            }));
          } else {
            setExportAudioWarning(
              musicBufferRef.current
                ? 'Suara narasi TTS tidak tersedia di server statis ini — video dirender dengan musik latar saja. Untuk suara AI penuh, pasang GEMINI_API_KEY di environment deployment atau izinkan "Bagikan Audio Tab" di browser desktop.'
                : 'Audio narasi tidak dapat direkam secara otomatis di perangkat/hosting ini sehingga video tanpa suara. Pasang GEMINI_API_KEY di environment server atau pilih Musik Latar di tab Musik sebelum render.'
            );
          }
        }
      }

      const blob = await exportReelTo1080pMP4(
        quote.text,
        quote.author,
        quote.translationId,
        background,
        subtitles,
        resolvedWordTimings,
        resolvedDuration,
        {
          voice: resolvedVoiceBuffer,
          music: musicBufferRef.current || undefined,
          voiceVolume: audioSettings.voiceVolume,
          musicVolume: audioSettings.musicVolume,
        },
        (progress) => {
          setExportProgress(progress);
        },
        exportFps
      );

      const url = URL.createObjectURL(blob);
      setExportedBlob(blob);
      setExportedUrl(url);
    } catch (err: any) {
      console.error('Export error:', err);
      const message = err?.message || 'Unknown error';
      setExportError(message);
      setExportProgress({
        progress: 1.0,
        currentFrame: 0,
        totalFrames: 0,
        statusText: `Gagal merender: ${message}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Jump preview to a specific uploaded image slide
  const handlePreviewSlide = (index: number) => {
    setIsPlaying(false);
    const totalSlides = Math.max(background.images.length, index + 1);
    const slideDuration = totalDuration / totalSlides;
    const targetTime = Math.min(Math.max(0, totalDuration - 0.05), index * slideDuration + 0.05);
    notifyTimeListeners(targetTime);
    setCurrentTime(targetTime);
  };

  // Download single uploaded image (or active backdrop) with quote overlaid as 1080p PNG
  const handleDownloadQuoteImage = async (slideIndex?: number) => {
    setIsDownloadingImage(true);
    try {
      let targetIdx = slideIndex;
      if (targetIdx === undefined && background.type === 'images' && background.images.length > 0) {
        const slideDuration = totalDuration / background.images.length;
        targetIdx = Math.max(
          0,
          Math.min(Math.floor(currentTimeRef.current / slideDuration), background.images.length - 1)
        );
      }

      const blob = await exportQuoteImageToPNG(
        quote.text,
        quote.author,
        quote.translationId,
        background,
        subtitles,
        targetIdx ?? 0
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanAuthor = (quote.author || 'ReelQuote').replace(/[^a-zA-Z0-9]/g, '_');
      a.href = url;
      a.download = `Quote_Image_1080p_${cleanAuthor}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to export quote PNG:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Navigation Bar following Top Bar Contract */}
      <Header
        onExportClick={handleExportClick}
        activeTab={activeTab}
        setActiveTab={(tab: any) => setActiveTab(tab)}
        isGeneratingVoice={isGeneratingVoice}
      />

      {/* Main Studio Workspace: 2-Column Split */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive 9:16 Facebook Reel Preview Player */}
        <div className="lg:col-span-5 flex flex-col items-center lg:sticky lg:top-20">
          <ReelPreview
            quoteText={quote.text}
            author={quote.author}
            translationId={quote.translationId}
            background={background}
            subtitles={subtitles}
            wordTimings={wordTimings}
            duration={totalDuration}
            currentTime={currentTime}
            subscribeTime={subscribeTime}
            isPlaying={isPlaying}
            onPlayToggle={handlePlayToggle}
            onSeek={handleSeek}
            videoElement={videoElementRef.current}
            loadedImages={loadedImages}
            durationConfig={durationConfig}
            onDurationChange={(updated) => setDurationConfig(updated)}
            onDownloadImage={() => handleDownloadQuoteImage()}
            isDownloadingImage={isDownloadingImage}
          />
        </div>

        {/* Right Column: Customization Tabs and Controls */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Mobile 4-Tab Switcher (fits cleanly without horizontal scroll) */}
          <div className="grid grid-cols-4 md:hidden gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => setActiveTab('quote')}
              className={`py-2 rounded-lg font-medium transition-colors text-center cursor-pointer ${
                activeTab === 'quote' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Quotes
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`py-2 rounded-lg font-medium transition-colors text-center cursor-pointer ${
                activeTab === 'media' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Foto/Video
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`py-2 rounded-lg font-medium transition-colors text-center cursor-pointer ${
                activeTab === 'voice' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Suara/Font
            </button>
            <button
              onClick={() => setActiveTab('music')}
              className={`py-2 rounded-lg font-medium transition-colors text-center cursor-pointer ${
                activeTab === 'music' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Musik
            </button>
          </div>

          {/* Active Panel Content */}
          {activeTab === 'quote' && (
            <QuoteEditor
              quote={quote}
              onChange={(updated) => setQuote(updated)}
              onGenerateVoice={(text) => handleGenerateVoice(text)}
              isGeneratingVoice={isGeneratingVoice}
            />
          )}

          {activeTab === 'media' && (
            <div className="flex flex-col gap-4">
              <MediaUploader
                background={background}
                onChange={(updated) => setBackground(updated)}
                onVideoLoaded={(videoEl) => {
                  videoElementRef.current = videoEl;
                }}
                defaultQuoteText={quote.text}
                defaultAuthor={quote.author}
                onPreviewSlide={handlePreviewSlide}
                onDownloadImage={handleDownloadQuoteImage}
                isDownloadingImage={isDownloadingImage}
              />
              <DurationSelector
                durationConfig={durationConfig}
                onDurationChange={(updated) => setDurationConfig(updated)}
                voiceDuration={voiceDuration}
                numImages={background.images.length}
                mediaType={background.type}
              />
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="flex flex-col gap-4">
              <VoiceSettingsPanel
                voice={voice}
                onChange={(updated) => {
                  const voiceChanged = updated.geminiVoice !== voice.geminiVoice;
                  const rateChanged = Math.abs((updated.rate ?? 0.84) - (voice.rate ?? 0.84)) > 0.005;

                  setVoice(updated);
                  setAudioSettings((prev) => ({
                    ...prev,
                    voiceVolume: updated.volume,
                  }));

                  if (voiceChanged || rateChanged) {
                    if (isPlaying) {
                      setIsPlaying(false);
                    }
                    if (isPlayingVoiceOnly) {
                      voiceAudioElRef.current?.pause();
                      stopBrowserSpeech();
                      setIsPlayingVoiceOnly(false);
                    }
                    if (rateRegenTimerRef.current !== null) {
                      window.clearTimeout(rateRegenTimerRef.current);
                    }
                    if (voiceChanged) {
                      handleGenerateVoice(quote.text, updated.geminiVoice, updated.rate);
                    } else {
                      rateRegenTimerRef.current = window.setTimeout(() => {
                        rateRegenTimerRef.current = null;
                        handleGenerateVoice(quote.text, updated.geminiVoice, updated.rate);
                      }, 140);
                    }
                  }
                }}
                onGenerateVoice={() => handleGenerateVoice(quote.text, voice.geminiVoice, voice.rate)}
                isGenerating={isGeneratingVoice}
                onTestPlayVoice={handleTestPlayVoice}
                isPlayingVoice={isPlayingVoiceOnly}
                audioDuration={voiceDuration}
              />

              <SubtitleStyleEditor
                subtitles={subtitles}
                onChange={(updated) => setSubtitles(updated)}
              />
            </div>
          )}

          {activeTab === 'music' && (
            <MusicSelector
              audioSettings={audioSettings}
              onChange={(updated) => setAudioSettings(updated)}
              onPreviewMusic={handlePreviewMusic}
              isPlayingMusic={isPlayingMusicOnly}
              activePlayingTrackId={audioSettings.musicTrackId}
              onTestMix={handleTestMix}
              isPlayingMix={isPlayingMixOnly}
              onCustomMusicUploaded={handleCustomMusicUploaded}
            />
          )}
        </div>
      </main>

      {/* 1080p Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        isExporting={isExporting}
        progress={exportProgress}
        exportedBlob={exportedBlob}
        exportedUrl={exportedUrl}
        quoteAuthor={quote.author}
        fps={durationConfig.fps || 30}
        exportError={exportError}
        audioWarning={exportAudioWarning}
        onRetry={handleExportClick}
      />
    </div>
  );
}
