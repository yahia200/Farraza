import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { AuthorizationService } from '@nestjs/authorization';
import { matchRequirements, missedMustHave } from '@repo/shared';
import type { Queue } from 'bullmq';
import type { Membership } from '../companies/company.js';
import { JobPolicy } from '../jobs/job.policy.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import { RECHECK_CHUNK_SIZE, RECHECK_QUEUE, recheckJobId } from './recheck.constants.js';
import { RecheckRepository } from './recheck.repository.js';

/** What a queued run carries: ids only, so a retry always re-reads the current Requirements. */
export interface RecheckJobData {
  companyId: string;
  jobId: string;
  /** How many Applications needed a Re-check when the run was queued (the first `total`). */
  total: number;
}

export interface RecheckProgress {
  processed: number;
  total: number;
}

export type RecheckStatus =
  | { state: 'running'; processed: number; total: number }
  | {
      state: 'idle';
      /** The last finished run of this Job, or null if it never ran (or the record was removed). */
      lastRun: { finishedAt: string | null; processed: number; failed: boolean } | null;
    };

const ACTIVE_STATES = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);

@Injectable()
export class RecheckService {
  constructor(
    private readonly jobs: JobsService,
    private readonly repository: RecheckRepository,
    private readonly authorization: AuthorizationService,
    @InjectQueue(RECHECK_QUEUE) private readonly queue: Queue,
  ) {}

  /** How many Applications a Re-check would touch now. Zero when the Job has no version. */
  async count(membership: Membership, jobSlug: string): Promise<{ count: number }> {
    const job = await this.jobs.get(membership, jobSlug);
    const count = await this.repository.countNeeding(
      membership.company.id,
      job.id,
      job.requirementsVersion,
    );
    return { count };
  }

  /**
   * Queues a Re-check for the Job and answers its status. One run per Job: the BullMQ jobId is
   * stable, so while a run is waiting or active this does nothing. A finished run keeps its jobId
   * (it is the "last run" the status route reads), so it is removed before the next one is added.
   * Nothing is queued when no Application needs a Re-check.
   */
  async start(
    user: User,
    membership: Membership,
    jobSlug: string,
  ): Promise<RecheckStatus> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);
    const job = await this.jobs.get(membership, jobSlug);
    const id = recheckJobId(job.id);

    const existing = await this.queue.getJob(id);
    if (existing) {
      if (ACTIVE_STATES.has(await existing.getState())) return this.toStatus(existing);
      await existing.remove();
    }

    const total = await this.repository.countNeeding(
      membership.company.id,
      job.id,
      job.requirementsVersion,
    );
    if (total === 0) return this.status(membership, jobSlug);

    const data: RecheckJobData = { companyId: membership.company.id, jobId: job.id, total };
    // Retried up to 3 times with a growing delay: the run is idempotent (`run`), so a retry only
    // repeats what is still missing.
    const queued = await this.queue.add('recheck', data, {
      jobId: id,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
    return this.toStatus(queued);
  }

  /** Idle, running with progress, or the last finished run. */
  async status(membership: Membership, jobSlug: string): Promise<RecheckStatus> {
    const job = await this.jobs.get(membership, jobSlug);
    const queued = await this.queue.getJob(recheckJobId(job.id));
    if (!queued) return { state: 'idle', lastRun: null };
    return this.toStatus(queued);
  }

  /**
   * The processor body. Loops until nothing needs a Re-check: each chunk re-reads the Job's
   * current Requirements version first, takes the next `chunkSize` Applications still behind it,
   * writes their results (upserts, so a retried or re-run chunk is safe) and reports progress. An
   * edit saved mid-run therefore makes the next chunk use the new version, and the Applications
   * already done become "behind" again, so the run ends with everything on the latest version.
   * `total` is `processed` plus what still needs a Re-check, so it grows if an edit lands.
   */
  async run(
    data: Pick<RecheckJobData, 'companyId' | 'jobId'>,
    report: (progress: RecheckProgress) => Promise<void>,
    chunkSize = RECHECK_CHUNK_SIZE,
  ): Promise<{ processed: number }> {
    const { companyId, jobId } = data;
    let processed = 0;

    for (;;) {
      const current = await this.repository.findCurrentRequirements(companyId, jobId);
      if (!current) break;
      const chunk = await this.repository.findNeeding(companyId, jobId, current.version, chunkSize);
      if (chunk.length === 0) break;

      for (const { applicationId, text } of chunk) {
        const results = matchRequirements(current.requirements, text);
        await this.repository.saveResult({
          companyId,
          jobId,
          applicationId,
          version: current.version,
          results,
          missedMustHave: missedMustHave(current.requirements, results),
        });
      }

      processed += chunk.length;
      const remaining = await this.repository.countNeeding(companyId, jobId, current.version);
      await report({ processed, total: processed + remaining });
    }

    return { processed };
  }

  private async toStatus(queued: {
    data: unknown;
    progress: unknown;
    returnvalue: unknown;
    finishedOn?: number;
    getState(): Promise<string>;
  }): Promise<RecheckStatus> {
    const state = await queued.getState();
    if (ACTIVE_STATES.has(state)) {
      const progress = asProgress(queued.progress);
      const total = (queued.data as Partial<RecheckJobData>).total ?? 0;
      return { state: 'running', processed: progress?.processed ?? 0, total: progress?.total ?? total };
    }
    const result = queued.returnvalue as { processed?: number } | undefined;
    return {
      state: 'idle',
      lastRun: {
        finishedAt: queued.finishedOn ? new Date(queued.finishedOn).toISOString() : null,
        processed: result?.processed ?? asProgress(queued.progress)?.processed ?? 0,
        failed: state !== 'completed',
      },
    };
  }
}

function asProgress(value: unknown): RecheckProgress | null {
  if (typeof value !== 'object' || value === null) return null;
  const { processed, total } = value as Record<string, unknown>;
  return typeof processed === 'number' && typeof total === 'number' ? { processed, total } : null;
}
