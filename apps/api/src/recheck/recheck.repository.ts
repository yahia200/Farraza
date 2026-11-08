import { Injectable } from '@nestjs/common';
import type { Requirement, RequirementMatches } from '@repo/shared';
import { bindInt4, bindUuid, START_OF_IDS } from '../common/sql-params.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PENDING_STALE_MINUTES } from './recheck.constants.js';

export interface CurrentRequirements {
  version: number;
  requirements: Requirement[];
}

export interface RecheckCandidate {
  applicationId: string;
  text: string;
  /** Set only by `findNeedingWithScores` (Layer 3 on): which steps this Application still needs. */
  needsKeywords?: boolean;
  needsScore?: boolean;
}

// The Applications a Re-check works on (docs/db-schema.md §3.24): not rejected, CV text
// `readable`, and no stored result or one older than `version`. One statement, because the
// contract has no back-relations from Application to File or CvText for the ORM to filter on.
// The bound-parameter helpers are in `common/sql-params.ts`.

@Injectable()
export class RecheckRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The Job's current Requirements: its highest `job_requirement_versions.version`, or null. */
  async findCurrentRequirements(
    companyId: string,
    jobId: string,
  ): Promise<CurrentRequirements | null> {
    const row = await this.prisma.db.orm.public.JobRequirementVersion.where({ companyId, jobId })
      .orderBy((v) => v.version.desc())
      .first();
    // CHECKed to be a JSON array, and only lists `requirementsSchema` accepted are written.
    return row ? { version: row.version, requirements: row.requirements as Requirement[] } : null;
  }

  async countNeeding(companyId: string, jobId: string, version: number): Promise<number> {
    // The FROM/JOIN/WHERE block must stay identical to the one in findNeeding: the progress total
    // and the chunks must select the same rows. `db.raw.sql` takes whole queries only (no
    // documented fragment composition; prisma-8 skill, references/queries.md), so it is repeated.
    if (version <= 0) return 0;
    const plan = this.prisma.db.raw.sql`
      SELECT count(*)::int AS n
      FROM applications a
      JOIN files f ON f.application_id = a.id AND f.purpose = 'cv' AND f.status = 'uploaded'
      JOIN cv_texts t ON t.file_id = f.id AND t.status = 'readable'
      LEFT JOIN application_requirement_results r ON r.application_id = a.id
      WHERE a.company_id = ${bindUuid(companyId)}
        AND a.job_id = ${bindUuid(jobId)}
        AND a.status <> 'rejected'
        AND (r.id IS NULL OR r.version < ${bindInt4(version)})
    `
      .returnsRow({ n: 'pg/int4@1' })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows[0]?.n ?? 0;
  }

  /** Up to `limit` Applications still needing a Re-check, in id order, with their CV text. */
  async findNeeding(
    companyId: string,
    jobId: string,
    version: number,
    limit: number,
  ): Promise<RecheckCandidate[]> {
    // The FROM/JOIN/WHERE block must stay identical to the one in countNeeding (see there).
    if (version <= 0) return [];
    const plan = this.prisma.db.raw.sql`
      SELECT a.id AS id, t.text AS text
      FROM applications a
      JOIN files f ON f.application_id = a.id AND f.purpose = 'cv' AND f.status = 'uploaded'
      JOIN cv_texts t ON t.file_id = f.id AND t.status = 'readable'
      LEFT JOIN application_requirement_results r ON r.application_id = a.id
      WHERE a.company_id = ${bindUuid(companyId)}
        AND a.job_id = ${bindUuid(jobId)}
        AND a.status <> 'rejected'
        AND (r.id IS NULL OR r.version < ${bindInt4(version)})
      ORDER BY a.id
      LIMIT ${bindInt4(limit)}
    `
      .returnsRow({ id: 'pg/uuid@1', text: 'pg/text@1' })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows.map((row) => ({ applicationId: row.id, text: row.text }));
  }

  /**
   * Re-check with Layer 3 on: how many Applications still need the keyword step, the scoring step
   * or both, after the Application `after` (null: from the start). The FROM/JOIN block is
   * `countNeeding`'s plus a LEFT JOIN of `application_match_scores` (docs/db-schema.md §3.27); the
   * WHERE block must stay identical to the one in findNeedingWithScores. An Application is
   * counted once however many steps it needs.
   *
   * Needs the scoring step: no score row, one computed for an older Requirements version, one
   * still `pending` after `PENDING_STALE_MINUTES` (the submit-time job gave up without writing a
   * result, e.g. its last attempt hit a database error; a younger one is still being worked on),
   * or one that ended `embedder_failed`. A `model_changed` row is left alone on
   * purpose: only the re-embed command (ticket 11) clears it, and retrying it here would end the
   * same way. An unreadable CV is not selected at all (the `cv_texts` join).
   */
  async countNeedingWithScores(
    companyId: string,
    jobId: string,
    version: number,
    after: string | null = null,
  ): Promise<number> {
    if (version <= 0) return 0;
    const plan = this.prisma.db.raw.sql`
      SELECT count(*)::int AS n
      FROM applications a
      JOIN files f ON f.application_id = a.id AND f.purpose = 'cv' AND f.status = 'uploaded'
      JOIN cv_texts t ON t.file_id = f.id AND t.status = 'readable'
      LEFT JOIN application_requirement_results r ON r.application_id = a.id
      LEFT JOIN application_match_scores m ON m.application_id = a.id
      WHERE a.company_id = ${bindUuid(companyId)}
        AND a.job_id = ${bindUuid(jobId)}
        AND a.status <> 'rejected'
        AND a.id > ${bindUuid(after ?? START_OF_IDS)}
        AND (
          r.id IS NULL OR r.version < ${bindInt4(version)}
          OR m.id IS NULL OR m.requirements_version < ${bindInt4(version)}
          OR (m.status = 'pending' AND m.updated_at < now() - ${bindInt4(PENDING_STALE_MINUTES)}::int * interval '1 minute')
          OR (m.status = 'not_scored' AND m.reason = 'embedder_failed')
        )
    `
      .returnsRow({ n: 'pg/int4@1' })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows[0]?.n ?? 0;
  }

  /** Up to `limit` Applications after `after`, in id order, with their CV text and what each needs. */
  async findNeedingWithScores(
    companyId: string,
    jobId: string,
    version: number,
    limit: number,
    after: string | null = null,
  ): Promise<RecheckCandidate[]> {
    // The FROM/JOIN/WHERE block must stay identical to the one in countNeedingWithScores.
    if (version <= 0) return [];
    const plan = this.prisma.db.raw.sql`
      SELECT a.id AS id, t.text AS text,
        (r.id IS NULL OR r.version < ${bindInt4(version)}) AS needs_keywords,
        (
          m.id IS NULL OR m.requirements_version < ${bindInt4(version)}
          OR (m.status = 'pending' AND m.updated_at < now() - ${bindInt4(PENDING_STALE_MINUTES)}::int * interval '1 minute')
          OR (m.status = 'not_scored' AND m.reason = 'embedder_failed')
        ) AS needs_score
      FROM applications a
      JOIN files f ON f.application_id = a.id AND f.purpose = 'cv' AND f.status = 'uploaded'
      JOIN cv_texts t ON t.file_id = f.id AND t.status = 'readable'
      LEFT JOIN application_requirement_results r ON r.application_id = a.id
      LEFT JOIN application_match_scores m ON m.application_id = a.id
      WHERE a.company_id = ${bindUuid(companyId)}
        AND a.job_id = ${bindUuid(jobId)}
        AND a.status <> 'rejected'
        AND a.id > ${bindUuid(after ?? START_OF_IDS)}
        AND (
          r.id IS NULL OR r.version < ${bindInt4(version)}
          OR m.id IS NULL OR m.requirements_version < ${bindInt4(version)}
          OR (m.status = 'pending' AND m.updated_at < now() - ${bindInt4(PENDING_STALE_MINUTES)}::int * interval '1 minute')
          OR (m.status = 'not_scored' AND m.reason = 'embedder_failed')
        )
      ORDER BY a.id
      LIMIT ${bindInt4(limit)}
    `
      .returnsRow({
        id: 'pg/uuid@1',
        text: 'pg/text@1',
        needs_keywords: 'pg/bool@1',
        needs_score: 'pg/bool@1',
      })
      .build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows.map((row) => ({
      applicationId: row.id,
      text: row.text,
      needsKeywords: row.needs_keywords,
      needsScore: row.needs_score,
    }));
  }

  /**
   * Writes the Application's result, replacing any earlier one. An upsert on the UNIQUE
   * (application_id), so a retried chunk or a racing submit leaves one row; `checkedAt` is
   * refreshed on the update branch because the column default only applies to inserts.
   */
  async saveResult(input: {
    companyId: string;
    jobId: string;
    applicationId: string;
    version: number;
    results: RequirementMatches;
    missedMustHave: boolean;
  }): Promise<void> {
    const values = {
      version: input.version,
      // A spread: RequirementMatches is a Record of interfaces-by-shape, not yet a JsonValue.
      results: { ...input.results },
      missedMustHave: input.missedMustHave,
    };
    await this.prisma.db.orm.public.ApplicationRequirementResult.upsert({
      create: {
        companyId: input.companyId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        ...values,
      },
      update: { ...values, checkedAt: new Date() },
      conflictOn: { applicationId: input.applicationId },
    });
  }
}
