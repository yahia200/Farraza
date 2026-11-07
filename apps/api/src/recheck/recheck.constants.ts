export const RECHECK_QUEUE = 'recheck';

/** Applications per chunk (placeholder, easy to change: spec "API", Re-check). */
export const RECHECK_CHUNK_SIZE = 50;

/** One run per Job: the stable BullMQ jobId makes a second `add` while one exists a no-op. */
export const recheckJobId = (jobId: string) => `recheck-${jobId}`;
