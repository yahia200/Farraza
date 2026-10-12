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