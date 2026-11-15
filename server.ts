import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  apiVersion: 'v1alpha',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API: Generate English quotes for Facebook Reels
app.post('/api/quotes/generate', async (req: Request, res: Response) => {
  try {
    const { category = 'Motivation', count = 4, tone = 'Inspiring' } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Generate ${count} powerful, short, viral quotes in English suitable for Facebook Reels video captions.
Category: ${category}
Tone: ${tone}
Length: 10-25 words per quote (concise, memorable, deeply inspiring).
For each quote, include:
- English quote text
- Famous author or "Unknown"
- Indonesian translation (terjemahan bahasa Indonesia yang mendalam dan mudah dipahami)
- Estimated reading duration in seconds (based on normal speaking speed)`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              quote: { type: Type.STRING, description: 'The inspirational quote in English' },
              author: { type: Type.STRING, description: 'Author or speaker of the quote' },
              translationId: { type: Type.STRING, description: 'Meaning or translation in Indonesian' },
              category: { type: Type.STRING, description: 'Category of the quote' },
              estimatedDuration: { type: Type.NUMBER, description: 'Estimated speech duration in seconds' },
            },
            required: ['quote', 'author', 'translationId', 'category', 'estimatedDuration'],
          },
        },
      },
    });

    const quotesText = response.text || '[]';
    const quotes = JSON.parse(quotesText);
    res.json({ success: true, quotes });
  } catch (error: any) {
    console.error('Error generating quotes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate quotes',
    });
  }
});

// API: Female Text-to-Speech (TTS) using Gemini TTS with expressive vocal direction
const ALLOWED_FEMALE_VOICES = new Set(['Kore', 'Aoede', 'Zephyr', 'Leda']);

const VOICE_STYLE_DIRECTIONS: Record<string, string> = {
  Kore: 'Warm, emotionally resonant, cinematic female narrator delivering an inspiring quote with rich vocal warmth, thoughtful dramatic pauses, subtle emphasis on key words, and heartfelt conviction.',
  Aoede: 'Soft, soulful, poetic female storyteller delivering a reflective quote with tender warmth, gentle melodic rise and fall, and deeply moving emotional intimacy.',
  Zephyr: 'Charismatic, vibrant, expressive female narrator delivering an empowering quote with crisp clarity, uplifting energy, dynamic inflection, and engaging rhythm.',
  Leda: 'Bright, empathetic, heartfelt young female voice delivering a motivational quote with natural melodic variation, sincere emotion, and inspiring momentum.',
};

app.post('/api/tts/generate', async (req: Request, res: Response) => {
  try {
    const { text, voiceName = 'Kore', style } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text parameter is required' });
    }

    const selectedVoiceName = ALLOWED_FEMALE_VOICES.has(voiceName) ? voiceName : 'Kore';
    const voiceStyle =
      typeof style === 'string' && style.trim().length > 0
        ? style.trim()
        : VOICE_STYLE_DIRECTIONS[selectedVoiceName] || VOICE_STYLE_DIRECTIONS.Kore;

    // Preserve natural dramatic pauses (commas, ellipses, em-dashes, periods) for expressive delivery
    let cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
      .replace(/\s*[—–]+\s*/g, '... ')
      .replace(/\r?\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText && !/[.!?]$/.test(cleanText)) {
      cleanText += '.';
    }

    let base64Audio: string | undefined;
    let lastError: any = null;

    for (const modelName of ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: voiceStyle,
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoiceName },
              },
            },
          },
        });
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) break;
      } catch (err) {
        lastError = err;
        // Retry same model without speechMetadata in case an endpoint rejects metadata fields
        try {
          const fallbackResp = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: cleanText }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoiceName },
                },
              },
            },
          });
          base64Audio = fallbackResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) break;
        } catch (innerErr) {
          lastError = innerErr;
        }
      }
    }

    if (!base64Audio) {
      throw lastError || new Error('No audio data received from Gemini TTS model');
    }

    res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in TTS generation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate voice audio',
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ReelQuote Studio API' });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Vite middleware for development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReelQuote Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
