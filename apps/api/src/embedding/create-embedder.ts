import type { Embedder } from './embedder.js';
import { OllamaEmbedder } from './ollama-embedder.js';

/**
 * Builds the configured embedder, or `null` when Layer 3 is off (nothing is
 * configured). Callers treat `null` as "do not queue, do not show".
 *
 * Only Ollama exists today; a later provider adds a variable that picks the
 * class here. `env.schema.ts` already refuses one variable without the other,
 * so a half configuration is also reported as off rather than guessed at.
 */
export function createEmbedder(env: {
  EMBEDDING_BASE_URL?: string | undefined;
  EMBEDDING_MODEL?: string | undefined;
}): Embedder | null {
  if (!env.EMBEDDING_BASE_URL || !env.EMBEDDING_MODEL) return null;
  return new OllamaEmbedder({ baseUrl: env.EMBEDDING_BASE_URL, model: env.EMBEDDING_MODEL });
}
