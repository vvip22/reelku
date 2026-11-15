import { FemaleVoiceId, WordTiming } from '../types';

export interface TTSResult {
  audioUrl: string;
  duration: number;
  audioBuffer?: AudioBuffer;
  wordTimings: WordTiming[];
  provider: 'gemini' | 'browser';
}

export interface FemaleVoiceProfile {
  id: FemaleVoiceId;
  label: string;
  subtitle: string;
  description: string;
  badge: string;
  browserPitch: number;
  browserRateMult: number;
  geminiStyle: string;
  patterns: RegExp[];
}

export const FEMALE_VOICE_PROFILES: FemaleVoiceProfile[] = [
  {
    id: 'Kore',
    label: 'Kore',
    subtitle: 'Tenang & Berwibawa',
    description: 'Suara wanita hangat, emosional, & berkarisma dengan jeda dramatis untuk quotes Stoic & Life Advice.',
    badge: 'Recommended',
    browserPitch: 1.04,
    browserRateMult: 1.0,
    geminiStyle:
      'Warm, emotionally resonant, cinematic female narrator delivering an inspiring quote with rich vocal warmth, thoughtful dramatic pauses, subtle emphasis on key words, and heartfelt conviction.',
    patterns: [/aria.*natural/i, /google uk english female/i, /samantha/i, /victoria/i, /microsoft zira/i],
  },
  {
    id: 'Aoede',
    label: 'Aoede',
    subtitle: 'Lembut & Puitis',
    description: 'Intonasi halus, puitis, dan menyentuh hati — cocok untuk quotes cinta, healing & refleksi.',
    badge: 'Puitis',
    browserPitch: 1.09,
    browserRateMult: 0.96,
    geminiStyle:
      'Soft, soulful, poetic female storyteller delivering a reflective quote with tender warmth, gentle melodic rise and fall, and deeply moving emotional intimacy.',
    patterns: [/jenny.*natural/i, /moira/i, /karen/i, /google us english/i, /samantha/i],
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    subtitle: 'Jernih & Modern',
    description: 'Vokal cerah, berenergi, dan modern dengan intonasi hidup — cocok untuk mindset & self-growth reels.',
    badge: 'Jernih',
    browserPitch: 1.14,
    browserRateMult: 1.01,
    geminiStyle:
      'Charismatic, vibrant, expressive female narrator delivering an empowering quote with crisp clarity, uplifting energy, dynamic inflection, and engaging rhythm.',
    patterns: [/sonia.*natural/i, /ava/i, /allison/i, /google us english/i, /microsoft zira/i],
  },
  {
    id: 'Leda',
    label: 'Leda',
    subtitle: 'Segar & Ekspresif',
    description: 'Suara muda yang ekspresif, bersemangat, dan menginspirasi — cocok untuk motivasi harian.',
    badge: 'Ekspresif',
    browserPitch: 1.18,
    browserRateMult: 1.03,
    geminiStyle:
      'Bright, empathetic, heartfelt young female voice delivering a motivational quote with natural melodic variation, sincere emotion, and inspiring momentum.',
    patterns: [/libby.*natural/i, /fiona/i, /serena/i, /tessa/i, /google uk english female/i],
  },
];

// Cache raw Gemini AudioBuffers by "voice::text" so speed adjustments happen locally & instantly
const rawGeminiBufferCache = new Map<string, AudioBuffer>();
let speechSessionId = 0;
let geminiBackendStatus: 'unknown' | 'available' | 'unavailable' = 'unknown';

const CALIBRATION_STORAGE_KEY = 'reelquote_voice_calibration_v1';

function clampRate(rate?: number): number {
  const val = typeof rate === 'number' && isFinite(rate) ? rate : 0.84;
  return Math.max(0.7, Math.min(1.15, val));
}

function estimateSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 1;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

function getCalibrationMap(): Record<string, number> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getCalibrationKey(voiceURI: string, rate: number): string {
  const rateBucket = Math.round(clampRate(rate) * 20) / 20; // 0.05 step buckets
  return `${voiceURI || 'default'}::${rateBucket.toFixed(2)}`;
}

