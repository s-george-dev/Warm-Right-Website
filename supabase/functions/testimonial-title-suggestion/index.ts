const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') throw httpError('Unsupported method.', 405);

    const body = await req.json();
    const content = cleanText(body.content, 1800);
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 5));
    const customerName = cleanText(body.customer_name, 120);

    if (content.length < 30) {
      throw httpError('Please write a little more in the testimonial before generating a title.', 400);
    }

    return json(await generateWithGemini({ content, rating, customerName }));
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Unexpected error.' }, err.status || 500);
  }
});

async function generateWithGemini(input: { content: string; rating: number; customerName: string }) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw httpError('Gemini API key is not configured yet.', 500);

  const configuredModel = Deno.env.get('GEMINI_MODEL') || '';
  const models = modelCandidates(configuredModel);
  const prompt = [
    'You write short customer testimonial titles for a UK heating and plumbing company.',
    'Return only valid JSON with this exact shape: {"title":"...","summary":"..."}',
    'The title must be 3 to 7 words, plain English, professional, and not clickbait.',
    'The summary must be one short sentence under 120 characters.',
    'Do not invent facts that are not in the testimonial.',
    '',
    `Customer name: ${input.customerName || 'Not provided'}`,
    `Rating: ${input.rating}/5`,
    `Testimonial: ${input.content}`,
  ].join('\n');

  let result: any = null;
  let lastFailure = '';

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (response.ok) {
      result = await response.json();
      break;
    }

    lastFailure = `Gemini ${model} failed (${response.status}): ${await response.text()}`;
    console.error(lastFailure);
  }

  if (!result) {
    throw httpError(userSafeGeminiMessage(lastFailure), 502);
  }

  const text = extractCandidateText(result);
  let parsed: { title?: string; summary?: string };

  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  const title = normalizeTitle(parsed.title || '');
  const summary = cleanText(parsed.summary || '', 140);
  if (!title) throw httpError('Could not generate a title just now.', 502);

  return { title, summary };
}

function extractCandidateText(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((part) => part?.text || '').join('\n').trim();
  }
  return '';
}

function normalizeTitle(value: string) {
  const cleaned = cleanText(value, 90).replace(/[.?!]+$/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 7);
  return words.join(' ');
}

function modelCandidates(value: string) {
  const model = cleanText(value, 80);
  const candidates = [
    'gemini-2.0-flash',
    model,
    'gemini-2.5-flash',
  ].filter(Boolean);

  return [...new Set(candidates.map((candidate) => {
    if (/gemini-1\.5|gemini-flash-latest/.test(candidate)) return 'gemini-2.0-flash';
    return candidate;
  }))];
}

function userSafeGeminiMessage(detail: string) {
  if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(detail)) {
    return 'The Gemini API key is not valid. Please check the Supabase GEMINI_API_KEY secret.';
  }
  if (/PERMISSION_DENIED|permission|API has not been used|not enabled/i.test(detail)) {
    return 'The Gemini API key does not have permission yet. Please check Google AI Studio/API access for this key.';
  }
  if (/quota|billing|RESOURCE_EXHAUSTED/i.test(detail)) {
    return 'Gemini could not generate a title because the API quota or billing limit was reached.';
  }
  if (/not found|models\//i.test(detail)) {
    return 'The configured Gemini model is not available for this API key.';
  }
  return 'Could not generate a title just now.';
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
