import type { Answers, FormFields } from '@repo/shared';
import type { StageKind } from '../jobs/job.js';

export type ApplicationStatus = 'active' | 'rejected' | 'hired' | 'withdrawn';

export interface ApplicationCard {
  id: string;
  stageId: string;
  status: ApplicationStatus;
  submittedAt: Date;
  candidate: { name: string; email: string };
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
  answers: Answers;
  events: ApplicationEventView[];
  notes: NoteView[];
}

/** A file an applicant sent with an Application, as recruiters see it: no storage key. */
export interface ApplicationFile {
  id: string;
  /** `cv` for the built-in CV slot, `answer` for the answer to a file question. */
  purpose: 'cv' | 'answer';
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