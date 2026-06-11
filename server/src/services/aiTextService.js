// AI text generation (F6) via the Gemini API.
//
// Backend-only: the API key never reaches the frontend. Any failure throws so the caller
// (cardService) falls back to the canned message — the homepage must never depend on AI.

import { logger } from '../utils/logger.js';

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

// Funny-twist styles: one is picked at random per generation (cardService) and the model
// weaves it into the homepage message in the baby's voice. Anything factual must be TRUE.
export const FUN_TWISTS = [
  'a real, surprising fun fact about the fruit/vegetable used for this week\'s size comparison',
  'a real fun fact about what the baby is developing, learning, or able to do around this gestational week',
  'a lighthearted dad joke about pregnancy, babies, or this week\'s fruit',
  'a playful "news report from inside the womb" — the baby reporting on life in his cozy home',
  'a cheeky promise or friendly warning about what is coming soon (kicking, hiccups, somersaults, cravings)',
  'a tiny pun or wordplay involving this week\'s fruit or the baby\'s current size',
];

// Gender context + the matching Lithuanian-grammar rule. Lithuanian self-references are
// grammatically gendered ("pasiruošusi" vs "pasiruošęs"), so this MUST be explicit.
const GENDER_CONTEXT = {
  girl: 'Baby\'s sex: GIRL — mom and dad know they are having a little daughter (dukrytė).',
  boy: 'Baby\'s sex: BOY — mom and dad know they are having a little son (sūnelis).',
  unknown: 'Baby\'s sex: not known yet (a surprise).',
};

const GENDER_RULE = {
  girl: `- The baby is a GIRL: every Lithuanian self-reference must use FEMININE forms
  ("pasiruošusi", "judri", "smalsi", "mažoji", "įspūdinga") — never masculine. Let a little
  daughter-energy shine through when natural (she can be graceful AND fierce, cheeky, funny —
  avoid reducing her to a pink stereotype).`,
  boy: `- The baby is a BOY: every Lithuanian self-reference must use MASCULINE forms
  ("pasiruošęs", "judrus", "smalsus", "mažasis").`,
  unknown: `- The baby's sex is not known: phrase Lithuanian self-references to avoid gendered
  adjective forms (use verbs/nouns instead, e.g. "augu", "mokausi", "esu mažas stebuklas").`,
};

export function buildPrompt(ctx) {
  const recent = (ctx.recentMessages || []).filter(Boolean).slice(0, 5).join('\n- ');
  const momReplies = (ctx.momReplies || []).filter(Boolean).slice(0, 5).join('\n- ');
  const gender = ctx.babyGender === 'girl' || ctx.babyGender === 'boy' ? ctx.babyGender : 'unknown';
  return `You are generating a private pregnancy update from an unborn baby to the baby's mother.

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
${GENDER_CONTEXT[gender]}
Gestational age: week ${ctx.week}, day ${ctx.day}
Current size comparison: ${ctx.sizeLabel}
Development fact (hint only — see rules): ${ctx.developmentFact}
Personality: ${ctx.personality}
Tone preset: ${ctx.tone}
Funny twist for today: ${ctx.funTwist || FUN_TWISTS[0]}
${
  ctx.awaitingArrival
    ? 'Special situation: the due date has passed — the baby could arrive ANY moment now. Write with joyful, excited anticipation about finally meeting mom very soon (packing bags, rehearsing the first hello). Never scary, never about being "late" in a worrying way.\n'
    : ''
}${
    momReplies
      ? `Recent replies FROM MOM to earlier messages (newest first):\n- ${momReplies}\n`
      : ''
  }${
    ctx.kicks
      ? `Kick counter: mom counted ${ctx.kicks.count} kick(s) on ${ctx.kicks.date}.\n`
      : ''
  }Previous recent messages (avoid repeating these):
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
- Write ALL text values (title, shortNotification, homepageMessage, mood) in LITHUANIAN.
  Use natural, warm, grammatically correct Lithuanian. Keep the JSON keys in English.
${GENDER_RULE[gender]}
- shortNotification max ${MAX_NOTIFICATION_CHARS} characters.
- homepageMessage should be 3-6 sentences.
- Weave EXACTLY ONE instance of today's funny twist naturally into homepageMessage — never
  as a detached "fun fact:" line, but as something the baby himself would say (e.g. "I caught
  the wifi here and Google says I'll start kicking soon — better buy me a football!").
  Voice it to match the Personality and Tone preset above.
- Anything stated as a fact (about the fruit or the baby's development) must be TRUE for this
  gestational week. Use your own knowledge of week ${ctx.week} development — the provided
  development fact is only a hint, not a script. Cute and funny, but factual; no invented
  medical claims.
- If recent replies from mom are listed above, you MAY warmly react to or reference ONE of
  them when it fits naturally (answer her question, thank her, tease back). Never quote her
  robotically, never mention "replies" as a feature — it is just a conversation.
- If a kick count is listed, you may playfully reference it when it fits (training, football,
  somersaults) — at most one mention.
- Write as if the baby is speaking directly to mom ("mama").
- Do not include markdown.
- Keep it personal, cozy, and memorable.`;
}

/**
 * Generate a baby message via Gemini. Throws on any failure (caller handles fallback).
 * @param ctx { apiKey, model, babyNickname, week, day, sizeLabel, developmentFact, personality,
 *               tone, funTwist, recentMessages }
 */
export async function generateMessage(ctx) {
  if (!ctx.apiKey) throw new Error('No Gemini API key configured.');
  const model = ctx.model || DEFAULT_TEXT_MODEL;
  logger.debug(`Gemini text request: model=${model}`);

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
    logger.error(`Gemini text request failed (${res.status}): ${detail.slice(0, 300)}`);
    throw new Error(`Gemini text request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  const message = validateMessage(parseAiJson(text));
  logger.debug(`Gemini text ok: "${message.title}"`);
  return message;
}

export { DEFAULT_TEXT_MODEL };