export function recordBrowserSpeechCalibration(
  voiceURI: string,
  rate: number,
  text: string,
  actualSeconds: number,
  voiceId: FemaleVoiceId = 'Kore',
  isRemoteVoice?: boolean
): void {
  if (!isFinite(actualSeconds) || actualSeconds < 1.0 || actualSeconds > 60) return;
  const rawEstimate = computeBaseBrowserSpeechDuration(text, rate, voiceId, isRemoteVoice);
  if (rawEstimate <= 0.5) return;

  const measuredRatio = Math.max(0.55, Math.min(1.45, actualSeconds / rawEstimate));
  const map = getCalibrationMap();
  const key = getCalibrationKey(voiceURI, rate);
  const prev = typeof map[key] === 'number' ? map[key] : null;
  const blended = prev !== null ? prev * 0.35 + measuredRatio * 0.65 : measuredRatio;
  map[key] = Number(blended.toFixed(3));

  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function isRemoteOrGoogleVoice(voice?: SpeechSynthesisVoice): boolean {
  if (!voice) return false;
  if (/natural/i.test(voice.name) && /microsoft/i.test(voice.name)) {
    // Edge natural voices fire onboundary cleanly and follow rate well
    return false;
  }
  return !voice.localService || /\bgoogle\b/i.test(voice.name);
}

function getActiveBrowserVoiceSync(voiceId: FemaleVoiceId = 'Kore'): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return undefined;
    return pickFemaleEnglishVoice(voices, voiceId);
  } catch {
    return undefined;
  }
}

function computeBaseBrowserSpeechDuration(
  text: string,
  rate: number = 0.84,
  voiceId: FemaleVoiceId = 'Kore',
  explicitIsRemote?: boolean
): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 2.8;

  const clamped = clampRate(rate);
  const profile = FEMALE_VOICE_PROFILES.find((p) => p.id === voiceId) || FEMALE_VOICE_PROFILES[0];
  const utteranceRate = Math.max(0.65, Math.min(1.2, clamped * profile.browserRateMult));

  let isRemote = explicitIsRemote;
  if (isRemote === undefined) {
    const activeVoice = getActiveBrowserVoiceSync(voiceId);
    isRemote = activeVoice ? isRemoteOrGoogleVoice(activeVoice) : false;
  }

  // Network/Google Chrome voices compress slow rates and speak faster than local OS voices
  const effectiveSpeed = isRemote
    ? Math.max(0.8, 0.48 + 0.52 * utteranceRate)
    : Math.max(0.72, 0.25 + 0.75 * utteranceRate);
  const baseWpm = isRemote ? 166 : 156;

  let pauseSeconds = 0;
  for (const w of words) {
    if (/[,;:—–]$/.test(w)) pauseSeconds += isRemote ? 0.09 : 0.11;
    else if (/[.!?]$/.test(w)) pauseSeconds += isRemote ? 0.18 : 0.22;
  }

  const speakSeconds =
    (words.length / (baseWpm * effectiveSpeed)) * 60 +
    pauseSeconds / Math.max(0.8, effectiveSpeed);

  return Math.max(2.2, Number((speakSeconds + (isRemote ? 0.14 : 0.16)).toFixed(2)));
}

/**
 * Estimate quote speech duration calibrated to the active browser voice & learned device calibration
 */
export function estimateSpeechDuration(
  text: string,
  rate: number = 0.84,
  voiceId: FemaleVoiceId = 'Kore'
): number {
  const activeVoice = getActiveBrowserVoiceSync(voiceId);
  const isRemote = activeVoice ? isRemoteOrGoogleVoice(activeVoice) : false;
  const baseEstimate = computeBaseBrowserSpeechDuration(text, rate, voiceId, isRemote);

  if (activeVoice) {
    const calMap = getCalibrationMap();
    const key = getCalibrationKey(activeVoice.voiceURI, rate);
    const factor = calMap[key];
    if (typeof factor === 'number' && isFinite(factor) && factor > 0.5 && factor < 1.5) {
      return Math.max(2.2, Number((baseEstimate * factor).toFixed(2)));
    }
  }

  return Number(baseEstimate.toFixed(1));
}

