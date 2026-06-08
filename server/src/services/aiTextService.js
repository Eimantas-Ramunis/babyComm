// AI text generation (F6) via the Gemini API.
//
// Backend-only: the API key never reaches the frontend. Any failure throws so the caller
// (cardService) falls back to the canned message — the homepage must never depend on AI.

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_NOTIFICATION_CHARS = 120;

/** Strip ```json fences / stray prose and parse the JSON object the model returned. */
export function parseAiJson(text) {
  if (typeof text !== 'string') throw new Error('AI response was not text.');
  let cleaned = text.trim();

  // Remove a leading/trailing markdown code fence if present.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // If there is surrounding prose, grab the outermost {...} block.
  if (!cleaned.startsWith('{')) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('No JSON object in AI response.');
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

/** Validate + normalize the parsed object into our card message shape. Throws if invalid. */
export function validateMessage(obj) {
  const required = ['title', 'shortNotification', 'homepageMessage', 'mood'];
  for (const field of required) {
    if (typeof obj?.[field] !== 'string' || obj[field].trim() === '') {
      throw new Error(`AI message missing field: ${field}`);
    }
  }

  let shortNotification = obj.shortNotification.trim();
  if (shortNotification.length > MAX_NOTIFICATION_CHARS) {
    shortNotification = `${shortNotification.slice(0, MAX_NOTIFICATION_CHARS - 1).trimEnd()}…`;
  }

  const tags = Array.isArray(obj.tags) ? obj.tags.filter((t) => typeof t === 'string') : [];

  return {
    title: obj.title.trim(),
    shortNotification,
    homepageMessage: obj.homepageMessage.trim(),
    mood: obj.mood.trim(),
    tags,
  };
}

function buildPrompt(ctx) {
  const recent = (ctx.recentMessages || []).filter(Boolean).slice(0, 5).join('\n- ');
  return `You are generating a private pregnancy update from an unborn baby to his/her mother.

Tone:
- Warm
- Funny
- Loving
- Slightly cheeky
- Never scary
- Never medical-advice-like
- Never mention miscarriage, defects, danger, illness, death, or complications

Context:
Baby nickname: ${ctx.babyNickname}
Gestational age: week ${ctx.week}, day ${ctx.day}
Current size comparison: ${ctx.sizeLabel}
Development fact: ${ctx.developmentFact}
Personality: ${ctx.personality}
Tone preset: ${ctx.tone}
Previous recent messages (avoid repeating these):
- ${recent || '(none yet)'}

Return ONLY valid JSON with this structure:
{
  "title": string,
  "shortNotification": string,
  "homepageMessage": string,
  "mood": string,
  "tags": string[]
}

Rules:
- shortNotification max ${MAX_NOTIFICATION_CHARS} characters.
- homepageMessage should be 2-5 sentences.
- Write as if the baby is speaking directly to mom.
- Do not include markdown.
- Keep it personal, cozy, and memorable.`;
}

/**
 * Generate a baby message via Gemini. Throws on any failure (caller handles fallback).
 * @param ctx { apiKey, model, babyNickname, week, day, sizeLabel, developmentFact, personality, tone, recentMessages }
 */
export async function generateMessage(ctx) {
  if (!ctx.apiKey) throw new Error('No Gemini API key configured.');
  const model = ctx.model || DEFAULT_TEXT_MODEL;

  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    // Key in a header (not the URL query string) so it never leaks via request-URL logs.
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(ctx) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 1 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini text request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return validateMessage(parseAiJson(text));
}

export { DEFAULT_TEXT_MODEL };
