import type { Answers, CvMode, FormFields } from '@repo/shared';

export interface OpenJob {
  company: { id: string; name: string; slug: string; logoUrl: string | null; brandColor: string | null };
  job: { id: string; title: string; description: string | null };
  form: { id: string; fields: FormFields; cvMode: CvMode };
  firstStageId: string;
  rejectedStageId: string;
}

/** A file the applicant uploaded for this submission, to be attached inside the Application's transaction. */
export interface FileToAttach {
  id: string;
  purpose: 'cv' | 'answer';
  /** The file question's key for an `answer`; null for the CV. */
  fieldKey: string | null;
}

/** A `files` row created when an upload starts, before any bytes exist and before the Application does. */
export interface NewPendingFile {
  id: string;
  companyId: string;
  jobId: string;
  purpose: 'cv' | 'answer';
  fieldKey?: string | null;
  storageKey: string;
  /** The applicant's own name for the file: untrusted, shown to recruiters, never part of the key. */
  originalName: string;
  /** What the browser declared; a later check replaces it with the type found in the bytes. */
  mimeType: string;
  sizeBytes: number;
}

/**
 * How a submit ended. `file_conflict` means a referenced file isn't this job's, doesn't match, is
 * already attached or is missing; nothing was saved.
 */
export type SubmitResult = 'created' | 'duplicate' | 'file_conflict';

export interface NewApplication {
  companyId: string;
  jobId: string;
  formVersionId: string;
  stageId: string;
  status: 'active' | 'rejected';
  candidate: { email: string; name: string; phone: string };
  answers: Answers;
  files: FileToAttach[];
  source: string | null;
  events: Array<{
    type: 'applied' | 'auto_rejected';
    fromStageId: string | null;
    toStageId: string;
    data: Record<string, string | null>;
  }>;
}