import { Badge } from '@/components/ui/badge';
import type { ApplicationStatus } from '@/lib/dal';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  active: 'In progress',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const VARIANTS = {
  active: 'secondary',
  hired: 'default',
  rejected: 'destructive',
  withdrawn: 'outline',
} as const satisfies Record<ApplicationStatus, 'default' | 'secondary' | 'destructive' | 'outline'>;

/** An application's status. The API derives it from the stage's kind (pipeline.ts, STATUS_FOR_STAGE). */
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={VARIANTS[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>;
}
