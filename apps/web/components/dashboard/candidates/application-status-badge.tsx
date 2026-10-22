import type { ApplicationStatus } from '@repo/shared';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  active: 'In progress',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const VARIANTS = {
  active: 'secondary',
  hired: 'success',
  rejected: 'destructive',
  withdrawn: 'outline',
} as const satisfies Record<ApplicationStatus, BadgeVariant>;

/** An application's status. The API derives it from the stage's kind (pipeline.ts, STATUS_FOR_STAGE). */
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={VARIANTS[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>;
}
