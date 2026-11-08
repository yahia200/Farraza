import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDER, type Embedder } from './embedder.js';
import { createEmbedder } from './create-embedder.js';

// Global like StorageModule and PrismaModule, so the scoring code can inject
// EMBEDDER without importing this module. The value is null when Layer 3 is off.
// Docs: custom providers / useFactory, node_modules/@nestjs/common/interfaces/modules/provider.interface.d.ts
@Global()
@Module({
  providers: [
    {
      provide: EMBEDDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Embedder | null =>
        createEmbedder({
          EMBEDDING_BASE_URL: config.get<string>('EMBEDDING_BASE_URL'),
          EMBEDDING_MODEL: config.get<string>('EMBEDDING_MODEL'),
        }),
    },
  ],
  exports: [EMBEDDER],
})
export class EmbeddingModule {}