/**
 * Generate rhythmic syllable- & punctuation-weighted word timestamps
 */
export function calculateWordTimings(
  text: string,
  totalDuration: number,
  options: { leadTime?: number; tailTime?: number } = {}
): WordTiming[] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const weights = rawWords.map((word) => {
    const cleanLen = word.replace(/[^a-zA-Z0-9]/g, '').length;
    const syllables = estimateSyllables(word);
    let weight = Math.max(1.15, syllables * 1.35 + cleanLen * 0.14);
    if (/[,;:]$/.test(word)) weight += 1.6;
    if (/[—–-]$/.test(word)) weight += 1.3;
    if (/[.!?]$/.test(word)) weight += 2.6;
    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const effectiveDuration = Math.max(totalDuration, 1.5);

  const leadTime = options.leadTime ?? 0.14;
  const tailTime = options.tailTime ?? 0.24;
  let currentStart = leadTime;
  const availableTime = Math.max(effectiveDuration - (leadTime + tailTime), 0.8);

  return rawWords.map((word, idx) => {
    const wordDuration = (weights[idx] / totalWeight) * availableTime;
    const start = currentStart;
    const end = start + wordDuration;
    currentStart = end;
    return {
      word,
      startTime: Number(start.toFixed(3)),
      endTime: Number(end.toFixed(3)),
    };
  });
}

/**
 * Pitch-preserving Hann-windowed WSOLA time-stretch so changing narration speed
 * sounds calm and natural without chipmunk/deep pitch distortion.
 */
export function timeStretchSpeechBuffer(
  ctx: AudioContext,
  input: AudioBuffer,
  rate: number
): AudioBuffer {
  const clamped = clampRate(rate);
  if (Math.abs(clamped - 1.0) < 0.015 || input.length === 0) {
    return input;
  }

  const sampleRate = input.sampleRate;
  const numChannels = input.numberOfChannels;
  const inLen = input.length;

  let winSize = Math.round(sampleRate * 0.042); // 42ms frame
  if (winSize % 2 !== 0) winSize += 1;
  if (inLen <= winSize * 2) return input;

  const halfWin = winSize / 2; // Synthesis hop Hs = halfWin (50% overlap)
  const searchRadius = Math.round(sampleRate * 0.012); // ±12ms correlation search

  const outLen = Math.max(winSize, Math.round(inLen / clamped));
  const outBuffer = ctx.createBuffer(numChannels, outLen, sampleRate);
  const normAcc = new Float32Array(outLen);

  // Periodic Hann window (50% overlapped Hann windows sum to ~1.0)
  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / winSize));
  }

  const ch0 = input.getChannelData(0);
  let prevBestPos = 0;

  for (let outPos = 0; outPos < outLen; outPos += halfWin) {
    const nomPos = Math.round(outPos * clamped);
    let bestPos = Math.min(Math.max(0, nomPos), inLen - winSize);

    if (outPos > 0 && nomPos + winSize < inLen) {
      const natPos = Math.min(prevBestPos + halfWin, inLen - halfWin);
      const minCand = Math.max(0, nomPos - searchRadius);
      const maxCand = Math.min(inLen - winSize, nomPos + searchRadius);

      let bestScore = -Infinity;
      for (let cand = minCand; cand <= maxCand; cand += 2) {
        let dot = 0;
        let energyCand = 0;
        for (let k = 0; k < halfWin; k += 2) {
          const a = ch0[cand + k];
          const b = ch0[natPos + k];
          dot += a * b;
          energyCand += a * a;
        }
        if (energyCand > 1e-7) {
          const score = dot / Math.sqrt(energyCand);
          if (score > bestScore) {
            bestScore = score;
            bestPos = cand;
          }
        }
      }
    }

    const copyLen = Math.min(winSize, outLen - outPos, inLen - bestPos);
    for (let c = 0; c < numChannels; c++) {
      const src = input.getChannelData(c);
      const dst = outBuffer.getChannelData(c);
      for (let i = 0; i < copyLen; i++) {
        dst[outPos + i] += src[bestPos + i] * hann[i];
      }
    }
    for (let i = 0; i < copyLen; i++) {
      normAcc[outPos + i] += hann[i];
    }

    prevBestPos = bestPos;
  }

  // Normalize overlap-add envelope so start/end edges have zero volume dip
  for (let c = 0; c < numChannels; c++) {
    const dst = outBuffer.getChannelData(c);
    for (let i = 0; i < outLen; i++) {
      if (normAcc[i] > 0.01) {
        dst[i] = Math.max(-0.98, Math.min(0.98, dst[i] / normAcc[i]));
      }
    }
  }

  return outBuffer;
}

