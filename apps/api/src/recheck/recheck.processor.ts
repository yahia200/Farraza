import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { RECHECK_QUEUE } from './recheck.constants.js';
import { RecheckService, type RecheckJobData } from './recheck.service.js';

// The Re-check worker (ADR-0007): a thin adapter from a BullMQ job to `RecheckService.run`, which
// holds the logic and is what the specs cover. Progress is stored as `{ processed, total }` and
// read back by the status route. A job interrupted by a restart runs again from the start; `run`
// only touches what is still behind the Job's version, so that is safe. WorkerHost and @Processor:
// node_modules/@nestjs/bullmq/dist/hosts/worker-host.class.d.ts and
// dist/decorators/processor.decorator.d.ts.
@Processor(RECHECK_QUEUE)
export class RecheckProcessor extends WorkerHost {
  constructor(private readonly recheck: RecheckService) {
    super();
  }

  process(job: Job<RecheckJobData>): Promise<{ processed: number }> {
    return this.recheck.run(job.data, (progress) => job.updateProgress(progress));
  }
}
