import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { EMBEDDER, type Embedder } from './embedder.js';
import { EmbeddingModule } from './embedding.module.js';
import { OllamaEmbedder } from './ollama-embedder.js';

// Boots the module the way the app does (a global ConfigModule feeding it)
// and asks what `EMBEDDER` resolved to.
async function embedderFor(env: Record<string, string>): Promise<Embedder | null> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
      EmbeddingModule,
    ],
  }).compile();
  return moduleRef.get<Embedder | null>(EMBEDDER);
}

describe('EmbeddingModule', () => {
  it('boots with the variables unset and provides null: Layer 3 is off', async () => {
    expect(await embedderFor({})).toBeNull();
  });

  it('provides null when only one variable is set (env.schema.ts refuses that earlier, at boot)', async () => {
    expect(await embedderFor({ EMBEDDING_BASE_URL: 'http://localhost:11434' })).toBeNull();
    expect(await embedderFor({ EMBEDDING_MODEL: 'qwen3-embedding:0.6b' })).toBeNull();
  });

  it('provides the Ollama embedder when both variables are set', async () => {
    const embedder = await embedderFor({
      EMBEDDING_BASE_URL: 'http://localhost:11434',
      EMBEDDING_MODEL: 'qwen3-embedding:0.6b',
    });

    expect(embedder).toBeInstanceOf(OllamaEmbedder);
  });
});
