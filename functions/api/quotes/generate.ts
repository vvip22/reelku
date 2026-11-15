interface CfFunctionContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

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
      category?: string;
      count?: number;
      tone?: string;
    };

    const category = body?.category || 'Motivation';
    const count = body?.count || 4;
    const tone = body?.tone || 'Inspiring';

    const endpoint = `https://generativelanguage.googleapis.com/v1alpha/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Generate ${count} powerful, short, viral quotes in English suitable for Facebook Reels video captions.
Category: ${category}
Tone: ${tone}
Length: 10-25 words per quote (concise, memorable, deeply inspiring).
For each quote, include:
- English quote text (field "quote")
- Famous author or "Unknown" (field "author")
- Indonesian translation (field "translationId")
- Category (field "category")
- Estimated reading duration in seconds (field "estimatedDuration")`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      return new Response(
        JSON.stringify({ success: false, error: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const quotesText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const quotes = JSON.parse(quotesText);

    return new Response(JSON.stringify({ success: true, quotes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate quotes';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
