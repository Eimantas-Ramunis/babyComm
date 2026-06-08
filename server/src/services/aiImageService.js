// AI image generation (F7) via the Gemini image model ("Nano Banana").
//
// Returns raw image bytes; cardService persists them to disk and stores the URL. Generation
// happens only on explicit/admin/scheduled flows — never on page load. Throws on failure
// (image is optional; the card still works with the placeholder).

import { logger } from '../utils/logger.js';

const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildImagePrompt(ctx) {
  return `Create a cute, wholesome, warm storybook-style illustration for a private pregnancy tracker app.

Theme: Baby is approximately the size of ${ctx.sizeLabel}.
Personality: ${ctx.personality}
Scene: a tiny cheerful baby character represented symbolically as a ${ctx.sizeLabel}-sized little explorer having a gentle adventure.

Style: soft pastel colors, cozy, funny, charming, simple composition, high quality children's book illustration, no text in image, no medical realism, no scary anatomy, no realistic fetus, no horror elements.`;
}

/**
 * Generate an illustration via Gemini. Returns { buffer, mimeType }. Throws on failure.
 * @param ctx { apiKey, model, sizeLabel, personality }
 */
export async function generateImage(ctx) {
  if (!ctx.apiKey) throw new Error('No Gemini API key configured.');
  const model = ctx.model || DEFAULT_IMAGE_MODEL;
  logger.debug(`Gemini image request: model=${model}`);

  const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    // Key in a header (not the URL query string) so it never leaks via request-URL logs.
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildImagePrompt(ctx) }] }],
      // Image-capable models need IMAGE in the requested response modalities. TEXT+IMAGE is
      // the broadly-accepted combination (IMAGE-only is rejected by some models).
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error(`Gemini image request failed (${res.status}): ${detail.slice(0, 400)}`);
    throw new Error(`Gemini image request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    // Surface what came back instead so the failure is diagnosable (e.g. a safety block or
    // a text-only response). finishReason is the usual culprit.
    const finishReason = data?.candidates?.[0]?.finishReason;
    const textParts = parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 200);
    logger.error(
      `Gemini image: no image in response (finishReason=${finishReason}, model=${model}). Text: ${textParts || '(none)'}`,
    );
    throw new Error('Gemini image response contained no image data.');
  }

  logger.debug(`Gemini image ok: ${imagePart.inlineData.mimeType || 'image/png'}`);
  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

export { DEFAULT_IMAGE_MODEL };
