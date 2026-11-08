import { Injectable } from '@nestjs/common';
import { bindInt4, bindText, bindUuid, START_OF_IDS } from '../common/sql-params.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ScoreTarget } from './embedding-match.js';

/** An Application whose score row was made by another embedding model. */
export type StaleTarget = ScoreTarget;

/**
 * What the re-embed command (ticket 11) reads and clears. Separate from `EmbeddingMatchRepository`
 * so the command's queries do not sit in the file the submit path and the payloads use. It crosses
 * companies on purpose (a model change is global), which is why it is only called by the command,
 * never from a request.
 */
@Injectable()
export class ReembedRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The Applications whose score row was made by a model other than `model` (docs/db-schema.md
  // §3.27), or ended `model_changed`. A `model_changed` row stores the *new* model (the CV was
  // embedded with it; the Requirement vectors were not), so the model comparison alone would miss
  // it. Rows with no model (`cv_unreadable`, `embedder_failed`, `pending`) are not model problems.
  // The FROM/WHERE block must stay identical in countStale and findStale (see RecheckRepository
  // for why a block is repeated: `db.raw.sql` takes whole queries only).

  async countStale(model: string): Promise<number> {
    const plan = this.prisma.db.raw.sql`
      SELECT count(*)::int AS n
      FROM application_match_scores m
      WHERE (m.model IS NOT NULL AND m.model <> ${bindText(model)}) OR m.reason = 'model_changed'
    `
      .returnsRow({ n: 'pg/int4@1' })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows[0]?.n ?? 0;
  }

  /** Up to `limit` stale rows after the Application `after` (null: from the start), in id order. */
  async findStale(model: string, limit: number, after: string | null = null): Promise<StaleTarget[]> {
    const plan = this.prisma.db.raw.sql`
      SELECT m.company_id AS company_id, m.job_id AS job_id, m.application_id AS application_id
      FROM application_match_scores m
      WHERE ((m.model IS NOT NULL AND m.model <> ${bindText(model)}) OR m.reason = 'model_changed')
        AND m.application_id > ${bindUuid(after ?? START_OF_IDS)}
      ORDER BY m.application_id
      LIMIT ${bindInt4(limit)}
    `
      .returnsRow({ company_id: 'pg/uuid@1', job_id: 'pg/uuid@1', application_id: 'pg/uuid@1' })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows.map((row) => ({
      companyId: row.company_id,
      jobId: row.job_id,
      applicationId: row.application_id,
    }));
  }

  /** Deletes the Job's Requirement vectors (any version) made by a model other than `model`. */
  async deleteStaleRequirementVectors(companyId: string, jobId: string, model: string): Promise<number> {
    return this.prisma.db.orm.public.RequirementEmbedding.where({ companyId, jobId })
      .where((row) => row.model.neq(model))
      .deleteAndCount();
  }

  /** Deletes the Application's chunk vectors made by a model other than `model`. */
  async deleteStaleChunkVectors(
    companyId: string,
    jobId: string,
    applicationId: string,
    model: string,
  ): Promise<number> {
    return this.prisma.db.orm.public.CvChunkEmbedding.where({ companyId, jobId, applicationId })
      .where((row) => row.model.neq(model))
      .deleteAndCount();
  }
}