/**
 * Trim excessive leading/trailing silence, normalize RMS volume, and apply gentle fade-in/out
 * so quote narration always sounds balanced, consistent, and cleanly paced.
 */
function masterQuoteVoiceBuffer(ctx: AudioContext, rawBuffer: AudioBuffer): AudioBuffer {
  const sampleRate = rawBuffer.sampleRate;
  const numChannels = rawBuffer.numberOfChannels;
  const length = rawBuffer.length;
  if (length === 0) return rawBuffer;

  const ch0 = rawBuffer.getChannelData(0);
  const silenceThreshold = 0.008;

  let firstActive = 0;
  while (firstActive < length && Math.abs(ch0[firstActive]) < silenceThreshold) {
    firstActive++;
  }

  let lastActive = length - 1;
  while (lastActive > firstActive && Math.abs(ch0[lastActive]) < silenceThreshold) {
    lastActive--;
  }

  if (firstActive >= lastActive) {
    return rawBuffer;
  }

  const leadSamples = Math.round(sampleRate * 0.14);
  const tailSamples = Math.round(sampleRate * 0.24);
  const startIdx = Math.max(0, firstActive - leadSamples);
  const endIdx = Math.min(length, lastActive + tailSamples);
  const outLength = Math.max(1, endIdx - startIdx);

  let sumSq = 0;
  let activeCount = 0;
  let peak = 0;
  for (let i = firstActive; i <= lastActive; i++) {
    const val = Math.abs(ch0[i]);
    sumSq += val * val;
    if (val > peak) peak = val;
    activeCount++;
  }
  const rms = activeCount > 0 ? Math.sqrt(sumSq / activeCount) : 0.1;
  const targetRms = 0.16;
  const rawGain = rms > 0.001 ? targetRms / rms : 1.0;
  const maxSafeGain = peak > 0 ? 0.92 / peak : 1.5;
  const gain = Math.min(2.4, Math.max(0.7, Math.min(rawGain, maxSafeGain)));

  const outBuffer = ctx.createBuffer(numChannels, outLength, sampleRate);
  const fadeInLen = Math.min(Math.round(sampleRate * 0.035), Math.floor(outLength / 4));
  const fadeOutLen = Math.min(Math.round(sampleRate * 0.09), Math.floor(outLength / 4));

  for (let c = 0; c < numChannels; c++) {
    const src = rawBuffer.getChannelData(c);
    const dst = outBuffer.getChannelData(c);
    for (let i = 0; i < outLength; i++) {
      let sample = src[startIdx + i] * gain;
      if (i < fadeInLen) {
        sample *= i / fadeInLen;
      } else if (i >= outLength - fadeOutLen) {
        sample *= (outLength - 1 - i) / fadeOutLen;
      }
      dst[i] = Math.max(-0.98, Math.min(0.98, sample));
    }
  }

  return outBuffer;
}

/**
 * Apply warm studio podcast EQ + gentle dynamic leveling so Gemini TTS sounds rich and engaging
 */
async function enhanceStudioVoiceBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OfflineCtx || buffer.length === 0) return buffer;

  try {
    const offline = new OfflineCtx(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = buffer;

    const highpass = offline.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;

    const warmth = offline.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.value = 220;
    warmth.Q.value = 0.9;
    warmth.gain.value = 2.2;

    const presence = offline.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 1.0;
    presence.gain.value = 2.5;

    const air = offline.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 9000;
    air.gain.value = 1.6;

    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 12;
    comp.ratio.value = 3.0;
    comp.attack.value = 0.008;
    comp.release.value = 0.16;

    src.connect(highpass);
    highpass.connect(warmth);
    warmth.connect(presence);
    presence.connect(air);
    air.connect(comp);
    comp.connect(offline.destination);

    src.start(0);
    const rendered = await offline.startRendering();

    // Verify rendered audio is non-silent (guards against browser OfflineAudioContext filter quirks)
    const ch = rendered.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < ch.length; i += 8) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
    return peak > 1e-4 ? rendered : buffer;
  } catch {
    return buffer;
  }
}

