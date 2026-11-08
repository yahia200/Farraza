import type { Requirement, ScreeningRule } from '@repo/shared';
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
  /**
   * Keys of the rating Criteria raters may score on this Job (catalog keys from `@repo/shared`, at
   * most `RATING_CRITERIA_LIMIT`), as last saved. Empty means the Job is rated on the overall alone.
   */
  ratingCriteria: string[];
  /**
   * The Job's Screening rules as last saved (`@repo/shared` `ScreeningRule`, at most
   * `SCREENING_RULES_LIMIT`). Validated against the form when saved, so a rule can be stale once a
   * newer form version is published.
   */
  screeningRules: ScreeningRule[];
}

/**
 * One immutable version of a Job's Requirements (`job_requirement_versions`). The Job's current
 * version is its highest `version`; a version is never edited, and an empty list is a valid one.
 */
export interface RequirementVersion {
  companyId: string;
  jobId: string;
  version: number;
  requirements: Requirement[];
  createdAt: Date;
}

export interface JobWithStages extends Job {
  stages: Stage[];
  /** The Job's current Requirements (its highest `RequirementVersion`); `[]` before the first save. */
  requirements: Requirement[];
  /** The number of that version; `0` while the Job has none. */
  requirementsVersion: number;
}

/**
 * The Job as the manager-facing `GET .../jobs/:jobSlug` returns it: the Job with its stages and
 * current Requirements, plus whether the Requirements are locked by the Edit limit (the Job holds
 * `REQUIREMENT_EDIT_LIMIT` or more Applications, of any status). Never part of a public payload.
 */
export interface JobDetail extends JobWithStages {
  requirementsLocked: boolean;
}

export const DEFAULT_STAGES: ReadonlyArray<Omit<Stage, 'id'>> = [
  { name: 'Applied', position: 0, kind: 'normal', publicLabel: 'received' },
  { name: 'Screening', position: 1, kind: 'normal', publicLabel: 'in_review' },
  { name: 'Interview', position: 2, kind: 'normal', publicLabel: 'interview' },
  { name: 'Offer', position: 3, kind: 'normal', publicLabel: 'offer' },
  { name: 'Rejected', position: 4, kind: 'rejected', publicLabel: 'closed' },
  { name: 'Hired', position: 5, kind: 'hired', publicLabel: 'closed' },
];