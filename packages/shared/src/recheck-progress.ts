import { z } from 'zod';

/**
 * What the Re-check control on the Settings tab needs besides pixels (.scratch/keyword-match, ticket 08):
 * the status shapes the API's `GET .../recheck/status` answers, the button's label and enabled state, and
 * the polling decision. Pure, so it is tested here (the web app has no test runner; same precedent as
 * `requirement-editor.ts`). `total` can grow during a run when an edit lands, so progress is shown as
 * given and never assumed to be monotonic in `total`.
 */

export const recheckStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('running'), processed: z.number(), total: z.number() }),
  z.object({
    state: z.literal('idle'),
    lastRun: z
      .object({ finishedAt: z.string().nullable(), processed: z.number(), failed: z.boolean() })
      .nullable(),
  }),
]);

export type RecheckStatus = z.infer<typeof recheckStatusSchema>;

/** The status from an untrusted response body, or `null` when it is not one of the API's shapes. */
export function parseRecheckStatus(value: unknown): RecheckStatus | null {
  const result = recheckStatusSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** One poll's outcome as a Server Action reports it: a status, or the reason it could not be read. */
export type RecheckPoll = { ok: true; status: RecheckStatus } | { ok: false; message: string };

/** What to do after a poll: keep going only while the run is active. An error ends polling (no loop). */
export function nextPoll(poll: RecheckPoll): { keepPolling: boolean; status?: RecheckStatus; error?: string } {
  if (!poll.ok) return { keepPolling: false, error: poll.message };
  return { keepPolling: poll.status.state === 'running', status: poll.status };
}

/**
 * The button: "Re-check N" when idle (disabled at zero, while the start request is in flight, and until
 * the count is known), "Re-checking… processed / total" and disabled while a run is active.
 */
export function recheckButton(input: { count: number | null; status: RecheckStatus; starting: boolean }): {
  label: string;
  disabled: boolean;
  running: boolean;
} {
  const { count, status, starting } = input;
  if (status.state === 'running') {
    return { label: `Re-checking… ${status.processed} / ${status.total}`, disabled: true, running: true };
  }
  if (count === null) return { label: 'Re-check', disabled: true, running: false };
  return { label: `Re-check ${count}`, disabled: starting || count === 0, running: false };
}
