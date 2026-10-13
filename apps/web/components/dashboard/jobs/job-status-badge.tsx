import type { JobStatus } from '@/lib/dal';
import { Badge } from '@/components/ui/badge';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

/** Open stands out; drafts and closed jobs are quieter. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant={status === 'open' ? 'default' : status === 'draft' ? 'outline' : 'secondary'}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}
