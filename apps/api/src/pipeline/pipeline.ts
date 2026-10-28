import type {
  Answers,
  CvMode,
  FilePurpose,
  FormFields,
  Highlight,
  HighlightKind,
  RatingSummary,
  RatingValues,
} from '@repo/shared';
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
}

/** A card as `PipelineRepository` reads it, before the service adds the Highlighted answers and the rating. */
export type CardRow = Omit<ApplicationCard, 'highlights' | 'rating'>;

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
  events: ApplicationEventView[];
  notes: NoteView[];
  /** Every Member's Rating of this Application, oldest first. */
  ratings: RatingView[];
  /** The count, the average and the per-Criterion averages of `ratings` (`summariseRatings`). */
  ratingSummary: RatingSummary;
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
export type ApplicationDetailRow = Omit<ApplicationDetail, 'ratings' | 'ratingSummary'> & {
  ratings: RatingRow[];
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