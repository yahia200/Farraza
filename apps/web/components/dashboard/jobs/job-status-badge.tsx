import type { JobStatus } from '@/lib/dal';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

const VARIANTS = {
  draft: 'secondary',
  open: 'default',
  closed: 'destructive',
} as const satisfies Record<JobStatus, BadgeVariant>;

/**
 * Open is the solid brand badge, because it is the one state that is live and
 * taking applications. Draft is the grey `secondary` badge: not public yet, so
 * it should not draw the eye. Closed is `destructive`: the job has stopped
 * accepting applications, which is the state a manager most needs to notice.
 */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={VARIANTS[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}
