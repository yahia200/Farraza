import type { FormFields } from '@repo/shared';

export interface FormVersion {
  id: string;
  version: number;
  fields: FormFields;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface JobForm {
  /** The version being edited, if any. */
  draft: FormVersion | null;
  /** The version applicants currently see, if any. */
  published: FormVersion | null;
}