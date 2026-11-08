import type {
  Answers,
  CvMode,
  FilePurpose,
  FormFields,
  Highlight,
  HighlightKind,
  MatchBand,
  RatingSummary,
  RatingValues,
  Requirement,
  RequirementMatches,
  RequirementTier,
  ScreeningFlag,
} from '@repo/shared';
import type { NotScoredReason } from '../embedding-match/embedding-match.js';
import type { StageKind } from '../jobs/job.js';

export type ApplicationStatus = 'active' | 'rejected' | 'hired' | 'withdrawn';

/**
 * A card's Average rating: the same `count` and `average` as `summariseRatings` (the mean of the
 * `overall` scores, not rounded, `null` with no Ratings), without the per-Criterion part.
 */
export type CardRating = Pick<RatingSummary, 'count' | 'average'>;

export interface ApplicationCard {
  id: string;
  stageId: string;
  status: ApplicationStatus;
  submittedAt: Date;
  candidate: { name: string; email: string; phone: string };
  /**
   * The answer to each of the Job's Highlighted questions, keyed by Question key: the raw answer
   * tagged by type (`toHighlight`; a select as its labels from this Application's own form
   * version), or null when unanswered or when that version has no such Question. The web app
   * formats and sorts it. Empty when the Job has none.
   */
  highlights: Record<string, Highlight | null>;
  /** The Average rating and how many Members gave one; `{ average: null, count: 0 }` with none. */
  rating: CardRating;
  /** The flag-outcome Screening rules that fired at submit, as stored (`applications.flags`); `[]` for none. */
  flags: ScreeningFlag[];
  /**
   * A must-have Requirement did not match this Application's CV text, from its stored result
   * (`application_requirement_results.missed_must_have`). False with no stored result, which includes
   * every unreadable, failed or missing CV, and a miss of only nice-to-haves.
   */
  missedMustHave: boolean;
  /**
   * The embedding match's overall number (Layer 3), for sorting only: the web app never shows it. Null
   * unless the Application is `scored`: no row, scoring and not scored all read null. Per-Requirement
   * scores, vectors and passages never leave the API on a card.
   */
  matchScore: number | null;
  /** The embedding match's state, or null when the Application has no score row. */
  matchState: MatchState | null;
}

/**
 * Where an Application's embedding match stands: `scoring` (a pending row), `scored`, or `not_scored`
 * with why. A missing row is not a state: it reads as null where this type is used.
 */
export type MatchState =
  | { status: 'scoring' }
  | { status: 'scored' }
  | { status: 'not_scored'; reason: NotScoredReason };

/** An `application_match_scores` row as the board reads it: status, reason and the overall number only. */
export interface MatchScoreSummary {
  status: 'pending' | 'scored' | 'not_scored';
  reason: NotScoredReason | null;
  /** The overall number; null unless `scored` (a CHECK on the table). */
  score: number | null;
}

/** The part of a card the service adds from other reads: rating, marker and embedding match. */
export type CardAddOns = 'rating' | 'missedMustHave' | 'matchScore' | 'matchState';

/** A card as `PipelineRepository` reads it, before the service adds the Highlighted answers, the rating and the markers. */
export type CardRow = Omit<ApplicationCard, 'highlights' | CardAddOns>;

/** A card row plus what the service needs to resolve its Highlighted answers. Stays inside the API. */
export interface CardRowWithAnswers extends CardRow {
  /** The form version the applicant answered, whose Questions resolve the answers. */
  formVersionId: string;
  answers: Answers;
}

/** One of a Job's Highlighted questions, with its text from the latest published form. */
export interface HighlightedQuestion {
  key: string;
  label: string;
  /** What the column holds, from the Question's type in the latest published form. */
  kind: HighlightKind;
}

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  kind: StageKind;
  applications: ApplicationCard[];
}

export interface ApplicationEventView {
  id: string;
  type: string;
  fromStageId: string | null;
  toStageId: string | null;
  actorId: string | null;
  data: unknown;
  createdAt: Date;
}

export interface NoteView {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: Date;
}

export interface ApplicationDetail {
  id: string;
  status: ApplicationStatus;
  submittedAt: Date;
  source: string | null;
  stage: { id: string; name: string; kind: StageKind };
  candidate: { id: string; name: string; email: string; phone: string };
  fields: FormFields;
  /** The CV setting of the form version the applicant saw, so the sheet knows whether a CV was asked for. */
  cvMode: CvMode;
  answers: Answers;
  /** The flag-outcome Screening rules that fired at submit, with their reasons (members only); `[]` for none. */
  flags: ScreeningFlag[];
  events: ApplicationEventView[];
  notes: NoteView[];
  /** What became of the CV's text: only `readable` can have Requirement results. CV text is never returned. */
  cvState: CvState;
  /** The stored Requirement check, or null when there is none (never checked, or CV not `readable`). */
  requirementCheck: RequirementCheck | null;
  /**
   * The embedding match: its state and a band per Requirement of the version it was scored against, or
   * null when the Application has no score row. Bands are worked out on read; no raw score, vector,
   * passage or CV text is ever in it.
   */
  embeddingMatch: EmbeddingMatchView | null;
  /** Every Member's Rating of this Application, oldest first. */
  ratings: RatingView[];
  /** The count, the average and the per-Criterion averages of `ratings` (`summariseRatings`). */
  ratingSummary: RatingSummary;
}

