/**
 * Royalty-free procedural background music synthesizer using Web Audio API.
 * Produces clean, rich, looped background music textures tailored for Facebook Reels quotes.
 */

// Generate an offline AudioBuffer with harmonious musical loops
export async function generateProceduralMusicBuffer(
  style: 'piano' | 'lofi' | 'ambient' | 'strings' | 'drone',
  durationSeconds: number = 20,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

  if (style === 'piano' || style === 'lofi') {
    // Warm Rhodes / Lofi Piano chord progression (e.g., Fmaj7 - Em7 - Dm7 - Cmaj7)
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
      [164.81, 196.0, 246.94, 293.66], // Em7 (E3, G3, B3, D4)
      [146.83, 174.61, 220.0, 261.63], // Dm7 (D3, F3, A3, C4)
      [130.81, 164.81, 196.0, 246.94], // Cmaj7 (C3, E3, G3, B3)
    ];

    const chordDuration = durationSeconds / chords.length;

    chords.forEach((chord, chordIdx) => {
      const startTime = chordIdx * chordDuration;

      chord.forEach((freq, noteIdx) => {
        // Main note oscillator
        const osc = offlineCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime + noteIdx * 0.04);

        // Sub harmonic
        const subOsc = offlineCtx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

        // Low-pass filter for warm tone
        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, startTime);
        filter.Q.value = 1.2;

        // Envelope gain
        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, startTime + noteIdx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.12, startTime + noteIdx * 0.04 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + chordDuration - 0.1);

        const subGain = offlineCtx.createGain();
        subGain.gain.setValueAtTime(0.0001, startTime);
        subGain.gain.exponentialRampToValueAtTime(0.06, startTime + 0.1);
        subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + chordDuration - 0.1);

        // Stereo pan
        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = (noteIdx - 1.5) * 0.35;

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(offlineCtx.destination);

        osc.start(startTime + noteIdx * 0.04);
        osc.stop(startTime + chordDuration);
        subOsc.start(startTime);
        subOsc.stop(startTime + chordDuration);
      });
    });
  } else if (style === 'strings' || style === 'ambient') {
    // Atmospheric orchestral drone & swells
    const rootNotes = [110.0, 146.83, 164.81, 130.81]; // A2, D3, E3, C3
    const sectionLen = durationSeconds / rootNotes.length;

    rootNotes.forEach((root, idx) => {
      const start = idx * sectionLen;

      [1, 1.5, 2, 2.5].forEach((mult, mIdx) => {
        const osc = offlineCtx.createOscillator();
        osc.type = mIdx % 2 === 0 ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(root * mult, start);

        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, start);
        filter.frequency.exponentialRampToValueAtTime(1600, start + sectionLen * 0.5);
        filter.frequency.exponentialRampToValueAtTime(600, start + sectionLen);

        const gain = offlineCtx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.08, start + sectionLen * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + sectionLen);

        const panner = offlineCtx.createStereoPanner();
        panner.pan.value = (mIdx - 1.5) * 0.4;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(offlineCtx.destination);

        osc.start(start);
        osc.stop(start + sectionLen);
      });
    });
  } else {
    // Ethereal meditation drone
    const baseFreq = 136.1; // Om frequency / C#3
    [1, 1.5, 2, 3, 4].forEach((harmonic, idx) => {
      const osc = offlineCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * harmonic, 0);

      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.0001, 0);
      gain.gain.exponentialRampToValueAtTime(0.1 / (idx + 1), 1.5);
      gain.gain.setValueAtTime(0.1 / (idx + 1), durationSeconds - 2);
      gain.gain.exponentialRampToValueAtTime(0.0001, durationSeconds);

      const panner = offlineCtx.createStereoPanner();
      panner.pan.value = (idx % 2 === 0 ? 0.3 : -0.3);

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(offlineCtx.destination);

      osc.start(0);
      osc.stop(durationSeconds);
    });
  }

  return await offlineCtx.startRendering();
}

// Convert AudioBuffer to WAV blob for easy preview / download
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(wavBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Interleave channel samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Curated music catalog
export const CURATED_TRACKS = [
  {
    id: 'lofi_midnight',
    title: 'Midnight Chill Lofi',
    category: 'Relaxed & Aesthetic',
    type: 'procedural' as const,
    presetStyle: 'lofi' as const,
  },
  {
    id: 'inspirational_piano',
    title: 'Warm Inspirational Piano',
    category: 'Motivation & Success',
    type: 'procedural' as const,
    presetStyle: 'piano' as const,
  },
  {
    id: 'cinematic_strings',
    title: 'Cinematic Ambient Strings',
    category: 'Epic & Emotional',
    type: 'procedural' as const,
    presetStyle: 'strings' as const,
  },
  {
    id: 'deep_drone',
    title: 'Stoic Meditation Drone',
    category: 'Philosophy & Wisdom',
    type: 'procedural' as const,
    presetStyle: 'drone' as const,
  },
];
