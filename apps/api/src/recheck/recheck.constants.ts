export const RECHECK_QUEUE = 'recheck';

/** Applications per chunk (placeholder, easy to change: spec "API", Re-check). */
export const RECHECK_CHUNK_SIZE = 50;

/**
 * How old a `pending` score row must be before Re-check scores it (placeholder). Submit-time
 * scoring (`MatchScoringQueue`) keeps its row `pending` for up to five tries over about 2.5 minutes,
 * plus up to a minute per try for a slow embedder, so a row still pending after 15 minutes was
 * abandoned (the worker's last attempt failed with a database error, or the API restarted and
 * lost the job). Younger rows are left alone so Re-check does not race a job that is still working.
 */
export const PENDING_STALE_MINUTES = 15;

/** One run per Job: the stable BullMQ jobId makes a second `add` while one exists a no-op. */
export const recheckJobId = (jobId: string) => `recheck-${jobId}`;
