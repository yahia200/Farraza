import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { RECHECK_QUEUE } from './recheck.constants.js';

export interface RecheckJobData {
  steps: number;
  stepMs: number;
}

// Skeleton of the Re-check queue (keyword match, ticket 07 replaces the body):
// for now it only proves a job runs in this process, reports progress and
// resumes after a restart (ADR-0007). WorkerHost and @Processor:
// node_modules/@nestjs/bullmq/dist/hosts/worker-host.class.d.ts and
// dist/decorators/processor.decorator.d.ts.
@Processor(RECHECK_QUEUE)
export class RecheckProcessor extends WorkerHost {
  async process(job: Job<RecheckJobData>): Promise<{ processed: number }> {
    const { steps, stepMs } = job.data;
    for (let done = 1; done <= steps; done++) {
      await new Promise((resolve) => setTimeout(resolve, stepMs));
      await job.updateProgress((done / steps) * 100);
    }
    return { processed: steps };
  }
}
