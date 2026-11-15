interface CfFunctionContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

const ALLOWED_FEMALE_VOICES = new Set(['Kore', 'Aoede', 'Zephyr', 'Leda']);

const VOICE_STYLE_DIRECTIONS: Record<string, string> = {
  Kore: 'Warm, emotionally resonant, cinematic female narrator delivering an inspiring quote with rich vocal warmth, thoughtful dramatic pauses, subtle emphasis on key words, and heartfelt conviction.',
  Aoede: 'Soft, soulful, poetic female storyteller delivering a reflective quote with tender warmth, gentle melodic rise and fall, and deeply moving emotional intimacy.',
  Zephyr: 'Charismatic, vibrant, expressive female narrator delivering an empowering quote with crisp clarity, uplifting energy, dynamic inflection, and engaging rhythm.',
  Leda: 'Bright, empathetic, heartfelt young female voice delivering a motivational quote with natural melodic variation, sincere emotion, and inspiring momentum.',
};

export async function onRequestPost(context: CfFunctionContext): Promise<Response> {
  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await context.request.json()) as {
      text?: string;
      voiceName?: string;
      style?: string;
    };

    const text = body?.text;
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Text parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const selectedVoiceName =
      body?.voiceName && ALLOWED_FEMALE_VOICES.has(body.voiceName) ? body.voiceName : 'Kore';
    const voiceStyle =
      typeof body?.style === 'string' && body.style.trim().length > 0
        ? body.style.trim()
        : VOICE_STYLE_DIRECTIONS[selectedVoiceName] || VOICE_STYLE_DIRECTIONS.Kore;

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
    let lastErrorText = 'No audio data received';

    for (const modelName of ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts']) {
      const endpoint = `https://generativelanguage.googleapis.com/v1alpha/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

      for (const withStyle of [true, false]) {
        const part = withStyle
          ? { text: cleanText, speechMetadata: { style: voiceStyle } }
          : { text: cleanText };

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [part] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoiceName },
                },
              },
            },
          }),
        });

        if (resp.ok) {
          const json = (await resp.json()) as {
            candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
          };
          base64Audio = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) break;
        } else {
          lastErrorText = await resp.text().catch(() => resp.statusText);
        }
      }
      if (base64Audio) break;
    }

    if (!base64Audio) {
      return new Response(
        JSON.stringify({ success: false, error: lastErrorText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate voice audio';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
