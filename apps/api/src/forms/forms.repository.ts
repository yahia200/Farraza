import { Injectable } from '@nestjs/common';
import type { FormFields } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FormVersion } from './form.js';

@Injectable()
export class FormsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get versions() {
    return this.prisma.db.orm.public.FormVersion;
  }

  async findDraft(jobId: string): Promise<FormVersion | null> {
    const row = await this.versions
      .where({ jobId })
      .where((version) => version.publishedAt.isNull())
      .first();
    return row ? toFormVersion(row) : null;
  }

  async findLatestPublished(jobId: string): Promise<FormVersion | null> {
    const row = await this.versions
      .where({ jobId })
      .where((version) => version.publishedAt.isNotNull())
      .orderBy((version) => version.version.desc())
      .first();
    return row ? toFormVersion(row) : null;
  }

  async createDraft(input: {
    companyId: string;
    jobId: string;
    version: number;
    fields: FormFields;
    createdById: string;
  }): Promise<FormVersion> {
    const row = await this.versions.create(input);
    return toFormVersion(row);
  }

  /** Returns null if the version is no longer a draft. */
  async updateDraftFields(id: string, fields: FormFields): Promise<FormVersion | null> {
    const row = await this.versions
      .where({ id })
      .where((version) => version.publishedAt.isNull())
      .update({ fields });
    return row ? toFormVersion(row) : null;
  }

  /** Returns null if the version was already published. */
  async publish(id: string, at: Date): Promise<FormVersion | null> {
    const row = await this.versions
      .where({ id })
      .where((version) => version.publishedAt.isNull())
      .update({ publishedAt: at });
    return row ? toFormVersion(row) : null;
  }
}

function toFormVersion(row: {
  id: string;
  version: number;
  fields: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
}): FormVersion {
  return {
    id: row.id,
    version: row.version,
    fields: row.fields as FormFields,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}