/**
 * Convert a mono/stereo AudioBuffer to a clean WAV Blob for browser <audio> playback
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const dataBytes = length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Generate female English voice narration with selectable voice persona & calm quote pacing
 */
export async function generateFemaleVoiceTTS(
  text: string,
  options: {
    voiceName?: FemaleVoiceId;
    style?: string;
    rate?: number;
    audioContext?: AudioContext;
  } = {}
): Promise<TTSResult> {
  const voiceName: FemaleVoiceId = options.voiceName || 'Kore';
  const profile = FEMALE_VOICE_PROFILES.find((p) => p.id === voiceName) || FEMALE_VOICE_PROFILES[0];
  const rate = clampRate(options.rate);
  const cacheKey = `${voiceName}::${text.trim()}`;

  if (geminiBackendStatus !== 'unavailable') {
    const ctx =
      options.audioContext ||
      new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    try {
      let rawBuffer = rawGeminiBufferCache.get(cacheKey);

      if (!rawBuffer) {
        const res = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName,
            style: profile.geminiStyle,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          // Static hosting (e.g. Cloudflare Pages) without /api backend — skip future API calls
          geminiBackendStatus = 'unavailable';
        } else if (res.ok) {
          const data = await res.json();
          if (data.success && data.audioBase64) {
            geminiBackendStatus = 'available';
            const binaryString = atob(data.audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            rawBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
            rawGeminiBufferCache.set(cacheKey, rawBuffer);
          }
        }
      }

      if (rawBuffer) {
        const stretchedBuffer = timeStretchSpeechBuffer(ctx, rawBuffer, rate);
        const trimmedBuffer = masterQuoteVoiceBuffer(ctx, stretchedBuffer);
        const masteredBuffer = await enhanceStudioVoiceBuffer(trimmedBuffer);
        const duration = masteredBuffer.duration;
        const wavBlob = audioBufferToWavBlob(masteredBuffer);
        const audioUrl = URL.createObjectURL(wavBlob);
        const wordTimings = calculateWordTimings(text, duration, { leadTime: 0.14, tailTime: 0.24 });

        return {
          audioUrl,
          duration,
          audioBuffer: masteredBuffer,
          wordTimings,
          provider: 'gemini',
        };
      }
    } catch (err) {
      console.warn('Gemini TTS unavailable, using calibrated browser voice:', err);
    }
  }

  // Calibrated Fallback: Browser Web Speech API aligned to voice engine pacing
  const estimatedDuration = estimateSpeechDuration(text, rate, voiceName);
  const wordTimings = calculateWordTimings(text, estimatedDuration, {
    leadTime: 0.02,
    tailTime: 0.14,
  });

  return {
    audioUrl: '',
    duration: estimatedDuration,
    audioBuffer: undefined,
    wordTimings,
    provider: 'browser',
  };
}

/**
 * Pre-warm browser SpeechSynthesis voices early on page mount so Chrome returns voices synchronously on Play
 */
export function prewarmBrowserVoices(onVoicesReady?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const initial = window.speechSynthesis.getVoices();
    if (initial.length > 0) {
      onVoicesReady?.();
    }
    const handleVoices = () => {
      window.speechSynthesis.getVoices();
      onVoicesReady?.();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoices, { once: true });
  } catch {
    // Ignore environments without SpeechSynthesis support
  }
}

async function getAvailableVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return existing;

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 180);
  });
}

function isMaleVoiceName(name: string): boolean {
  return /\b(male|david|mark|george|daniel|alex|fred|tom|oliver|ryan|guy|christopher|rishi|aaron|arthur|james|richard|sean)\b/i.test(
    name
  );
}

