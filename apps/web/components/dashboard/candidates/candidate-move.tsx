'use client';

import { useOptimistic, useTransition } from 'react';
import { moveApplication } from '@/app/actions/applications';
import { toast } from '@/components/ui/toast';
import { MoveToStageSelect, type MoveStageOption } from './move-to-stage-select';

/**
 * The detail sheet's move control. The chosen stage shows at once
 * (useOptimistic) and snaps back if the move fails, for example when someone
 * else already moved the candidate (409): the action then also refreshes the
 * page, so the sheet shows where they really are, and the message is a toast.
 */
export function CandidateMove({
  companySlug,
  jobSlug,
  applicationId,
  stageId,
  stages,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  stageId: string;
  stages: MoveStageOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticStageId, setOptimisticStageId] = useOptimistic(stageId);

  function move(toStageId: string) {
    startTransition(async () => {
      setOptimisticStageId(toStageId);
      const result = await moveApplication(companySlug, jobSlug, applicationId, toStageId);
      if (!result.ok) {
        toast.add({ type: 'error', title: "Couldn't move the candidate", description: result.formError });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Move to</span>
      <MoveToStageSelect stages={stages} currentStageId={optimisticStageId} disabled={pending} onMove={move} />
    </div>
  );
}
