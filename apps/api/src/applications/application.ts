import type {
  Answers,
  CvMode,
  CvSuggestions,
  CvTextStatus,
  FilePurpose,
  FormFields,
  Requirement,
  RequirementMatches,
  ScreeningFlag,
  ScreeningOutcome,
  ScreeningRule,
} from '@repo/shared';

export interface OpenJob {
  company: { id: string; name: string; slug: string; logoUrl: string | null; brandColor: string | null };
  job: { id: string; title: string; description: string | null };
  form: { id: string; fields: FormFields; cvMode: CvMode };
  /** The job's Screening rules, read at submit. Never leaves the API: no public payload carries them. */
  screeningRules: ScreeningRule[];
  /** The job's current Requirements version (highest `job_requirement_versions.version`), or null if it never had one. Never leaves the API. */
  requirements: { version: number; list: Requirement[] } | null;
  firstStageId: string;
  rejectedStageId: string;
}

/**
 * A company's public listing: its branding and its open jobs, for GET
 * /api/public/:companySlug. Only the fields applicants may see — no internal
 * job id, status or timestamps. `slug` stays, because the page links each job
 * to its apply page (/{companySlug}/{jobSlug}).
 */
export interface CompanyOpenJobs {
  company: { name: string; slug: string; logoUrl: string | null; brandColor: string | null };
  jobs: Array<{ title: string; slug: string; description: string | null }>;
}

/** A file the applicant uploaded for this submission, to be attached inside the Application's transaction. */
export interface FileToAttach {
  id: string;
  purpose: FilePurpose;
  /** The file question's key for an `answer`; null for the CV. */
  fieldKey: string | null;
  /** The type found in the object's bytes (not the browser's claim); stored on the row when attached. */
  mimeType: string;
}

/**
 * A pending, unattached `files` row of this job that a submit refers to, with what the check at
 * submit compares the bucket object against.
 */
export interface FileToVerify {
  id: string;
  purpose: FilePurpose;
  fieldKey: string | null;
  storageKey: string;
  /** The size declared when the upload was created, which the presigned URL pinned. */
  sizeBytes: number;
}

/** A `files` row created when an upload starts, before any bytes exist and before the Application does. */
export interface NewPendingFile {
  id: string;
  companyId: string;
  jobId: string;
  purpose: FilePurpose;
  fieldKey?: string | null;
  storageKey: string;
  /** The applicant's own name for the file: untrusted, shown to recruiters, never part of the key. */
  originalName: string;
  /** What the browser declared; a later check replaces it with the type found in the bytes. */
  mimeType: string;
  sizeBytes: number;
  /** Video and audio only: the length in whole seconds the browser declared; the server does not re-measure it. */
  durationSeconds?: number | null;
}

/**
 * How a submit ended. A `file_conflict` means a referenced file isn't this job's, doesn't match its
 * question, is already attached or is missing; nothing was saved. It names the first such file, so
 * the applicant is sent to the right step.
 */
export type SubmitResult =
  | 'created'
  | 'duplicate'
  | { status: 'file_conflict'; fileId: string };

/**
 * The CV text row written with the Application (ADR-0006, `docs/db-schema.md` §3.22). Built by the
 * service: the status is resolved and the text cut by the shared rules, and `result` is the shared
 * extractor's output for `text`, never anything the client sent. No route ever reads it back.
 */
export interface NewCvText {
  /** The CV's `files` row, which this row lives and dies with. */
  fileId: string;
  status: CvTextStatus;
  text: string;
  result: CvSuggestions;
  extractorVersion: number;
}

/**
 * The Requirement result row written with the Application (`docs/db-schema.md` §3.24). Built by the
 * service from the job's current version and a readable CV text; the version says which Requirements
 * it was checked against. Never returned by a public route.
 */
export interface NewRequirementResult {
  version: number;
  results: RequirementMatches;
  missedMustHave: boolean;
}

export interface NewApplication {
  companyId: string;
  jobId: string;
  formVersionId: string;
  stageId: string;
  status: 'active' | 'rejected';
  candidate: { email: string; name: string; phone: string };
  answers: Answers;
  /** The flag-outcome rules that fired, stored on the Application (`applications.flags`); `[]` for none. */
  flags: ScreeningFlag[];
  files: FileToAttach[];
  /** Saved in the same transaction; null when the Application has no CV. */
  cvText: NewCvText | null;
  /** Saved in the same transaction; null when there is nothing to check (no version, or no readable CV). */
  requirementResult: NewRequirementResult | null;
  source: string | null;
  events: Array<{
    type: 'applied' | 'auto_rejected' | 'flagged';
    fromStageId: string | null;
    toStageId: string;
    /**
     * `applied` carries the source; `auto_rejected` the reject rules that fired, with reasons;
     * `flagged` the flag rules that fired (the same list as `flags`).
     */
    data:
      | { source: string | null }
      | { rules: ScreeningFlag[] }
      | {
          rules: Array<{
            ruleId: string;
            questionKey: string;
            questionLabel: string;
            outcome: ScreeningOutcome;
            reason: string;
          }>;
        };
  }>;
}