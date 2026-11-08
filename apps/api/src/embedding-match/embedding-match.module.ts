import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { MATCH_SCORING_QUEUE } from './match-scoring.constants.js';
import { MatchScoringProcessor } from './match-scoring.processor.js';
import { MatchScoringQueue } from './match-scoring.queue.js';

// `EMBEDDER` comes from the global EmbeddingModule and PrismaService from the global PrismaModule.
// The BullMQ connection (Postgres backend, ADR-0007) is configured once by `RecheckModule`'s
// `BullModule.forRootAsync`, which is global; this module only registers its own queue. Moving that
// root configuration to a shared module is a follow-up that touches `recheck/`.
// `MatchScoringQueue` is what `ApplicationsModule` uses to queue a job after a submit.
@Module({
  imports: [BullModule.registerQueue({ name: MATCH_SCORING_QUEUE })],
  providers: [EmbeddingMatchService, EmbeddingMatchRepository, MatchScoringQueue, MatchScoringProcessor],
  exports: [EmbeddingMatchService, MatchScoringQueue],
})
export class EmbeddingMatchModule {}
