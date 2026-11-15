import * as Mp4Muxer from 'mp4-muxer';
import { BackgroundSettings, SubtitleSettings, WordTiming } from '../types';

export interface ExportProgress {
  progress: number; // 0 to 1
  currentFrame: number;
  totalFrames: number;
  statusText: string;
}

/**
 * Draw background media (video, photo slideshow with Ken Burns, or procedural preset)
 * onto a 1080x1920 canvas.
 */
export type DrawableImage = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

function getDrawableSize(img: DrawableImage): { w: number; h: number } {
  if (img instanceof HTMLImageElement) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  return { w: img.width, h: img.height };
}

function easeInOutQuad(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Draw background media (video, photo slideshow with Ken Burns, or procedural preset)
 * onto a 1080x1920 canvas.
 */
export function drawCanvasBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  totalDuration: number,
  background: BackgroundSettings,
  videoElement?: HTMLVideoElement | null,
  loadedImages?: DrawableImage[]
) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (background.type === 'video' && videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    // Draw video with cover fit
    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;
    const scale = Math.max(width / vWidth, height / vHeight);
    const sw = width / scale;
    const sh = height / scale;
    const sx = (vWidth - sw) / 2;
    const sy = (vHeight - sh) / 2;

    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, width, height);
  } else if (
    background.type === 'images' &&
    loadedImages &&
    loadedImages.some((img) => {
      if (!img) return false;
      const { w, h } = getDrawableSize(img);
      return w > 0 && h > 0;
    })
  ) {
    // Filter to only completely loaded and valid images
    const validImages = loadedImages.filter((img): img is DrawableImage => {
      if (!img) return false;
      const { w, h } = getDrawableSize(img);
      return w > 0 && h > 0;
    });
    const numImages = validImages.length;
    const safeTotalDuration = !totalDuration || isNaN(totalDuration) || totalDuration <= 0 ? 6 : totalDuration;
    const safeTime = !currentTime || isNaN(currentTime) || currentTime < 0 ? 0 : currentTime;
    const slideDuration = Math.max(0.5, safeTotalDuration / Math.max(numImages, 1));
    const rawIndex = Math.floor(safeTime / slideDuration);
    const currentSlideIndex = Math.max(0, Math.min(isNaN(rawIndex) ? 0 : rawIndex, numImages - 1));
    const timeInSlide = safeTime - currentSlideIndex * slideDuration;
    const slideProgress = Math.min(Math.max(timeInSlide / slideDuration, 0), 1);

    const currentImg = validImages[currentSlideIndex] || validImages[0];
    const hasNextSlide = currentSlideIndex < numImages - 1;
    const nextImg = validImages[(currentSlideIndex + 1) % numImages] || currentImg;

    // Smooth alternating zoom direction so slides flow seamlessly without abrupt scale snaps
    const getZoomForSlide = (index: number, progress: number, amplitude: number) => {
      const eased = easeInOutQuad(progress);
      return index % 2 === 0 ? 1.0 + eased * amplitude : 1.0 + (1 - eased) * amplitude;
    };

    // Helper to draw single image cover safely
    const drawCoverImage = (img: DrawableImage | undefined | null, opacity: number, scaleFactor: number) => {
      if (!img) return;
      const { w: imgW, h: imgH } = getDrawableSize(img);
      if (!imgW || !imgH) return;
      ctx.globalAlpha = Math.max(0, Math.min(1, isNaN(opacity) ? 1 : opacity));
      const factor = Math.max(0.1, isNaN(scaleFactor) ? 1.0 : scaleFactor);
      const baseScale = Math.max(width / imgW, height / imgH) * factor;
      const drawW = imgW * baseScale;
      const drawH = imgH * baseScale;
      const dx = (width - drawW) / 2;
      const dy = (height - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    };

    const crossfadeWindow = background.photoTransition === 'fade' ? 0.28 : 0.16;
    const crossfadeStart = 1 - crossfadeWindow;
    const amplitude = background.photoTransition === 'fade' ? 0.04 : 0.1;

    const currentZoom = getZoomForSlide(currentSlideIndex, slideProgress, amplitude);

    if (numImages > 1 && hasNextSlide && slideProgress > crossfadeStart) {
      const fadeRatio = easeInOutQuad((slideProgress - crossfadeStart) / crossfadeWindow);
      const nextInitialZoom = getZoomForSlide(currentSlideIndex + 1, 0, amplitude);
      drawCoverImage(currentImg, 1.0, currentZoom);
      drawCoverImage(nextImg, fadeRatio, nextInitialZoom);
    } else {
      drawCoverImage(currentImg, 1.0, currentZoom);
    }
  } else {
    // Cinematic procedural backdrops (scaled proportionally to canvas width)
    const preset = background.presetId;
    const t = currentTime;
    const bgScale = width / 1080;

    if (preset === 'night-city') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#111827');
      grad.addColorStop(1, '#030712');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Bokeh lights
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.beginPath();
      ctx.arc(width * 0.3 + Math.sin(t * 0.5) * 30 * bgScale, height * 0.4 + Math.cos(t * 0.4) * 20 * bgScale, 180 * bgScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.beginPath();
      ctx.arc(width * 0.7 + Math.cos(t * 0.3) * 40 * bgScale, height * 0.6 + Math.sin(t * 0.5) * 30 * bgScale, 220 * bgScale, 0, Math.PI * 2);
      ctx.fill();
    } else if (preset === 'ocean-gold') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1c1917');
      grad.addColorStop(0.4, '#451a03');
      grad.addColorStop(0.7, '#78350f');
      grad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const horizonY = height * 0.65;
      const shimmer = ctx.createRadialGradient(width / 2, horizonY, 50 * bgScale, width / 2, horizonY, 500 * bgScale);
      shimmer.addColorStop(0, 'rgba(251, 191, 36, 0.3)');
      shimmer.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shimmer;
      ctx.fillRect(0, 0, width, height);
    } else if (preset === 'minimal-luxury') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#18181b');
      grad.addColorStop(0.5, '#27272a');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.3);
      ctx.lineTo(width, height * 0.15);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const nebula = ctx.createRadialGradient(width * 0.5, height * 0.45, 100 * bgScale, width * 0.5, height * 0.45, 600 * bgScale);
      nebula.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
      nebula.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
      nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Draw overlay scrim (dimmer for subtitle contrast)
  const overlayAlpha = background.overlayOpacity ?? 0.45;
  if (overlayAlpha > 0) {
    ctx.globalAlpha = overlayAlpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * Draw English Subtitles and Quote text on 1080x1920 canvas
 */
interface PhraseSegment {
  words: { word: string; globalIdx: number }[];
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Break words into natural 2-4 word speech phrases synchronized with timestamps
 */
export function buildPhraseSegments(words: string[], wordTimings: WordTiming[]): PhraseSegment[] {
  const phrases: PhraseSegment[] = [];
  let currentWords: { word: string; globalIdx: number }[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentWords.push({ word, globalIdx: i });

    const hasPunctuation = /[,;.!?]$/.test(word);
    const reachedWordLimit = currentWords.length >= 4;
    const isLastWord = i === words.length - 1;

    if (hasPunctuation || reachedWordLimit || isLastWord) {
      const firstIdx = currentWords[0].globalIdx;
      const lastIdx = currentWords[currentWords.length - 1].globalIdx;
      const startTime = wordTimings[firstIdx]?.startTime ?? 0;
      const endTime = wordTimings[lastIdx]?.endTime ?? startTime + 1.5;

      phrases.push({
        words: [...currentWords],
        text: currentWords.map((w) => w.word).join(' '),
        startTime,
        endTime,
      });
      currentWords = [];
    }
  }

  return phrases;
}

/**
 * Resolve which quote text, author, and wordTimings apply at currentTime
 * (supports per-image customQuote slides as well as global quote)
 */
export function resolveActiveQuoteForTime(
  currentTime: number,
  totalDuration: number,
  background: BackgroundSettings,
  defaultQuoteText: string,
  defaultAuthor: string,
  defaultWordTimings: WordTiming[]
): { quoteText: string; author: string; wordTimings: WordTiming[] } {
  if (background.type === 'images' && background.images.length > 0) {
    const numImages = background.images.length;
    const safeTotalDuration = !totalDuration || isNaN(totalDuration) || totalDuration <= 0 ? 6 : totalDuration;
    const safeTime = !currentTime || isNaN(currentTime) || currentTime < 0 ? 0 : currentTime;
    const slideDuration = Math.max(0.5, safeTotalDuration / Math.max(numImages, 1));
    const slideIdx = Math.max(0, Math.min(Math.floor(safeTime / slideDuration), numImages - 1));
    const slide = background.images[slideIdx];

    if (slide?.customQuote && slide.customQuote.trim()) {
      const slideStart = slideIdx * slideDuration;
      const slideWords = slide.customQuote.trim().split(/\s+/).filter(Boolean);
      const effectiveSpan = Math.max(0.5, slideDuration * 0.85);
      const wordStep = effectiveSpan / Math.max(slideWords.length, 1);

      const slideTimings: WordTiming[] = slideWords.map((w, idx) => ({
        word: w,
        startTime: slideStart + idx * wordStep,
        endTime: slideStart + (idx + 1) * wordStep,
      }));

      return {
        quoteText: slide.customQuote,
        author: slide.customAuthor !== undefined ? slide.customAuthor : defaultAuthor,
        wordTimings: slideTimings,
      };
    }
  }

  return {
    quoteText: defaultQuoteText,
    author: defaultAuthor,
    wordTimings: defaultWordTimings,
  };
}

const QUOTE_STOPWORDS = new Set([
  'you', 'your', 'yours', 'have', 'has', 'had', 'are', 'was', 'were', 'been', 'being',
  'the', 'and', 'but', 'for', 'nor', 'not', 'yet', 'so', 'of', 'in', 'on', 'at', 'to',
  'from', 'by', 'with', 'over', 'under', 'into', 'onto', 'this', 'that', 'these', 'those',
  'it', 'its', 'is', 'am', 'be', 'will', 'would', 'shall', 'should', 'can', 'could', 'may',
  'might', 'must', 'a', 'an', 'as', 'if', 'or', 'than', 'then', 'they', 'them', 'their',
  'we', 'our', 'us', 'he', 'she', 'his', 'her', 'who', 'what', 'when', 'where', 'why',
  'how', 'all', 'any', 'some', 'no', 'only', 'just', 'very', 'too', 'also', 'even',
]);

function selectQuoteHighlightIndices(words: string[]): Set<number> {
  if (words.length === 0) return new Set();
  if (words.length === 1) return new Set([0]);

  const scored = words.map((word, idx) => {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    let score = 0;
    if (clean && !QUOTE_STOPWORDS.has(clean)) {
      score += clean.length;
    }
    if (/[.!?]$/.test(word)) score += 3;
    if (idx === words.length - 1) score += 2;
    return { idx, score };
  });

  const targetCount = Math.max(1, Math.min(Math.floor(words.length / 2), Math.round(words.length * 0.36)));
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);
  const selected = new Set<number>();

  for (const item of sorted) {
    if (selected.size >= targetCount) break;
    if (item.score > 0 || selected.size === 0) {
      selected.add(item.idx);
    }
  }

  return selected;
}

/**
 * Export a single high-resolution 1080x1920 PNG image with quote overlaid on the uploaded image
 */
export async function exportQuoteImageToPNG(
  quoteText: string,
  author: string,
  translationId: string,
  background: BackgroundSettings,
  subtitles: SubtitleSettings,
  slideIndex = 0
): Promise<Blob> {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let drawImages: DrawableImage[] = [];
  let effectiveBackground = background;
  let effectiveQuote = quoteText;
  let effectiveAuthor = author;

  if (background.type === 'images' && background.images.length > 0) {
    const safeIdx = Math.max(0, Math.min(slideIndex, background.images.length - 1));
    const targetSlide = background.images[safeIdx];
    if (targetSlide?.customQuote && targetSlide.customQuote.trim()) {
      effectiveQuote = targetSlide.customQuote;
      effectiveAuthor = targetSlide.customAuthor !== undefined ? targetSlide.customAuthor : author;
    }
    drawImages = await prepareOptimizedImages([targetSlide]);
    effectiveBackground = {
      ...background,
      images: [targetSlide],
    };
  }

  drawCanvasBackground(ctx, WIDTH, HEIGHT, 0.5, 6, effectiveBackground, null, drawImages);

  // For static image export, render clean text-only quote styled in white & yellow without card box
  const imageSubtitles: SubtitleSettings = {
    ...subtitles,
    displayMode: 'quote-card',
    cardTheme: 'none',
    textColor: '#ffffff',
    highlightColor: '#fbbf24',
  };

  const words = effectiveQuote.trim().split(/\s+/).filter(Boolean);
  const fullTimings: WordTiming[] = words.map((w) => ({
    word: w,
    startTime: 10,
    endTime: 11,
  }));
  const staticHighlightIndices = selectQuoteHighlightIndices(words);

  drawCanvasSubtitles(
    ctx,
    WIDTH,
    HEIGHT,
    0,
    effectiveQuote,
    effectiveAuthor,
    translationId,
    imageSubtitles,
    fullTimings,
    staticHighlightIndices
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal membuat gambar PNG'));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Draw English Subtitles and Quote text on 1080x1920 canvas with professional viral styling
 */
export function drawCanvasSubtitles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  quoteText: string,
  author: string,
  translationId: string,
  subtitles: SubtitleSettings,
  wordTimings: WordTiming[],
  staticHighlightIndices?: Set<number>
) {
  ctx.save();

  // Scale font appropriately for 1080p
  const scale = width / 400; // ~2.7 on 1080p
  const maxContentWidth = width * 0.82; // 885px max width on 1080p (guarantees safe margins)

  // Determine vertical center based on position setting
  let centerY = height * 0.48; // center
  if (subtitles.position === 'lower-third') {
    centerY = height * 0.65;
  } else if (subtitles.position === 'bottom') {
    centerY = height * 0.76;
  } else if (subtitles.position === 'top') {
    centerY = height * 0.28;
  }

  // Format words
  let words = quoteText.trim().split(/\s+/).filter(Boolean);
  if (subtitles.textTransform === 'uppercase') {
    words = words.map((w) => w.toUpperCase());
  }

  if (words.length === 0) {
    ctx.restore();
    return;
  }

  const displayMode = subtitles.displayMode || 'dynamic-phrase';
  const cardTheme = subtitles.cardTheme || 'glass';

  // =========================================================================
  // MODE 1: DYNAMIC PHRASE (Viral Reels / CapCut / TikTok Style) - THE DEFAULT
  // =========================================================================
  if (displayMode === 'dynamic-phrase' || displayMode === 'word-pop') {
    const isWordPop = displayMode === 'word-pop';
    const phrases = isWordPop
      ? words.map((w, idx) => ({
          words: [{ word: w, globalIdx: idx }],
          text: w,
          startTime: wordTimings[idx]?.startTime ?? 0,
          endTime: wordTimings[idx]?.endTime ?? 1,
        }))
      : buildPhraseSegments(words, wordTimings);

    // Find the active phrase for current playback time using non-overlapping boundaries
    let activePhrase = phrases.find((p, idx) => {
      const nextStart = phrases[idx + 1]?.startTime;
      const phraseEnd = nextStart !== undefined ? nextStart : p.endTime + 0.35;
      return currentTime >= p.startTime - 0.04 && currentTime < phraseEnd - 0.04;
    });

    // If before first phrase, show first phrase
    if (!activePhrase && phrases.length > 0) {
      if (currentTime < phrases[0].startTime) {
        activePhrase = phrases[0];
      } else {
        // After last phrase, keep last phrase showing
        activePhrase = phrases[phrases.length - 1];
      }
    }

    if (activePhrase) {
      const phraseFontSize = Math.round((isWordPop ? 46 : subtitles.fontSize) * scale);
      const lineHeight = phraseFontSize * 1.35;

      ctx.font = `700 ${phraseFontSize}px '${subtitles.fontFamily}', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Line wrap words in the active phrase if it exceeds maxContentWidth
      const phraseLines: { words: { word: string; globalIdx: number }[]; text: string }[] = [];
      let curLineWords: { word: string; globalIdx: number }[] = [];
      let curLineText = '';

      for (let i = 0; i < activePhrase.words.length; i++) {
        const item = activePhrase.words[i];
        const testText = curLineText ? `${curLineText} ${item.word}` : item.word;
        if (ctx.measureText(testText).width <= maxContentWidth || curLineWords.length === 0) {
          curLineText = testText;
          curLineWords.push(item);
        } else {
          phraseLines.push({ words: curLineWords, text: curLineText });
          curLineText = item.word;
          curLineWords = [item];
        }
      }
      if (curLineWords.length > 0) {
        phraseLines.push({ words: curLineWords, text: curLineText });
      }

      const totalLines = phraseLines.length;
      const totalPhraseHeight = totalLines * lineHeight;
      const startY = centerY - totalPhraseHeight / 2 + lineHeight / 2;

      // Draw stylish Backdrop Container
      if (cardTheme !== 'none') {
        const longestLineWidth = phraseLines.reduce(
          (max, line) => Math.max(max, ctx.measureText(line.text).width),
          0
        );
        const padX = 40 * scale;
        const padY = 24 * scale;
        const boxW = Math.min(longestLineWidth + padX * 2, maxContentWidth + 40 * scale);
        const boxH = totalPhraseHeight + padY * 2;
        const boxX = (width - boxW) / 2;
        const boxY = centerY - boxH / 2;

        ctx.save();
        if (cardTheme === 'glass') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 25 * scale;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 24 * scale);
          ctx.fill();
          ctx.lineWidth = 1.5 * scale;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.stroke();
        } else if (cardTheme === 'solid-dark') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 18 * scale);
          ctx.fill();
          ctx.lineWidth = 2 * scale;
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
          ctx.stroke();
        } else if (cardTheme === 'gradient-pill') {
          const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
          grad.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 30 * scale);
          ctx.fill();
          ctx.lineWidth = 1 * scale;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render each word in the active phrase
      phraseLines.forEach((lineObj, lineIdx) => {
        const lineY = startY + lineIdx * lineHeight;
        const spaceW = Math.max(ctx.measureText(' ').width * 1.18, phraseFontSize * 0.28);
        const wordMeasures = lineObj.words.map((item) => ({
          ...item,
          width: ctx.measureText(item.word).width,
        }));
        const totalLineWidth =
          wordMeasures.reduce((sum, item) => sum + item.width, 0) +
          (wordMeasures.length - 1) * spaceW;

        let curX = width / 2 - totalLineWidth / 2;

        wordMeasures.forEach((item) => {
          const timing = wordTimings[item.globalIdx];
          const nextTiming = wordTimings[item.globalIdx + 1];
          const activeEnd = nextTiming ? nextTiming.startTime : (timing ? timing.endTime + 0.18 : 0);
          const isActive =
            timing &&
            currentTime >= timing.startTime - 0.04 &&
            currentTime < activeEnd - 0.02;
          const isPast = timing && currentTime >= activeEnd - 0.02;

          const wordCenterX = curX + item.width / 2;

          ctx.save();

          // Contrast drop shadow & dark outline
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 18 * scale;
          ctx.shadowOffsetY = 4 * scale;

          ctx.lineWidth = 6 * scale;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
          ctx.lineJoin = 'round';
          ctx.strokeText(item.word, wordCenterX, lineY);

          if (isActive) {
            // Glowing Highlighted Spoken Word
            ctx.shadowColor = subtitles.highlightColor;
            ctx.shadowBlur = 28 * scale;
            ctx.fillStyle = subtitles.highlightColor;

            // Micro pop animation
            ctx.translate(wordCenterX, lineY);
            ctx.scale(1.09, 1.09);
            ctx.fillText(item.word, 0, 0);
          } else if (isPast) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(item.word, wordCenterX, lineY);
          } else {
            // Upcoming word in phrase
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillText(item.word, wordCenterX, lineY);
          }

          ctx.restore();
          curX += item.width + spaceW;
        });
      });

      // Dedicated Author Attribution below phrase
      if (author && author.trim()) {
        const authorY = centerY + totalPhraseHeight / 2 + (cardTheme !== 'none' ? 48 * scale : 32 * scale);
        ctx.save();
        ctx.font = `600 ${Math.round(phraseFontSize * 0.38)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.92)'; // Soft gold
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10 * scale;
        ctx.fillText(`— ${author.trim().toUpperCase()}`, width / 2, authorY);
        ctx.restore();
      }

      // Indonesian translation pill if enabled
      if (subtitles.showIndonesianSub && translationId && translationId.trim()) {
        const transY = centerY + totalPhraseHeight / 2 + (author ? 85 * scale : 65 * scale);
        ctx.save();
        ctx.font = `italic 500 ${Math.round(phraseFontSize * 0.32)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8 * scale;
        ctx.fillText(`"${translationId.trim()}"`, width / 2, transY);
        ctx.restore();
      }
    }

    ctx.restore();
    return;
  }

  // =========================================================================
  // MODE 2: QUOTE CARD (Luxury Glass Editorial Quote Card)
  // =========================================================================
  // Auto-fit font size based on word count to guarantee 0% overflow
  let baseFontSize = subtitles.fontSize;
  if (words.length > 30) {
    baseFontSize = Math.min(baseFontSize, 24);
  } else if (words.length > 20) {
    baseFontSize = Math.min(baseFontSize, 28);
  } else if (words.length > 14) {
    baseFontSize = Math.min(baseFontSize, 32);
  }

  const scaledFontSize = Math.round(baseFontSize * scale);
  const lineHeight = scaledFontSize * subtitles.lineHeight;

  ctx.font = `700 ${scaledFontSize}px '${subtitles.fontFamily}', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Accurate word-wrap measuring against maxContentWidth
  const lines: { text: string; words: { word: string; globalIdx: number }[] }[] = [];
  let currentWords: { word: string; globalIdx: number }[] = [];
  let currentText = '';

  for (let i = 0; i < words.length; i++) {
    const testText = currentText ? `${currentText} ${words[i]}` : words[i];
    if (ctx.measureText(testText).width <= maxContentWidth || currentWords.length === 0) {
      currentText = testText;
      currentWords.push({ word: words[i], globalIdx: i });
    } else {
      lines.push({ text: currentText, words: currentWords });
      currentText = words[i];
      currentWords = [{ word: words[i], globalIdx: i }];
    }
  }
  if (currentWords.length > 0) {
    lines.push({ text: currentText, words: currentWords });
  }

  const totalLines = lines.length;
  const totalTextHeight = totalLines * lineHeight;
  const startY = centerY - totalTextHeight / 2 + lineHeight / 2;

  // Draw Luxury Card Background (skipped when cardTheme === 'none', e.g., text-only PNG download)
  if (cardTheme !== 'none') {
    const cardPadY = 40 * scale;
    const cardW = Math.min(width * 0.88, 940);
    const authorExtraHeight = author ? 55 * scale : 20 * scale;
    const transExtraHeight = subtitles.showIndonesianSub && translationId ? 65 * scale : 0;
    const cardH = totalTextHeight + cardPadY * 2 + authorExtraHeight + transExtraHeight + 25 * scale;
    const cardX = (width - cardW) / 2;
    const cardY = centerY - cardH / 2;

    ctx.save();
    if (cardTheme === 'solid-dark') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 28 * scale;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24 * scale);
      ctx.fill();
      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
      ctx.stroke();
    } else if (cardTheme === 'gradient-pill') {
      const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      grad.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 30 * scale;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 32 * scale);
      ctx.fill();
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();
    } else {
      // Glass Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 30 * scale;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 28 * scale);
      ctx.fill();
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
    }

    // Decorative Golden Opening Quote Mark at Top Left inside card
    if (subtitles.showQuoteMarks) {
      ctx.font = `italic 700 ${Math.round(scaledFontSize * 2.2)}px 'Playfair Display', serif`;
      ctx.fillStyle = subtitles.highlightColor || 'rgba(251, 191, 36, 0.85)';
      ctx.textAlign = 'left';
      ctx.fillText('“', cardX + 30 * scale, cardY + 50 * scale);
    }
    ctx.restore();
  }

  // Reset text alignment for quote lines
  ctx.textAlign = 'center';
  ctx.font = `700 ${scaledFontSize}px '${subtitles.fontFamily}', sans-serif`;

  // Draw Lines of the Quote
  lines.forEach((lineObj, lineIdx) => {
    const lineY = startY + lineIdx * lineHeight;
    const spaceW = Math.max(ctx.measureText(' ').width * 1.15, scaledFontSize * 0.28);
    const wordMeasures = lineObj.words.map((item) => ({
      ...item,
      width: ctx.measureText(item.word).width,
    }));
    const totalLineWidth =
      wordMeasures.reduce((sum, item) => sum + item.width, 0) +
      (wordMeasures.length - 1) * spaceW;

    let curX = width / 2 - totalLineWidth / 2;

    wordMeasures.forEach((item) => {
      const isStaticHighlight = staticHighlightIndices?.has(item.globalIdx) ?? false;
      const timing = wordTimings[item.globalIdx];
      const nextTiming = wordTimings[item.globalIdx + 1];
      const activeEnd = nextTiming ? nextTiming.startTime : (timing ? timing.endTime + 0.18 : 0);
      const isActive =
        !staticHighlightIndices &&
        timing &&
        currentTime >= timing.startTime - 0.04 &&
        currentTime < activeEnd - 0.02;
      const isPast = !staticHighlightIndices && timing && currentTime >= activeEnd - 0.02;

      const wordCenterX = curX + item.width / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 14 * scale;
      ctx.shadowOffsetY = 3 * scale;

      ctx.lineWidth = 5 * scale;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.lineJoin = 'round';
      ctx.strokeText(item.word, wordCenterX, lineY);

      if (isStaticHighlight) {
        ctx.fillStyle = subtitles.highlightColor || '#fbbf24';
        ctx.fillText(item.word, wordCenterX, lineY);
      } else if (isActive) {
        ctx.shadowColor = subtitles.highlightColor;
        ctx.shadowBlur = 24 * scale;
        ctx.fillStyle = subtitles.highlightColor;
        ctx.translate(wordCenterX, lineY);
        ctx.scale(1.06, 1.06);
        ctx.fillText(item.word, 0, 0);
      } else if (isPast) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.word, wordCenterX, lineY);
      } else {
        ctx.fillStyle = staticHighlightIndices ? '#ffffff' : 'rgba(255, 255, 255, 0.92)';
        ctx.fillText(item.word, wordCenterX, lineY);
      }

      ctx.restore();
      curX += item.width + spaceW;
    });
  });

  // Author Attribution (skip hairline card divider when cardTheme === 'none')
  if (author && author.trim()) {
    const dividerY = startY + totalLines * lineHeight + 18 * scale;
    ctx.save();
    if (cardTheme !== 'none') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 80 * scale, dividerY);
      ctx.lineTo(width / 2 + 80 * scale, dividerY);
      ctx.stroke();
    }

    const authorY = cardTheme !== 'none' ? dividerY + 28 * scale : startY + totalLines * lineHeight + 22 * scale;
    ctx.font = `600 ${Math.round(scaledFontSize * 0.42)}px 'Outfit', sans-serif`;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10 * scale;
    ctx.fillText(`— ${author.trim().toUpperCase()}`, width / 2, authorY);
    ctx.restore();
  }

  // Indonesian Translation Note
  if (subtitles.showIndonesianSub && translationId && translationId.trim()) {
    const transY =
      startY +
      totalLines * lineHeight +
      (author ? (cardTheme !== 'none' ? 75 * scale : 58 * scale) : 38 * scale);
    ctx.save();
    ctx.font = `italic 500 ${Math.round(scaledFontSize * 0.34)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8 * scale;
    ctx.fillText(`"${translationId.trim()}"`, width / 2, transY);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Pre-scale large photo assets into optimal 1080p-friendly canvases so per-frame drawing is fast & smooth
 */
async function prepareOptimizedImages(images: { url: string }[]): Promise<DrawableImage[]> {
  const results = await Promise.all(
    images.map(async (imgSlide) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = imgSlide.url;
      });
      if (!img.naturalWidth || !img.naturalHeight) return img;
      try {
        await img.decode();
      } catch {
        // Ignore decode rejection if already loaded
      }

      // Cap working texture to max 2200px so 4K/12MP phone photos render smoothly without stalling
      const maxDim = 2200;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
      const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetW;
      offCanvas.height = targetH;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        offCtx.drawImage(img, 0, 0, targetW, targetH);
        return offCanvas;
      }
      return img;
    })
  );
  return results;
}

/**
 * Seek an HTMLVideoElement deterministically and wait for the decoded frame ('seeked')
 */
async function seekVideoTo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  const safeDuration = video.duration && isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
  const clampedTime = Math.max(0, Math.min(targetTime, Math.max(0, safeDuration - 0.03)));

  if (Math.abs(video.currentTime - clampedTime) < 0.002 && video.readyState >= 2) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      resolve();
    };
    const onSeeked = () => done();
    const onError = () => done();
    const timeoutId = window.setTimeout(done, 450);

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = clampedTime;
  });
}

/**
 * Select the highest-compatibility H.264 VideoEncoder config without B-frame reordering stutter
 */
async function selectVideoEncoderConfig(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<any | null> {
  const VideoEncoderCtor = (window as any).VideoEncoder;
  if (!VideoEncoderCtor) return null;

  // Prefer Constrained Baseline / Baseline (no B-frames) and realtime latencyMode (disables B-frames in WebCodecs)
  const candidates = [
    { codec: 'avc1.42E02A', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.42002A', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.42E028', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.4d002a', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.64002a', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.640028', width, height, bitrate, framerate: fps, latencyMode: 'realtime', avc: { format: 'avc' } },
    { codec: 'avc1.42E02A', width, height, bitrate, framerate: fps },
    { codec: 'avc1.640028', width, height, bitrate, framerate: fps },
  ];

  for (const cfg of candidates) {
    try {
      const support = await VideoEncoderCtor.isConfigSupported(cfg);
      if (support?.supported) {
        return support.config || cfg;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

/**
 * Select supported AudioEncoder config (AAC-LC preferred, Opus fallback supported by MP4)
 */
async function selectAudioEncoderConfig(
  numberOfChannels: number,
  sampleRate: number
): Promise<{ muxerCodec: 'aac' | 'opus'; config: any } | null> {
  const AudioEncoderCtor = (window as any).AudioEncoder;
  if (!AudioEncoderCtor) return null;

  // Prefer AAC-LC (mp4a.40.2) across bitrates so Android/iOS/Windows/Facebook Reels
  // always decode audio inside MP4 cleanly before falling back to Opus.
  const aacBitrates: Array<number | undefined> = [192_000, 128_000, 96_000, undefined];
  const candidates: { muxerCodec: 'aac' | 'opus'; config: any }[] = [];

  for (const bitrate of aacBitrates) {
    const base = bitrate
      ? { codec: 'mp4a.40.2', numberOfChannels, sampleRate, bitrate }
      : { codec: 'mp4a.40.2', numberOfChannels, sampleRate };
    candidates.push({
      muxerCodec: 'aac',
      config: { ...base, aac: { format: 'aac' } },
    });
    candidates.push({
      muxerCodec: 'aac',
      config: base,
    });
  }

  candidates.push({
    muxerCodec: 'opus',
    config: { codec: 'opus', numberOfChannels, sampleRate, bitrate: 160_000 },
  });
  candidates.push({
    muxerCodec: 'opus',
    config: { codec: 'opus', numberOfChannels, sampleRate, bitrate: 128_000 },
  });

  for (const item of candidates) {
    try {
      const support = await AudioEncoderCtor.isConfigSupported(item.config);
      if (support?.supported) {
        return { muxerCodec: item.muxerCodec, config: support.config || item.config };
      }
    } catch {
      // Try next
    }
  }
  return null;
}

/**
 * High performance 1080p (1080x1920) MP4 Exporter
 */
export async function exportReelTo1080pMP4(
  quoteText: string,
  author: string,
  translationId: string,
  background: BackgroundSettings,
  subtitles: SubtitleSettings,
  wordTimings: WordTiming[],
  totalDuration: number,
  audioBuffers: {
    voice?: AudioBuffer;
    music?: AudioBuffer;
    voiceVolume: number;
    musicVolume: number;
  },
  onProgress: (p: ExportProgress) => void,
  fps: 30 | 60 = 30
): Promise<Blob> {
  const WIDTH = 1080;
  const HEIGHT = 1920;
  const totalFrames = Math.max(Math.ceil(totalDuration * fps), fps);

  // Wait for custom fonts so text metrics & rendering never flicker
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Setup offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Pre-load & optimize images if photo mode
  let loadedImages: DrawableImage[] = [];
  if (background.type === 'images' && background.images.length > 0) {
    onProgress({
      progress: 0.05,
      currentFrame: 0,
      totalFrames,
      statusText: 'Mengoptimalkan foto untuk render 1080p yang mulus...',
    });
    loadedImages = await prepareOptimizedImages(background.images);
  }

  // Pre-load video element if video mode (mounted invisibly in DOM so browsers don't throttle decoder)
  let videoEl: HTMLVideoElement | null = null;
  if (background.type === 'video' && background.videoUrl) {
    onProgress({
      progress: 0.08,
      currentFrame: 0,
      totalFrames,
      statusText: 'Menyiapkan frame video background 1080p...',
    });

    videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.src = background.videoUrl;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.style.position = 'fixed';
    videoEl.style.left = '-9999px';
    videoEl.style.top = '-9999px';
    videoEl.style.width = '2px';
    videoEl.style.height = '2px';
    videoEl.style.opacity = '0.001';
    videoEl.style.pointerEvents = 'none';
    document.body.appendChild(videoEl);

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      videoEl!.addEventListener('canplay', done, { once: true });
      videoEl!.addEventListener('loadeddata', done, { once: true });
      videoEl!.addEventListener('error', done, { once: true });
      window.setTimeout(done, 3000);
      videoEl!.load();
    });
    videoEl.pause();
  }

  try {
    // Mix audio into combined AudioBuffer
    onProgress({
      progress: 0.12,
      currentFrame: 0,
      totalFrames,
      statusText: 'Memadukan audio narasi suara wanita & musik latar...',
    });

    const sampleRate = 48000; // 48kHz aligns natively with AAC & Opus in MP4
    const totalAudioSamples = Math.max(1, Math.ceil(totalDuration * sampleRate));
    const audioContext = new OfflineAudioContext(2, totalAudioSamples, sampleRate);

    // Master limiter so mixed voice + BGM stays loud, clear, and clip-free in AAC/Opus
    const masterLimiter = audioContext.createDynamicsCompressor();
    masterLimiter.threshold.setValueAtTime(-1.5, 0);
    masterLimiter.knee.setValueAtTime(3.0, 0);
    masterLimiter.ratio.setValueAtTime(12.0, 0);
    masterLimiter.attack.setValueAtTime(0.002, 0);
    masterLimiter.release.setValueAtTime(0.08, 0);
    masterLimiter.connect(audioContext.destination);

    if (audioBuffers.voice) {
      const voiceSource = audioContext.createBufferSource();
      voiceSource.buffer = audioBuffers.voice;
      const voiceGain = audioContext.createGain();
      voiceGain.gain.setValueAtTime(Math.max(0, audioBuffers.voiceVolume), 0);
      voiceSource.connect(voiceGain);
      voiceGain.connect(masterLimiter);
      voiceSource.start(0);
    }

    if (audioBuffers.music) {
      const musicSource = audioContext.createBufferSource();
      musicSource.buffer = audioBuffers.music;
      musicSource.loop = true;
      const musicGain = audioContext.createGain();
      const targetVol = Math.max(0.0001, audioBuffers.musicVolume);
      const fadeOutStart = Math.max(0, totalDuration - 0.7);
      musicGain.gain.setValueAtTime(0.0001, 0);
      musicGain.gain.linearRampToValueAtTime(targetVol, Math.min(0.15, totalDuration * 0.1));
      musicGain.gain.setValueAtTime(targetVol, fadeOutStart);
      musicGain.gain.linearRampToValueAtTime(0.0001, totalDuration);
      musicSource.connect(musicGain);
      musicGain.connect(masterLimiter);
      musicSource.start(0);
    }

    const mixedAudioBuffer = await audioContext.startRendering();

    // Check WebCodecs support and select stutter-free codec configs
    const videoConfig = await selectVideoEncoderConfig(WIDTH, HEIGHT, fps, fps === 60 ? 12_000_000 : 8_000_000);
    const audioConfigResult = await selectAudioEncoderConfig(
      mixedAudioBuffer.numberOfChannels,
      mixedAudioBuffer.sampleRate
    );

    if (videoConfig && audioConfigResult) {
      try {
        return await exportWithWebCodecs(
          canvas,
          ctx,
          WIDTH,
          HEIGHT,
          fps,
          totalFrames,
          totalDuration,
          quoteText,
          author,
          translationId,
          background,
          subtitles,
          wordTimings,
          videoEl,
          loadedImages,
          mixedAudioBuffer,
          videoConfig,
          audioConfigResult,
          onProgress
        );
      } catch (err) {
        console.warn('WebCodecs export encountered an error, falling back to MediaRecorder:', err);
      }
    }

    // Fallback: Canvas captureStream + MediaRecorder
    return await exportWithMediaRecorder(
      canvas,
      ctx,
      WIDTH,
      HEIGHT,
      fps,
      totalDuration,
      quoteText,
      author,
      translationId,
      background,
      subtitles,
      wordTimings,
      videoEl,
      loadedImages,
      mixedAudioBuffer,
      onProgress
    );
  } finally {
    if (videoEl) {
      videoEl.pause();
      videoEl.remove();
    }
  }
}

/**
 * WebCodecs + mp4-muxer deterministic 1080p MP4 encoder
 */
async function exportWithWebCodecs(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  totalDuration: number,
  quoteText: string,
  author: string,
  translationId: string,
  background: BackgroundSettings,
  subtitles: SubtitleSettings,
  wordTimings: WordTiming[],
  videoEl: HTMLVideoElement | null,
  loadedImages: DrawableImage[],
  mixedAudioBuffer: AudioBuffer,
  videoConfig: any,
  audioConfigResult: { muxerCodec: 'aac' | 'opus'; config: any },
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: fps,
    },
    audio: {
      codec: audioConfigResult.muxerCodec,
      numberOfChannels: mixedAudioBuffer.numberOfChannels,
      sampleRate: mixedAudioBuffer.sampleRate,
    },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encoderError: any = null;

  const videoEncoder = new (window as any).VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => {
      console.error('VideoEncoder error:', e);
      encoderError = e;
    },
  });

  videoEncoder.configure(videoConfig);

  const audioEncoder = new (window as any).AudioEncoder({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => {
      console.error('AudioEncoder error:', e);
      encoderError = e;
    },
  });

  audioEncoder.configure(audioConfigResult.config);

  // Encode Audio Data into AudioData frames
  const sampleRate = mixedAudioBuffer.sampleRate;
  const numChannels = mixedAudioBuffer.numberOfChannels;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(mixedAudioBuffer.getChannelData(c));
  }

  // 1024 samples for AAC, 960 samples (20ms at 48kHz) for Opus
  const frameSize = audioConfigResult.muxerCodec === 'opus' ? 960 : 1024;
  const totalSamples = mixedAudioBuffer.length;
  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    if (encoderError) throw encoderError;

    const currentChunkSize = Math.min(frameSize, totalSamples - offset);
    const audioDataPlanar = new Float32Array(numChannels * currentChunkSize);

    for (let c = 0; c < numChannels; c++) {
      audioDataPlanar.set(channelData[c].subarray(offset, offset + currentChunkSize), c * currentChunkSize);
    }

    const audioData = new (window as any).AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: currentChunkSize,
      numberOfChannels: numChannels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: audioDataPlanar,
    });

    audioEncoder.encode(audioData);
    audioData.close();

    // Prevent audio queue buildup
    while (audioEncoder.encodeQueueSize > 8) {
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  // Render & Encode each Video Frame deterministically
  for (let frame = 0; frame < totalFrames; frame++) {
    if (encoderError) throw encoderError;

    // Backpressure: wait if encoder queue has pending frames so none are dropped or delayed irregularly
    while (videoEncoder.encodeQueueSize >= 4) {
      if (encoderError) throw encoderError;
      await new Promise((r) => setTimeout(r, 5));
    }

    const currentTime = frame / fps;

    // If background is video, seek cleanly and wait for exact decoded frame
    if (background.type === 'video' && videoEl && videoEl.duration && isFinite(videoEl.duration)) {
      const targetVideoTime = currentTime % videoEl.duration;
      await seekVideoTo(videoEl, targetVideoTime);
    }

    // Clear canvas & set high quality smoothing
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw background
    drawCanvasBackground(ctx, width, height, currentTime, totalDuration, background, videoEl, loadedImages);

    // Resolve quote for current slide/time and draw subtitles
    const resolved = resolveActiveQuoteForTime(
      currentTime,
      totalDuration,
      background,
      quoteText,
      author,
      wordTimings
    );
    drawCanvasSubtitles(
      ctx,
      width,
      height,
      currentTime,
      resolved.quoteText,
      resolved.author,
      translationId,
      subtitles,
      resolved.wordTimings
    );

    // Exact integer microsecond timestamp & duration to guarantee uniform frame pacing
    const timestampUs = Math.round((frame * 1_000_000) / fps);
    const nextTimestampUs = Math.round(((frame + 1) * 1_000_000) / fps);
    const frameDurationUs = Math.max(1, nextTimestampUs - timestampUs);

    const videoFrame = new (window as any).VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: frameDurationUs,
    });

    // Insert keyframe every 1 second for instant scrubbing & smooth social media playback
    const isKeyframe = frame % fps === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    const progressRatio = 0.15 + ((frame + 1) / totalFrames) * 0.8;
    if (frame % 3 === 0 || frame === totalFrames - 1) {
      onProgress({
        progress: progressRatio,
        currentFrame: frame + 1,
        totalFrames,
        statusText: `Merender 1080p ${fps}fps frame ${frame + 1} / ${totalFrames} (${Math.round(progressRatio * 100)}%)...`,
      });
    }

    // Yield regularly to keep UI responsive
    if (frame % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress({
    progress: 0.96,
    currentFrame: totalFrames,
    totalFrames,
    statusText: 'Menyelesaikan encoding MP4 & sinkronisasi audio...',
  });

  await videoEncoder.flush();
  await audioEncoder.flush();
  if (encoderError) throw encoderError;

  videoEncoder.close();
  audioEncoder.close();
  muxer.finalize();

  onProgress({
    progress: 1.0,
    currentFrame: totalFrames,
    totalFrames,
    statusText: '1080p MP4 Siap Didownload!',
  });

  const buffer = muxer.target.buffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

/**
 * MediaRecorder fallback with manual deterministic frame-request pacing
 */
async function exportWithMediaRecorder(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fps: number,
  totalDuration: number,
  quoteText: string,
  author: string,
  translationId: string,
  background: BackgroundSettings,
  subtitles: SubtitleSettings,
  wordTimings: WordTiming[],
  videoEl: HTMLVideoElement | null,
  loadedImages: DrawableImage[],
  mixedAudioBuffer: AudioBuffer,
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  // Use manual captureStream(0) when requestFrame() is supported, otherwise captureStream(fps)
  let canvasStream = canvas.captureStream(0);
  let videoTrack = canvasStream.getVideoTracks()[0] as any;
  if (!videoTrack || typeof videoTrack.requestFrame !== 'function') {
    canvasStream = canvas.captureStream(fps);
    videoTrack = canvasStream.getVideoTracks()[0] as any;
  }

  // Play mixed audio through real-time AudioContext destination
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => {});
  }
  const audioSource = audioContext.createBufferSource();
  audioSource.buffer = mixedAudioBuffer;
  const destination = audioContext.createMediaStreamDestination();
  audioSource.connect(destination);

  // Combine canvas video track + destination audio track
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  // Determine supported mimeType
  const mimeCandidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  if (videoEl && background.type === 'video') {
    videoEl.loop = true;
    videoEl.currentTime = 0;
    await videoEl.play().catch(() => {});
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (videoEl) videoEl.pause();
      audioContext.close();
      const outputBlob = new Blob(chunks, { type: mimeType.includes('mp4') ? 'video/mp4' : 'video/webm' });
      resolve(outputBlob);
    };

    recorder.onerror = (e) => reject(e);

    recorder.start(100);
    audioSource.start(0);

    const startTime = performance.now();
    const durationMs = totalDuration * 1000;
    const frameIntervalMs = 1000 / fps;
    let lastFrameTime = -frameIntervalMs;

    const renderLoop = () => {
      const elapsed = performance.now() - startTime;
      const currentTime = elapsed / 1000;

      if (elapsed >= durationMs) {
        recorder.stop();
        return;
      }

      if (elapsed - lastFrameTime >= frameIntervalMs * 0.85) {
        lastFrameTime = elapsed;
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        drawCanvasBackground(ctx, width, height, currentTime, totalDuration, background, videoEl, loadedImages);
        const resolved = resolveActiveQuoteForTime(
          currentTime,
          totalDuration,
          background,
          quoteText,
          author,
          wordTimings
        );
        drawCanvasSubtitles(
          ctx,
          width,
          height,
          currentTime,
          resolved.quoteText,
          resolved.author,
          translationId,
          subtitles,
          resolved.wordTimings
        );

        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          videoTrack.requestFrame();
        }
      }

      const progress = Math.min(0.98, elapsed / durationMs);
      onProgress({
        progress,
        currentFrame: Math.floor(currentTime * fps),
        totalFrames: Math.ceil(totalDuration * fps),
        statusText: `Merender 1080p stream (${Math.round(progress * 100)}%)...`,
      });

      requestAnimationFrame(renderLoop);
    };

    requestAnimationFrame(renderLoop);
  });
}
