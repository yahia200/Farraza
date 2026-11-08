export const MATCH_SCORING_QUEUE = 'match-scoring';

/** One job per Application: the stable BullMQ jobId makes a second `add` while one exists a no-op. */
export const matchScoringJobId = (applicationId: string) => `score-${applicationId}`;

/**
 * Tries per job (placeholders, easy to change). The embedder is a separate service that may be
 * restarting, so the delays are long: 10 s, 20 s, 40 s, 80 s between five tries, about 2.5 minutes in all.
 */
export const MATCH_SCORING_ATTEMPTS = 5;
export const MATCH_SCORING_BACKOFF_MS = 10_000;
