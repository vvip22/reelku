export interface QuoteData {
  text: string;
  author: string;
  translationId: string;
  category?: string;
  duration?: number;
}

export type MediaSourceType = 'video' | 'images' | 'preset';

export interface ImageSlide {
  id: string;
  url: string;
  name: string;
  duration: number; // in seconds
  customQuote?: string;
  customAuthor?: string;
}

export interface PresetBackdrop {
  id: string;
  name: string;
  description: string;
  type: 'gradient-cinematic' | 'night-city' | 'ocean-gold' | 'minimal-luxury' | 'deep-stars';
  dominantColor: string;
}

export interface BackgroundSettings {
  type: MediaSourceType;
  videoUrl?: string;
  videoDuration?: number;
  images: ImageSlide[];
  presetId: string;
  overlayOpacity: number; // 0 to 1 scrim darkness
  blurBackground: boolean;
  photoTransition: 'kenburns' | 'fade' | 'slide';
}

export type FemaleVoiceId = 'Kore' | 'Aoede' | 'Zephyr' | 'Leda';

export interface VoiceSettings {
  provider: 'gemini' | 'browser';
  geminiVoice: FemaleVoiceId;
  style: string;
  rate: number; // 0.70 to 1.15
  pitch: number; // 0.8 to 1.2
  volume: number; // 0 to 1.5
  audioUrl?: string;
  audioDuration?: number;
}

export type SubtitleDisplayMode = 'dynamic-phrase' | 'quote-card' | 'word-pop';
export type SubtitleCardTheme = 'glass' | 'none' | 'solid-dark' | 'gradient-pill';

export interface SubtitleSettings {
  displayMode: SubtitleDisplayMode;
  cardTheme: SubtitleCardTheme;
  fontFamily: 'Playfair Display' | 'Outfit' | 'Cinzel' | 'Bebas Neue' | 'Montserrat' | 'Caveat' | 'Oswald' | 'Plus Jakarta Sans';
  fontSize: number; // 24 to 56
  textColor: string;
  highlightColor: string;
  styleMode: 'karaoke' | 'minimal' | 'boxed' | 'glow';
  position: 'center' | 'lower-third' | 'bottom' | 'top';
  textTransform: 'uppercase' | 'none' | 'capitalize';
  showIndonesianSub: boolean;
  showQuoteMarks: boolean;
  boxOpacity: number; // 0 to 1
  lineHeight: number;
  maxWordsPerLine: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  category: string;
  type: 'procedural' | 'custom';
  presetStyle?: 'piano' | 'lofi' | 'ambient' | 'strings' | 'drone';
  customUrl?: string;
  customFile?: File;
}

export interface AudioSettings {
  musicTrackId: string;
  musicVolume: number; // 0 to 1
  voiceVolume: number; // 0 to 1.5
  customAudioUrl?: string;
  customAudioName?: string;
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

export type DurationMode = 'auto' | 'custom';

export interface DurationConfig {
  mode: DurationMode;
  customDuration: number;
  fps?: 30 | 60;
}

