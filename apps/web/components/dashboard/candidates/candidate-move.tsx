'use client';

import { statusForStageKind, type ApplicationStatus, type StageKind } from '@repo/shared';
import { useOptimistic, useTransition } from 'react';
import { moveApplication, type MoveApplicationResult } from '@/app/actions/applications';
import { toast } from '@/components/ui/toast';
import { CandidateStageBadges } from './candidate-stage-badges';
import { MoveToStageSelect, type MoveStageOption } from './move-to-stage-select';

/**
 * The detail sheet's stage badges and move control. The chosen stage shows at
 * once (useOptimistic): the Select, the stage badge and the status badge (the
 * status the new stage's kind gives, `statusForStageKind`). All snap back if
 * the move fails, for example when someone else already moved the candidate
 * (409): the action then also refreshes the page, so the sheet shows where
 * they really are, and the message is a toast.
 */
export function CandidateMove({
  companySlug,
  jobSlug,
  applicationId,
  stageId,
  status,
  stages,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  /** The stage the server says the candidate is in. */
  stageId: string;
  /** The status the server says the candidate has. */
  status: ApplicationStatus;
  stages: (MoveStageOption & { kind: StageKind })[];
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticStageId, setOptimisticStageId] = useOptimistic(stageId);

  function move(toStageId: string) {
    startTransition(async () => {
      setOptimisticStageId(toStageId);
      let result: MoveApplicationResult;
      try {
        result = await moveApplication(companySlug, jobSlug, applicationId, toStageId);
      } catch {
        // The request itself failed (offline, server down). The control snaps back when the transition ends; no error boundary.
        result = { formError: 'Check your connection and try again.' };
      }
      if (!result.ok) {
        toast.add({ type: 'error', title: "Couldn't move the candidate", description: result.formError });
      }
    });
  }

  // Unmoved: show the server's status as is (it can be "withdrawn", which no stage kind gives).
  const optimisticStage = stages.find((stage) => stage.id === optimisticStageId);
  const optimisticStatus =
    optimisticStage && optimisticStageId !== stageId ? statusForStageKind(optimisticStage.kind) : status;

  return (
    <>
      <CandidateStageBadges stageName={optimisticStage?.name ?? ''} status={optimisticStatus} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Move to</span>
        <MoveToStageSelect stages={stages} currentStageId={optimisticStageId} disabled={pending} onMove={move} />
      </div>
    </>
  );
}
