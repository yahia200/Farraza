import type { ApplicationStatus } from '@repo/shared';
import { Badge } from '@/components/ui/badge';
import { ApplicationStatusBadge } from './application-status-badge';

/**
 * The stage name and status of a candidate, as shown in the detail sheet's
 * header. Presentational (no 'use client'), so the Server Component detail
 * renders it for people who can't move candidates, and the client
 * `CandidateMove` renders it with the optimistic stage for those who can.
 */
export function CandidateStageBadges({ stageName, status }: { stageName: string; status: ApplicationStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{stageName}</Badge>
      <ApplicationStatusBadge status={status} />
    </div>
  );
}
