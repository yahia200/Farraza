import type { CvMode, FormFields } from '@repo/shared';

export interface FormVersion {
  id: string;
  version: number;
  fields: FormFields;
  /** Whether the form asks for a CV. It sits beside `fields`, not in it (ADR-0002). */
  cvMode: CvMode;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface JobForm {
  /** The version being edited, if any. */
  draft: FormVersion | null;
  /** The version applicants currently see, if any. */
  published: FormVersion | null;
}