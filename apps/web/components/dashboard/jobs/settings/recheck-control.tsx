'use client';

import { nextPoll, recheckButton, type RecheckPoll, type RecheckStatus } from '@repo/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RefreshCwIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { getRecheckCount, getRecheckStatus, startRecheck } from '@/app/actions/jobs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

/** How long to wait after a status answer before asking again. Requests never overlap (see `tick`). */
const POLL_INTERVAL_MS = 1500;
const IDLE: RecheckStatus = { state: 'idle', lastRun: null };
const CONNECTION_MESSAGE = 'Check your connection and try again.';

/**
 * The Re-check control beside the Requirements' Save row (spec: .scratch/keyword-match/spec.md, "Web";
 * ticket 08). Idle it reads "Re-check N" (N from the count route; disabled at 0). While a run is active it
 * reads "Re-checking… processed / total", is disabled and shows a progress bar, polled from the status
 * route through Server Actions (the browser never calls the API). The button label and state come from
 * `recheckButton`, the polling decision from `nextPoll` (`@repo/shared`, `recheck-progress.ts`, tested).
 *
 * Polling is one self-scheduling `setTimeout` per tick (never `setInterval`, so a slow answer can't pile
 * up requests). It ends when the run is idle, when the status route fails (the message is shown with a
 * "Check again" button, so a failure can never loop), and on unmount (the effect's cleanup, which also
 * covers leaving the page). A run already going when the page loads (or when a save remounts the editor)
 * is picked up by the mount check. `total` can grow during a run when an edit lands; it is shown as given.
 */
export function RecheckControl({ companySlug, jobSlug }: { companySlug: string; jobSlug: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<RecheckStatus>(IDLE);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [starting, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  // Cleared on unmount so a late answer never sets state on a gone component.
  const mounted = useRef(true);

  const readStatus = useCallback(async (): Promise<RecheckPoll> => {
    try {
      return await getRecheckStatus(companySlug, jobSlug);
    } catch {
      return { ok: false, message: CONNECTION_MESSAGE };
    }
  }, [companySlug, jobSlug]);

  const refreshCount = useCallback(async () => {
    try {
      const result = await getRecheckCount(companySlug, jobSlug);
      if (!mounted.current) return;
      if (result.count !== undefined) {
        setCount(result.count);
      } else {
        setError(result.formError ?? CONNECTION_MESSAGE);
      }
    } catch {
      if (mounted.current) setError(CONNECTION_MESSAGE);
    }
  }, [companySlug, jobSlug]);

  /** One status read outside the loop: picks up a run already going, or settles after an error. */
  const check = useCallback(async () => {
    const poll = await readStatus();
    if (!mounted.current) return;
    const next = nextPoll(poll);
    if (next.error) {
      setError(next.error);
      return;
    }
    setError(undefined);
    if (next.status) setStatus(next.status);
    setPolling(next.keepPolling);
  }, [readStatus]);

  useEffect(() => {
    mounted.current = true;
    // The first reads: the count, and a run that is already going. State is set in the answers' callbacks,
    // never synchronously here (react-hooks/set-state-in-effect).
    getRecheckCount(companySlug, jobSlug).then(
      (result) => {
        if (!mounted.current) return;
        if (result.count !== undefined) setCount(result.count);
        else setError(result.formError ?? CONNECTION_MESSAGE);
      },
      () => {
        if (mounted.current) setError(CONNECTION_MESSAGE);
      },
    );
    readStatus().then((poll) => {
      if (!mounted.current) return;
      const next = nextPoll(poll);
      if (next.error) {
        setError(next.error);
        return;
      }
      if (next.status) setStatus(next.status);
      setPolling(next.keepPolling);
    });
    return () => {
      mounted.current = false;
    };
  }, [companySlug, jobSlug, readStatus]);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const poll = await readStatus();
      if (cancelled) return;
      const next = nextPoll(poll);
      if (next.status) setStatus(next.status);
      if (next.error) {
        // Stop: an error from the status route must not turn into a retry loop.
        setError(next.error);
        setPolling(false);
        return;
      }
      if (!next.keepPolling) {
        setPolling(false);
        const lastRun = next.status?.state === 'idle' ? next.status.lastRun : null;
        if (lastRun?.failed) {
          toast.add({
            type: 'error',
            title: 'Re-check stopped early',
            description: `${lastRun.processed} candidates were checked before it failed. Try again.`,
          });
        } else {
          toast.add({ type: 'success', title: 'Re-check finished' });
        }
        void refreshCount();
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, readStatus, refreshCount]);

  const button = recheckButton({ count, status, starting });

  function start() {
    // A click does nothing while a run is active or the request is already in flight.
    if (button.disabled) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof startRecheck>>;
      try {
        result = await startRecheck(companySlug, jobSlug);
      } catch {
        result = { formError: CONNECTION_MESSAGE };
      }
      if (!mounted.current) return;
      if (!result.status) {
        toast.add({ type: 'error', title: "Couldn't start the re-check", description: result.formError });
        return;
      }
      setError(undefined);
      setStatus(result.status);
      // Always poll once: the first answer decides, so a run that is queued but not yet reported
      // (or one that finished at once) settles through the same path as any other.
      setPolling(true);
    });
  }

  const labelMotion = reduceMotion
    ? {}
    : {
        // Animate UI's panel timings: in 300 ms, out 150 ms, a 12 px shift, `ease.out` (dist/utils/motion).
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] as const } },
        exit: { opacity: 0, y: -12, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const } },
      };

  return (
    <div className="flex flex-col gap-2" data-recheck-state={button.running ? 'running' : 'idle'}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={button.disabled}
          onClick={start}
          aria-describedby="recheck-help"
        >
          {starting || button.running ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              // The label swaps only between idle and running; the numbers inside change in place.
              key={button.running ? 'running' : 'idle'}
              {...labelMotion}
              className="tabular-nums"
            >
              {button.label}
            </motion.span>
          </AnimatePresence>
        </Button>
        <p id="recheck-help" className="text-sm text-muted-foreground">
          {button.running
            ? 'Checking candidates against the saved requirements. You can keep working.'
            : 'Brings candidates not yet checked against the saved requirements up to date.'}
        </p>
      </div>
      {button.running && status.state === 'running' && (
        <Progress
          value={status.processed}
          max={Math.max(status.total, 1)}
          aria-label="Re-check progress"
          className="max-w-sm"
        />
      )}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            <Button variant="ghost" size="sm" onClick={() => void check()}>
              Check again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
