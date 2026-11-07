import { Injectable } from '@nestjs/common';
import { param } from '@prisma/orm-postgres/relational-core/expression';
import type { Requirement, RequirementMatches } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CurrentRequirements {
  version: number;
  requirements: Requirement[];
}

export interface RecheckCandidate {
  applicationId: string;
  text: string;
}

// The Applications a Re-check works on (docs/db-schema.md §3.24): not rejected, CV text
// `readable`, and no stored result or one older than `version`. One statement, because the
// contract has no back-relations from Application to File or CvText for the ORM to filter on.
// `$1..` are bound parameters (the tag turns each ${} into one); nothing is interpolated.
const bindUuid = (value: string) => param(value, { codecId: 'pg/uuid@1' });
const bindInt4 = (value: number) => param(value, { codecId: 'pg/int4@1' });

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
