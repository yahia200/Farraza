export type JobStatus = 'draft' | 'open' | 'closed';
export type StageKind = 'normal' | 'hired' | 'rejected';
export type PublicLabel = 'received' | 'in_review' | 'interview' | 'offer' | 'closed';

export interface Stage {
  id: string;
  name: string;
  position: number;
  kind: StageKind;
  publicLabel: PublicLabel;
}

export interface Job {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: JobStatus;
  openedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Keys of the Questions shown on every Application in the candidate list, as last saved. A key can
   * be stale (the latest published form no longer has it); readers filter against that form.
   */
  highlightedQuestionKeys: string[];
}

export interface JobWithStages extends Job {
  stages: Stage[];
}

export const DEFAULT_STAGES: ReadonlyArray<Omit<Stage, 'id'>> = [
  { name: 'Applied', position: 0, kind: 'normal', publicLabel: 'received' },
  { name: 'Screening', position: 1, kind: 'normal', publicLabel: 'in_review' },
  { name: 'Interview', position: 2, kind: 'normal', publicLabel: 'interview' },
  { name: 'Offer', position: 3, kind: 'normal', publicLabel: 'offer' },
  { name: 'Rejected', position: 4, kind: 'rejected', publicLabel: 'closed' },
  { name: 'Hired', position: 5, kind: 'hired', publicLabel: 'closed' },
];