/**
 * Pick the most expressive, natural female English browser voice for the chosen persona
 */
function pickFemaleEnglishVoice(
  voices: SpeechSynthesisVoice[],
  voiceId: FemaleVoiceId = 'Kore'
): SpeechSynthesisVoice | undefined {
  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (enVoices.length === 0) return voices[0];

  const profile = FEMALE_VOICE_PROFILES.find((p) => p.id === voiceId) || FEMALE_VOICE_PROFILES[0];

  // 1. Prefer Natural/Neural or Apple Enhanced expressive voices
  const expressiveNatural = enVoices.filter(
    (v) =>
      (/microsoft.*natural/i.test(v.name) ||
        /enhanced|premium|samantha|karen|moira|tessa|fiona|serena|victoria/i.test(v.name)) &&
      !isMaleVoiceName(v.name)
  );
  for (const pattern of profile.patterns) {
    const match = expressiveNatural.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  if (expressiveNatural.length > 0) return expressiveNatural[0];

  // 2. Prefer warm expressive female voices (e.g. Google UK English Female / Google US English)
  //    over robotic legacy desktop SAPI voices (clause-level sync keeps subtitles locked!)
  for (const pattern of profile.patterns) {
    const match = enVoices.find((v) => pattern.test(v.name) && !isMaleVoiceName(v.name));
    if (match) return match;
  }

  const expressiveFallback = [
    /google uk english female/i,
    /google us english/i,
    /samantha/i,
    /victoria/i,
    /karen/i,
    /moira/i,
    /tessa/i,
    /fiona/i,
    /ava/i,
    /allison/i,
    /susan/i,
    /serena/i,
    /microsoft zira/i,
    /female|woman|girl/i,
  ];
  for (const pattern of expressiveFallback) {
    const match = enVoices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  const nonMale = enVoices.find((v) => !isMaleVoiceName(v.name));
  return nonMale || enVoices[0];
}

export interface BrowserSpeechEndInfo {
  naturalEnd: boolean;
  actualSeconds: number;
  voiceURI: string;
  isRemote: boolean;
}

interface ProsodyClause {
  tokens: string[];
  startWordIdx: number;
  pitchMult: number;
  rateMult: number;
}

const CLAUSE_BREAK_WORDS = new Set(['but', 'yet', 'and', 'so', 'because', 'until', 'before']);

/**
 * Split quote words into natural dramatic clauses with expressive pitch/pacing contour
 * so browser voices sound engaging and emotional instead of flat/monotone.
 */
function buildProsodyClauses(slicedWords: string[], startIdx: number): ProsodyClause[] {
  const sanitized = slicedWords.map((w) => {
    const cleaned = w
      .replace(/[*_#`~“”"‘’]/g, '')
      .replace(/[—–]/g, ',')
      .trim();
    return cleaned || ',';
  });

  if (sanitized.length === 0) return [];

  const rawGroups: { tokens: string[]; startWordIdx: number }[] = [];
  let curTokens: string[] = [];
  let curStart = startIdx;

  for (let i = 0; i < sanitized.length; i++) {
    const token = sanitized[i];
    curTokens.push(token);

    const remaining = sanitized.length - 1 - i;
    const isSentenceEnd = /[.!?;:]$/.test(token);
    const isCommaBreak = /,$/.test(token) && curTokens.length >= 3 && remaining >= 3;
    const lowerClean = token.toLowerCase().replace(/[^a-z]/g, '');
    const isLongMidSplit =
      sanitized.length >= 11 &&
      curTokens.length >= 5 &&
      remaining >= 4 &&
      CLAUSE_BREAK_WORDS.has(lowerClean);

    if ((isSentenceEnd || isCommaBreak || isLongMidSplit) && remaining > 0) {
      rawGroups.push({ tokens: curTokens, startWordIdx: curStart });
      curTokens = [];
      curStart = startIdx + i + 1;
    }
  }
  if (curTokens.length > 0) {
    rawGroups.push({ tokens: curTokens, startWordIdx: curStart });
  }

  const total = rawGroups.length;
  return rawGroups.map((group, idx) => {
    let pitchMult = 1.0;
    let rateMult = 1.0;

    if (total === 1) {
      pitchMult = 1.03;
      rateMult = 1.0;
    } else if (idx === 0) {
      // Opening hook: slightly brighter, engaging rise
      pitchMult = 1.045;
      rateMult = 1.02;
    } else if (idx === total - 1) {
      // Closing punchline: warmer, resonant drop + deliberate emphasis
      pitchMult = 0.955;
      rateMult = 0.92;
    } else {
      // Middle narrative clauses: subtle alternating inflection
      pitchMult = idx % 2 === 1 ? 1.015 : 0.99;
      rateMult = 1.0;
    }

    return {
      tokens: group.tokens,
      startWordIdx: group.startWordIdx,
      pitchMult,
      rateMult,
    };
  });
}

/**
 * Speak quote text aloud using expressive female prosody clauses and exact word/clause boundary sync
 */
export async function speakFemaleBrowserVoice(
  text: string,
  options: {
    voiceId?: FemaleVoiceId;
    volume?: number;
    rate?: number;
    pitch?: number;
    startWordIndex?: number;
    onStart?: () => void;
    onWordBoundary?: (globalWordIdx: number) => void;
    onEnd?: (info?: BrowserSpeechEndInfo) => void;
  } = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.({ naturalEnd: false, actualSeconds: 0, voiceURI: '', isRemote: false });
    return false;
  }

  const mySessionId = ++speechSessionId;
  const synth = window.speechSynthesis;
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  const startIdx = Math.max(0, Math.min(options.startWordIndex ?? 0, Math.max(0, rawWords.length - 1)));
  const slicedWords = rawWords.slice(startIdx);

  const clauses = buildProsodyClauses(slicedWords, startIdx);
  if (clauses.length === 0) {
    options.onEnd?.({ naturalEnd: false, actualSeconds: 0, voiceURI: '', isRemote: false });
    return false;
  }

  const wasActive = synth.speaking || synth.pending;
  if (wasActive) {
    synth.cancel();
  }

  // Keep synchronous when voices are already cached so user-gesture audio activation is preserved
  const existingVoices = synth.getVoices();
  const voices = existingVoices.length > 0 ? existingVoices : await getAvailableVoicesAsync();
  if (mySessionId !== speechSessionId) return false;

  const voiceId: FemaleVoiceId = options.voiceId || 'Kore';
  const profile = FEMALE_VOICE_PROFILES.find((p) => p.id === voiceId) || FEMALE_VOICE_PROFILES[0];
  const femaleVoice = pickFemaleEnglishVoice(voices, voiceId);
  const isRemote = isRemoteOrGoogleVoice(femaleVoice);

  const baseRate = clampRate(options.rate);
  const basePitch = options.pitch ?? profile.browserPitch;
  const volume = Math.max(0, Math.min(1, options.volume ?? 1.0));

  let speechStartPerf: number | null = null;
  let notifiedStart = false;

  const utterances = clauses.map((clause, clauseIdx) => {
    const clauseText = clause.tokens.join(' ');
    const tokenStartChars: number[] = [];
    let cursor = 0;
    for (let i = 0; i < clause.tokens.length; i++) {
      tokenStartChars.push(cursor);
      cursor += clause.tokens[i].length + 1;
    }

    const utterance = new SpeechSynthesisUtterance(clauseText);
    utterance.lang = femaleVoice?.lang || 'en-US';
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    utterance.rate = Math.max(0.65, Math.min(1.22, baseRate * profile.browserRateMult * clause.rateMult));
    utterance.pitch = Math.max(0.75, Math.min(1.45, basePitch * clause.pitchMult));
    utterance.volume = volume;

    utterance.onstart = () => {
      if (mySessionId !== speechSessionId) return;
      if (!notifiedStart) {
        notifiedStart = true;
        speechStartPerf = performance.now();
        options.onStart?.();
      }
      // Lock subtitle cleanly to the start of every clause (works even for Google/Android voices without word boundaries)
      options.onWordBoundary?.(clause.startWordIdx);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (mySessionId !== speechSessionId) return;
      if (event.name === 'word' || event.charLength > 0) {
        if (!notifiedStart) {
          notifiedStart = true;
          speechStartPerf = performance.now();
          options.onStart?.();
        }
        const cIdx = event.charIndex;
        let matchedLocalIdx = 0;
        for (let i = 0; i < tokenStartChars.length; i++) {
          if (cIdx >= tokenStartChars[i]) {
            matchedLocalIdx = i;
          } else {
            break;
          }
        }
        options.onWordBoundary?.(clause.startWordIdx + matchedLocalIdx);
      }
    };

    if (clauseIdx === clauses.length - 1) {
      utterance.onend = () => {
        const isStillActive = mySessionId === speechSessionId;
        const endPerf = performance.now();
        const actualSeconds =
          speechStartPerf !== null ? (endPerf - speechStartPerf) / 1000 : 0;

        if (isStillActive && startIdx === 0 && actualSeconds >= 1.0) {
          recordBrowserSpeechCalibration(
            femaleVoice?.voiceURI || '',
            baseRate,
            text,
            actualSeconds,
            voiceId,
            isRemote
          );
        }

        options.onEnd?.({
          naturalEnd: isStillActive,
          actualSeconds,
          voiceURI: femaleVoice?.voiceURI || '',
          isRemote,
        });
      };

      utterance.onerror = () => {
        options.onEnd?.({
          naturalEnd: false,
          actualSeconds: 0,
          voiceURI: femaleVoice?.voiceURI || '',
          isRemote,
        });
      };
    } else {
      utterance.onerror = () => {
        if (mySessionId === speechSessionId) {
          options.onEnd?.({
            naturalEnd: false,
            actualSeconds: 0,
            voiceURI: femaleVoice?.voiceURI || '',
            isRemote,
          });
        }
      };
    }

    return utterance;
  });

  const enqueueAll = () => {
    if (mySessionId !== speechSessionId) return;
    for (const u of utterances) {
      synth.speak(u);
    }
  };

  if (wasActive) {
    window.setTimeout(enqueueAll, 35);
  } else {
    enqueueAll();
  }

  return true;
}

export function stopBrowserSpeech() {
  speechSessionId++;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Fallback for static hosting without a TTS backend: captures browser SpeechSynthesis
 * tab audio via getDisplayMedia (on supported desktop browsers) and decodes it to an AudioBuffer
 * so exported MP4 videos still contain real female voice narration.
 */
export async function captureBrowserVoiceToAudioBuffer(
  text: string,
  options: {
    voiceId?: FemaleVoiceId;
    rate?: number;
    pitch?: number;
    audioContext?: AudioContext;
  } = {}
): Promise<AudioBuffer | null> {
  if (
    typeof window === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function' ||
    typeof MediaRecorder === 'undefined'
  ) {
    return null;
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      // Hint Chrome/Edge to pre-select the current tab for 1-click tab audio capture
      preferCurrentTab: true,
    } as MediaStreamConstraints & { preferCurrentTab?: boolean });
  } catch {
    return null;
  }

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  // Stop unnecessary video capture track immediately; keep only the tab audio track
  stream.getVideoTracks().forEach((t) => t.stop());
  const audioOnlyStream = new MediaStream(audioTracks);

  const chunks: Blob[] = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  try {
    const ctx =
      options.audioContext ||
      new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const recordedBlob = await new Promise<Blob>((resolve, reject) => {
      let finished = false;
      const stopCapture = () => {
        if (finished) return;
        finished = true;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (err) => reject(err);

      recorder.start(100);
      const safetyTimeout = window.setTimeout(stopCapture, 35000);

      speakFemaleBrowserVoice(text, {
        voiceId: options.voiceId,
        volume: 1.0,
        rate: options.rate,
        pitch: options.pitch,
        onEnd: () => {
          window.clearTimeout(safetyTimeout);
          window.setTimeout(stopCapture, 220);
        },
      });
    });

    if (recordedBlob.size < 256) return null;
    const arrayBuf = await recordedBlob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    return masterQuoteVoiceBuffer(ctx, decoded);
  } catch {
    return null;
  } finally {
    stopBrowserSpeech();
    stream.getTracks().forEach((t) => t.stop());
  }
}


