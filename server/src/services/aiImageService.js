// AI image generation (F7) — Phase 6. Not implemented in Phase 1.
//
// Per spec: images must be generated in advance and cached, never on page load.

export const NOT_IMPLEMENTED = 'AI image generation is not implemented in Phase 1.';

export async function generateImage() {
  throw new Error(NOT_IMPLEMENTED);
}
