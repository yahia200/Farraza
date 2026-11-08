import { Module } from '@nestjs/common';
import { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';

// `EMBEDDER` comes from the global EmbeddingModule and PrismaService from the global PrismaModule.
// Nothing imports this module yet: the submit hook and the queue that call
// `EmbeddingMatchService.score` are ticket 07.
@Module({
  providers: [EmbeddingMatchService, EmbeddingMatchRepository],
  exports: [EmbeddingMatchService],
})
export class EmbeddingMatchModule {}
