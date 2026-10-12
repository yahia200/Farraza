import type { Answers, FormFields } from '@repo/shared';

export interface OpenJob {
  company: { id: string; name: string; slug: string; logoUrl: string | null; brandColor: string | null };
  job: { id: string; title: string; description: string | null };
  form: { id: string; fields: FormFields };
  firstStageId: string;
  rejectedStageId: string;
}

export interface NewApplication {
  companyId: string;
  jobId: string;
  formVersionId: string;
  stageId: string;
  status: 'active' | 'rejected';
  candidate: { email: string; name: string; phone: string };
  answers: Answers;
  source: string | null;
  events: Array<{
    type: 'applied' | 'auto_rejected';
    fromStageId: string | null;
    toStageId: string;
    data: Record<string, string | null>;
  }>;
}