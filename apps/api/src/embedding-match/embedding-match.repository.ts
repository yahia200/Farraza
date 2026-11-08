import { Injectable } from '@nestjs/common';
import type { Requirement } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ChunkVector,
  CurrentRequirements,
  CvTextRow,
  MatchScoreInput,
  RequirementVector,
} from './embedding-match.js';

/**
 * The only layer that touches Prisma for Layer 3 scoring (docs/db-schema.md §3.25 to §3.27). Every
 * read and write carries the company (and Job), copied from the Application by the caller.
 */
@Injectable()
export class EmbeddingMatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The CV text of the Application's uploaded CV file, or null when it has no CV file or that file
   * has no `cv_texts` row (the same two lookups as `PipelineRepository.findCvState`). The Job is part
   * of the filter, so an Application is never read through another Job.
   */
  async findCvText(companyId: string, jobId: string, applicationId: string): Promise<CvTextRow | null> {
    const { File, CvText } = this.prisma.db.orm.public;
    const file = await File.select('id')
      .where({ companyId, jobId, applicationId, purpose: 'cv', status: 'uploaded' })
      .first();
    if (!file) return null;
    const row = await CvText.select('status', 'text').where({ companyId, jobId, fileId: file.id }).first();
    return row ? { status: row.status, text: row.text } : null;
  }

  /** The Job's current Requirements: its highest `job_requirement_versions.version`, or null. */
  async findCurrentRequirements(companyId: string, jobId: string): Promise<CurrentRequirements | null> {
    const row = await this.prisma.db.orm.public.JobRequirementVersion.where({ companyId, jobId })
      .orderBy((v) => v.version.desc())
      .first();
    // CHECKed to be a JSON array, and only lists `requirementsSchema` accepted are written.
    return row ? { version: row.version, requirements: row.requirements as Requirement[] } : null;
  }

  async findRequirementVectors(companyId: string, jobId: string, version: number): Promise<RequirementVector[]> {
    const rows = await this.prisma.db.orm.public.RequirementEmbedding.where({ companyId, jobId, version }).all();
    return rows.map((row) => ({
      requirementId: row.requirementId,
      model: row.model,
      dimensions: row.dimensions,
      vector: row.vector,
    }));
  }

  /**
   * Insert-or-ignore on UNIQUE (job_id, version, requirement_id): a row another worker wrote first
   * is kept and this one is skipped, so two workers embedding the same Requirement never fail.
   * `onConflict: 'skip'` is documented on `createAndCount` in `@prisma/orm-family-sql`'s
   * `orm-client.d.mts` (`CreateConflictOptions`).
   */
  async saveRequirementVectors(
    companyId: string,
    jobId: string,
    version: number,
    rows: RequirementVector[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.db.orm.public.RequirementEmbedding.createAndCount(
      rows.map((row) => ({ companyId, jobId, version, ...row })),
      { onConflict: 'skip', conflictOn: ['jobId', 'version', 'requirementId'] },
    );
  }

  /** Replaces the Application's whole set of chunk vectors, in one transaction. */
  async replaceChunkVectors(
    companyId: string,
    jobId: string,
    applicationId: string,
    rows: ChunkVector[],
  ): Promise<void> {
    await this.prisma.db.transaction(async (tx) => {
      const { CvChunkEmbedding } = tx.orm.public;
      await CvChunkEmbedding.where({ companyId, jobId, applicationId }).deleteAndCount();
      if (rows.length === 0) return;
      await CvChunkEmbedding.createAndCount(rows.map((row) => ({ companyId, jobId, applicationId, ...row })));
    });
  }

  async findChunkVectors(companyId: string, jobId: string, applicationId: string): Promise<ChunkVector[]> {
    const rows = await this.prisma.db.orm.public.CvChunkEmbedding.where({ companyId, jobId, applicationId })
      .orderBy((c) => c.chunkIndex.asc())
      .all();
    return rows.map((row) => ({
      chunkIndex: row.chunkIndex,
      chunkerVersion: row.chunkerVersion,
      model: row.model,
      dimensions: row.dimensions,
      vector: row.vector,
    }));
  }

  /**
   * Deletes the Application's score row only while it is `pending` (the status is part of the
   * filter, so a `scored` or `not_scored` row is never touched). Returns how many rows went (0 or 1).
   */
  async deletePendingScore(companyId: string, jobId: string, applicationId: string): Promise<number> {
    return this.prisma.db.orm.public.ApplicationMatchScore.where({
      companyId,
      jobId,
      applicationId,
      status: 'pending',
    }).deleteAndCount();
  }

  /**
   * Writes the Application's one score row, replacing any earlier one: an upsert on UNIQUE
   * (application_id), so a retried job or a racing submit leaves one row. `updatedAt` is refreshed
   * on the update branch because the column default only applies to inserts.
   */
  async saveScore(input: MatchScoreInput): Promise<void> {
    const { companyId, jobId, applicationId, requirementsVersion } = input;
    const values =
      input.status === 'scored'
        ? {
            status: 'scored' as const,
            reason: null,
            model: input.model,
            // A spread: a Record<string, number> is not yet a JsonValue.
            scores: { ...input.scores },
            score: input.overall,
          }
        : {
            status: 'not_scored' as const,
            reason: input.reason,
            model: input.model,
            scores: {},
            score: null,
          };
    await this.prisma.db.orm.public.ApplicationMatchScore.upsert({
      create: { companyId, jobId, applicationId, requirementsVersion, ...values },
      update: { requirementsVersion, ...values, updatedAt: new Date() },
      conflictOn: { applicationId },
    });
  }
}
