import { describe, expect, it } from 'vitest';
import { createEmbedder } from './create-embedder.js';
import { OllamaEmbedder } from './ollama-embedder.js';

describe('createEmbedder', () => {
  it('reports Layer 3 as not configured (null) when both variables are unset', () => {
    expect(createEmbedder({})).toBeNull();
    expect(
      createEmbedder({ EMBEDDING_BASE_URL: undefined, EMBEDDING_MODEL: undefined }),
    ).toBeNull();
  });

  it('builds the Ollama embedder when both are set', () => {
    const embedder = createEmbedder({
      EMBEDDING_BASE_URL: 'http://localhost:11434',
      EMBEDDING_MODEL: 'qwen3-embedding:0.6b',
    });

    expect(embedder).toBeInstanceOf(OllamaEmbedder);
  });

  it('is not configured when only one is set, because the env schema already refuses that', () => {
    expect(createEmbedder({ EMBEDDING_BASE_URL: 'http://localhost:11434' })).toBeNull();
    expect(createEmbedder({ EMBEDDING_MODEL: 'm' })).toBeNull();
  });
});
