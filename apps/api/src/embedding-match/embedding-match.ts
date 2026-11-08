import type { Requirement } from '@repo/shared';

// Domain types for Layer 3 scoring (docs/db-schema.md §3.25 to §3.27). The repository maps its
// rows to these; the service never sees an ORM row.

/** Why an Application ended "not scored" (`application_match_scores.reason`). */
export type NotScoredReason = 'cv_unreadable' | 'embedder_failed' | 'model_changed';

/** A stored vector with the model and length it was written with. */
export interface StoredVector {
  model: string;
  /** The length the writer declared; the database never checks it against `vector`. */
  dimensions: number;
  /** `real[]` as the driver returns it: single-precision values (compare through `Math.fround`). */
  vector: readonly number[];
}

export interface RequirementVector extends StoredVector {
  requirementId: string;
}

export interface ChunkVector extends StoredVector {
  chunkIndex: number;
  chunkerVersion: number;
}

/** The Application's CV text row, found through its uploaded CV file. */
export interface CvTextRow {
  status: 'readable' | 'unreadable' | 'failed';
  text: string;
}

export interface CurrentRequirements {
  version: number;
  requirements: Requirement[];
}

/** What `saveScore` writes: the one `application_match_scores` row of an Application. */
export type MatchScoreInput = {
  companyId: string;
  jobId: string;
  applicationId: string;
  requirementsVersion: number;
} & (
  | {
      status: 'scored';
      model: string;
      /** Requirement id to its best dot product over the CV's chunks. */
      scores: Record<string, number>;
      overall: number;
    }
  | { status: 'not_scored'; reason: NotScoredReason; model: string | null }
);

/** The ids one scoring run is about. */
export interface ScoreTarget {
  companyId: string;
  jobId: string;
  applicationId: string;
}

/** What `EmbeddingMatchService.score` did. Only `scored` and `not_scored` write a score row. */
export type ScoreOutcome =
  /** `EMBEDDER` is null: Layer 3 is off, nothing was read or written. */
  | { outcome: 'disabled' }
  /** The Application has no CV file or no CV text row: no row is written, as in Layer 2. */
  | { outcome: 'no_cv' }
  /** The Job has no Requirements (or an empty current list): nothing to score against. */
  | { outcome: 'no_requirements' }
  | { outcome: 'scored'; overall: number }
  | { outcome: 'not_scored'; reason: NotScoredReason };
