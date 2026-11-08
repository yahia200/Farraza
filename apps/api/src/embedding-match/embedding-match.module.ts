import { Module } from '@nestjs/common';
import { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { ReembedRepository } from './reembed.repository.js';
import { ReembedService } from './reembed.service.js';

// `EMBEDDER` comes from the global EmbeddingModule and PrismaService from the global PrismaModule.
// `ReembedService` is only used by the command in `reembed.main.ts` (ticket 11), never by a route.
@Module({
  providers: [EmbeddingMatchService, EmbeddingMatchRepository, ReembedService, ReembedRepository],
  exports: [EmbeddingMatchService, ReembedService],
})
export class EmbeddingMatchModule {}