/** `none`: no CV text row (no CV, or one never read). The others are `cv_texts.status`. */
export type CvState = 'readable' | 'unreadable' | 'failed' | 'none';

/** One Requirement with its verdict for this Application: text and tier come from the checked version. */
export interface RequirementResultView {
  id: string;
  text: string;
  tier: RequirementTier;
  /** `null`: "not checked", the Requirement has no keywords (neither a hit nor a miss). */
  matched: boolean | null;
  /** The listed keywords that matched, as the manager wrote them. */
  terms: string[];
}

export interface RequirementCheck {
  /** The `job_requirement_versions.version` this Application was checked against. */
  version: number;
  missedMustHave: boolean;
  /** One entry per Requirement of that version, in its order. */
  results: RequirementResultView[];
}

/** The stored check as `PipelineRepository` reads it: the raw result beside the version it names. */
export interface RequirementCheckRow {
  version: number;
  missedMustHave: boolean;
  results: RequirementMatches;
  /** The Requirements of `version` (looked up by Job and version); `[]` if the version row is gone. */
  requirements: Requirement[];
}

/** One Requirement with its band for this Application. Text and tier come from the scored version. */
export interface RequirementBandView {
  id: string;
  text: string;
  tier: RequirementTier;
  /** Null when there is no band to show: not `scored`, or no stored score for this Requirement. */
  band: MatchBand | null;
}

export interface EmbeddingMatchView {
  /** The `job_requirement_versions.version` the Application was scored against. */
  version: number;
  state: MatchState;
  /** One entry per Requirement of that version, in its order. */
  requirements: RequirementBandView[];
}

/**
 * The Application's score row as `PipelineRepository` reads it, beside the Requirements of the version
 * it names. `scores` (Requirement id to its best dot product) stays inside the API: the service turns
 * it into bands.
 */
export interface EmbeddingMatchRow {
  version: number;
  status: 'pending' | 'scored' | 'not_scored';
  reason: NotScoredReason | null;
  scores: Record<string, number>;
  /** The Requirements of `version` (looked up by Job and version); `[]` if the version row is gone. */
  requirements: Requirement[];
}

/**
 * One Member's Rating as the detail shows it. `userId` and `name` describe the author: `userId` is null
 * and `name` is "Former member" when the author's user is gone (the Rating stays and still counts).
 * `criteria` is as stored, so it can hold scores for Criteria the Job no longer uses.
 */
export interface RatingView extends RatingValues {
  userId: string | null;
  name: string;
  updatedAt: Date;
}

/** A Rating as `PipelineRepository` reads it: the author's name is null when the author's user is gone. */
export interface RatingRow extends RatingValues {
  userId: string | null;
  userName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The detail as `PipelineRepository.findDetail` reads it, before the service resolves names and the summary. */
export type ApplicationDetailRow = Omit<
  ApplicationDetail,
  'ratings' | 'ratingSummary' | 'requirementCheck' | 'embeddingMatch'
> & {
  ratings: RatingRow[];
  requirementCheck: RequirementCheckRow | null;
  embeddingMatch: EmbeddingMatchRow | null;
};

/** A Rating as the API answers after a save: the Member's own scores and when they were saved. */
export type SavedRating = RatingValues & { updatedAt: Date };

/** A file an applicant sent with an Application, as recruiters see it: no storage key. */
export interface ApplicationFile {
  id: string;
  /** `cv` for the built-in CV slot, `answer` for the answer to a file question. */
  purpose: FilePurpose;
  /** The file question's key for an `answer`; null for the CV. */
  fieldKey: string | null;
  /** The applicant's own name for the file (untrusted text). */
  originalName: string;
  /** The type of the file, as stored on its row. */
  mimeType: string;
  sizeBytes: number;
  /** What the browser declared for video and audio; null for other files. */
  durationSeconds: number | null;
}

/** An `ApplicationFile` plus where its bytes are. Stays inside the API: never sent to a client. */
export interface DownloadableFile extends ApplicationFile {
  storageKey: string;
}

/** A short-lived link to a file's bytes. */
export interface FileLink {
  url: string;
  expiresInSeconds: number;
}

export const STATUS_FOR_STAGE: Record<StageKind, ApplicationStatus> = {
  normal: 'active',
  hired: 'hired',
  rejected: 'rejected',
};

export const EVENT_FOR_STAGE: Record<StageKind, 'stage_changed' | 'hired' | 'rejected'> = {
  normal: 'stage_changed',
  hired: 'hired',
  rejected: 'rejected',
};