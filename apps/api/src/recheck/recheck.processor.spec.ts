import { describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import { RecheckProcessor } from './recheck.processor.js';

// The BullMQ Postgres backend itself is exercised by a manual run against the
// dev database (ADR-0007 "Gates"), not here. This covers the processor's own
// behaviour through its public method, with a fake Job that records progress.
function fakeJob(data: { steps: number; stepMs: number }) {
  const progress: number[] = [];
  const job = {
    data,
    updateProgress: async (value: number) => {
      progress.push(value);
    },
  } as unknown as Job;
  return { job, progress };
}

describe('RecheckProcessor', () => {
  it('reports progress after each step and finishes with the step count', async () => {
    const { job, progress } = fakeJob({ steps: 4, stepMs: 0 });

    const result = await new RecheckProcessor().process(job);

    expect(progress).toEqual([25, 50, 75, 100]);
    expect(result).toEqual({ processed: 4 });
  });
});
