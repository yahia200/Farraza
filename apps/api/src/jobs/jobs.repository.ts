import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_STAGES } from './job.js';
import type { Job, JobStatus, JobWithStages, PublicLabel, Stage, StageKind } from './job.js';

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async slugExists(companyId: string, slug: string): Promise<boolean> {
    const row = await this.prisma.db.orm.public.Job.where({ companyId, slug }).first();
    return row !== null;
  }

  private get jobs() {
    return this.prisma.db.orm.public.Job;
  }

  private get formVersions() {
    return this.prisma.db.orm.public.FormVersion;
  }

  async createWithStages(input: {
    companyId: string;
    title: string;
    slug: string;
    description: string | null;
    createdById: string;
  }): Promise<JobWithStages> {
    return this.prisma.db.transaction(async (tx) => {
      const jobRow = await tx.orm.public.Job.create(input);

      const stageRows = await tx.orm.public.Stage.createAll(
        DEFAULT_STAGES.map((stage) => ({
          ...stage,
          companyId: input.companyId,
          jobId: jobRow.id,
        })),
      );

      return { ...toJob(jobRow), stages: sortStages(stageRows.map(toStage)) };
    });
  }

  async findAllForCompany(companyId: string): Promise<Job[]> {
    const rows = await this.jobs
      .where({ companyId })
      .orderBy((job) => job.createdAt.desc())
      .all();
    return rows.map(toJob);
  }

  async findBySlug(companyId: string, slug: string): Promise<JobWithStages | null> {
    const row = await this.jobs
      .where({ companyId, slug })
      .include('stages')
      .first();
    return row ? { ...toJob(row), stages: sortStages(row.stages.map(toStage)) } : null;
  }

  async update(
    id: string,
    changes: { title?: string; description?: string | null },
  ): Promise<Job | null> {
    const row = await this.jobs.where({ id }).update(changes);
    return row ? toJob(row) : null;
  }

  async hasPublishedForm(jobId: string): Promise<boolean> {
    const row = await this.formVersions
      .where({ jobId })
      .where((version) => version.publishedAt.isNotNull())
      .first();
    return row !== null;
  }

  /** Returns null if the job is already open. */
  async open(id: string, at: Date): Promise<Job | null> {
    const row = await this.jobs
      .where({ id })
      .where((job) => job.status.in(['draft', 'closed']))
      .update({ status: 'open', openedAt: at, closedAt: null });
    return row ? toJob(row) : null;
  }

  /** Returns null if the job is not open. */
  async close(id: string, at: Date): Promise<Job | null> {
    const row = await this.jobs
      .where({ id, status: 'open' })
      .update({ status: 'closed', closedAt: at });
    return row ? toJob(row) : null;
  }


}

function toJob(row: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: JobStatus;
  openedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Job {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toStage(row: {
  id: string;
  name: string;
  position: number;
  kind: StageKind;
  publicLabel: PublicLabel;
}): Stage {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    kind: row.kind,
    publicLabel: row.publicLabel,
  };
}

const sortStages = (stages: Stage[]) => [...stages].sort((a, b) => a.position - b.position);