import type { JobStatus } from '@/lib/dal';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

// TODO(human): choose a badge variant for each job status, and update the doc comment below to say why.
const VARIANTS = {
  draft: 'secondary',
  open: 'default',
  closed: 'destructive',
} as const satisfies Record<JobStatus, BadgeVariant>;

/** Open stands out; drafts and closed jobs are quieter. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={VARIANTS[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}
