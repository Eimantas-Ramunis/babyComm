// AI text generation (F6) — Phase 5. Not implemented in Phase 1.
//
// Phase 1 always uses fallback card content (see cardService.createFallbackCard).
// This module exists so Phase 5 has a clear home and the file structure matches the spec.

export const NOT_IMPLEMENTED = 'AI text generation is not implemented in Phase 1.';

export async function generateMessage() {
  throw new Error(NOT_IMPLEMENTED);
}
