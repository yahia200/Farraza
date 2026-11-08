import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from '../config/env.schema.js';
import { EmbeddingModule } from '../embedding/embedding.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { ReembedRepository } from './reembed.repository.js';
import { ReembedService } from './reembed.service.js';

/**
 * The re-embed command: brings Applications up to date after the embedding model changed
 * (ADR-0008, ticket 11). Run it by hand, from `apps/api`, after `pnpm build`:
 *
 *   pnpm --filter api reembed -- --dry-run   # count only, writes nothing
 *   pnpm --filter api reembed                # re-embed
 *
 * It needs the same environment as the API (`.env`, validated by `validateEnv`) and nothing else:
 * its module leaves out HTTP, BullMQ and the Re-check worker, so running it starts no queue.
 * Never started by the API or a schedule. See `ReembedService` for the rules (idempotent, chunked,
 * safe to rerun).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    EmbeddingModule,
  ],
  // Not `EmbeddingMatchModule`: that one registers the `match-scoring` queue and its worker, which
  // need the BullMQ root configured by `RecheckModule`. The command only needs the scoring
  // service and its repository.
  providers: [EmbeddingMatchService, EmbeddingMatchRepository, ReembedService, ReembedRepository],
})
class ReembedCommandModule {}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  // A standalone application context: the DI container without an HTTP server
  // (node_modules/@nestjs/core/nest-factory.d.ts, createApplicationContext).
  const app = await NestFactory.createApplicationContext(ReembedCommandModule);
  try {
    const report = await app.get(ReembedService).run({ dryRun });
    if (report.outcome === 'disabled') {
      console.log('Layer 3 is off (EMBEDDING_BASE_URL and EMBEDDING_MODEL are not set). Nothing to do.');
      return;
    }
    const { notScored } = report;
    console.log(
      [
        `Model: ${report.model}${report.dryRun ? ' (dry run: nothing was changed)' : ''}`,
        `Applications on another model: ${report.found}`,
        `Re-embedded: ${report.touched} (scored ${report.scored}; not scored: CV unreadable ${notScored.cv_unreadable}, model changed ${notScored.model_changed}; embedder failed ${report.failed}; left as they were ${report.unchanged})`,
        `Cleared: ${report.requirementVectorsCleared} Requirement vectors, ${report.chunkVectorsCleared} CV chunk vectors`,
      ].join('\n'),
    );
    if (report.failed > 0) {
      console.log('Some Applications failed because the embedder did. Their earlier result was kept: run this command again.');
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
