'use client';

import {
  monitorForElements,
  type ElementEventPayloadMap,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { applyMove } from '@repo/shared';
import { InboxIcon } from 'lucide-react';
import { startTransition, useEffect, useEffectEvent, useOptimistic, useState } from 'react';
import { moveApplication } from '@/app/actions/applications';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { useFinePointer } from '@/hooks/use-fine-pointer';
import type { PipelineColumn } from '@/lib/dal';
import { CandidateCard } from './candidate-card';
import { readApplicationDrag, readStageDrop } from './pipeline-drag';
import { StageColumn } from './stage-column';

interface Move {
  applicationId: string;
  toStageId: string;
}

/**
 * A job's pipeline: one column per stage on desktop, one tab per stage on
 * phones.
 *
 * `columns` come from the server; `useOptimistic` shows a move at once (the
 * shared `applyMove` is the reducer) while the `moveApplication` action runs.
 * When the action's transition ends the board shows the server's columns
 * again: after a success they are the refreshed ones (the action revalidates
 * the page), after a failure they are unchanged, so the card snaps back and
 * a toast says why.
 *
 * Two ways to move a card, both only when `canMove` (interviewers get
 * neither): the "Move to stage" Select on each card (keyboard, touch, the
 * phone tabs), and dragging a card to another column, which is enabled only
 * on a desktop pointer (see hooks/use-fine-pointer.ts). Dropping a card on
 * its own column does nothing.
 *
 * Both layouts are in the HTML and CSS picks one at the `md` breakpoint
 * (768px, the same as hooks/use-mobile.ts). Switching in JS (useIsMobile)
 * would render desktop on the server and swap after hydration; see "Keep the
 * sidebar frame out of <Suspense>" in .claude/rules/web.md.
 */
export function PipelineBoard({
  columns,
  basePath,
  companySlug,
  jobSlug,
  canMove,
}: {
  columns: PipelineColumn[];
  basePath: string;
  companySlug: string;
  jobSlug: string;
  canMove: boolean;
}) {
  const [optimisticColumns, addMove] = useOptimistic(columns, (current, { applicationId, toStageId }: Move) =>
    applyMove(current, applicationId, toStageId),
  );
  const [announcement, setAnnouncement] = useState('');
  const finePointer = useFinePointer();
  const canDrag = canMove && finePointer;
  const stages = columns.map(({ id, name }) => ({ id, name }));

  function move(applicationId: string, toStageId: string) {
    const from = optimisticColumns.find((column) => column.applications.some((card) => card.id === applicationId));
    const card = from?.applications.find((candidate) => candidate.id === applicationId);
    const to = optimisticColumns.find((column) => column.id === toStageId);
    // Same stage (or something that isn't on the board): no API call, no optimistic update.
    if (!from || !card || !to || from.id === toStageId) return;

    setAnnouncement(`Moved ${card.candidate.name} to ${to.name}.`);
    startTransition(async () => {
      addMove({ applicationId, toStageId });
      const result = await moveApplication(companySlug, jobSlug, applicationId, toStageId);
      if (!result.ok) {
        toast.add({ type: 'error', title: "Couldn't move the candidate", description: result.formError });
      }
    });
  }

  // A drop anywhere is handled here, in one place. An Effect Event, so the
  // monitor below is registered once and still calls the latest `move`
  // (re-registering a monitor in the middle of a drag would be risky).
  const onDrop = useEffectEvent(({ source, location }: ElementEventPayloadMap['onDrop']) => {
    const drag = readApplicationDrag(source.data);
    // The innermost drop target that is a stage column; none = dropped outside the columns.
    const toStageId = location.current.dropTargets.map((target) => readStageDrop(target.data)).find(Boolean);
    if (drag && toStageId) {
      move(drag.applicationId, toStageId);
    }
  });
  useEffect(() => {
    if (!canDrag) return;
    return monitorForElements({
      canMonitor: ({ source }) => readApplicationDrag(source.data) !== null,
      onDrop,
    });
  }, [canDrag]);

  if (optimisticColumns.every((column) => column.applications.length === 0)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No one has applied yet</EmptyTitle>
          <EmptyDescription>Candidates will appear here, in their stage, as they apply.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* Announces a move to screen readers: the card leaves the control that was used. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {/* `w-0 min-w-full`: the row scrolls inside the page instead of its width (5+ columns) widening the whole layout. */}
      <div className="hidden w-0 min-w-full auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto md:grid">
        {optimisticColumns.map((column) => (
          <StageColumn key={column.id} column={column} acceptsDrops={canDrag}>
            <StageCards
              column={column}
              stages={stages}
              basePath={basePath}
              canMove={canMove}
              canDrag={canDrag}
              onMove={move}
            />
          </StageColumn>
        ))}
      </div>

      <Tabs defaultValue={optimisticColumns[0]?.id} className="md:hidden">
        {/* Six stages don't fit a phone: the list scrolls sideways (the cards below never do). */}
        <TabsList className="w-full justify-start overflow-x-auto">
          {optimisticColumns.map((column) => (
            <TabsTrigger key={column.id} value={column.id} className="flex-none">
              {column.name}
              <Badge variant="secondary">{column.applications.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {optimisticColumns.map((column) => (
          <TabsContent key={column.id} value={column.id}>
            {/* One column at a time, so there is nothing to drop on: no drag here. */}
            <StageCards
              column={column}
              stages={stages}
              basePath={basePath}
              canMove={canMove}
              canDrag={false}
              onMove={move}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function StageCards({
  column,
  stages,
  basePath,
  canMove,
  canDrag,
  onMove,
}: {
  column: PipelineColumn;
  stages: { id: string; name: string }[];
  basePath: string;
  canMove: boolean;
  canDrag: boolean;
  onMove: (applicationId: string, toStageId: string) => void;
}) {
  if (column.applications.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
        No candidates in this stage.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {column.applications.map((card) => (
        <li key={card.id}>
          <CandidateCard
            card={card}
            stageId={column.id}
            stages={stages}
            basePath={basePath}
            canMove={canMove}
            canDrag={canDrag}
            onMove={onMove}
          />
        </li>
      ))}
    </ul>
  );
}
