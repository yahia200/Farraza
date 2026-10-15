'use client';

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PipelineCard } from '@/lib/dal';
import { cn } from '@/lib/utils';
import { ApplicationStatusBadge } from './application-status-badge';
import { candidatesHref } from './candidates-href';
import { MoveToStageSelect, type MoveStageOption } from './move-to-stage-select';
import { applicationDragData } from './pipeline-drag';

/**
 * One application on the board, used by both the desktop columns and the
 * mobile stage tabs.
 *
 * The card is a div holding two siblings: a link (name, email, date) that
 * opens the detail sheet (?application=<id>), and, for people who can move
 * candidates, the "Move to stage" Select. They are siblings because a
 * control can't sit inside a link (interactive content in <a> is invalid
 * HTML and a click on it would also follow the link).
 *
 * `canDrag` makes the card draggable by its link area (desktop pointer only,
 * decided by the board). The link itself is `draggable={false}`: an <a> is
 * natively draggable, and pragmatic-drag-and-drop only reacts when the
 * dragged element is the registered card, so the browser must start the drag
 * from the card instead. A finished drag fires no click, so it doesn't open
 * the sheet.
 */
export function CandidateCard({
  card,
  stageId,
  stages,
  basePath,
  canMove,
  canDrag,
  onMove,
}: {
  card: PipelineCard;
  /** The stage the card is in now (the optimistic one). */
  stageId: string;
  stages: MoveStageOption[];
  basePath: string;
  canMove: boolean;
  canDrag: boolean;
  onMove: (applicationId: string, toStageId: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLAnchorElement>(null);
  const [dragging, setDragging] = useState(false);

  // Registered only while dragging is allowed. `canDrag: () => false` would
  // cancel the drag page-wide, so a card that can't be dragged is simply not
  // registered. The cleanup unregisters it.
  useEffect(() => {
    const element = cardRef.current;
    const dragHandle = handleRef.current;
    if (!canDrag || !element || !dragHandle) return;
    return draggable({
      element,
      // Only the link area starts a drag, so pressing the Select never does.
      dragHandle,
      getInitialData: () => applicationDragData(card.id, stageId),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [canDrag, card.id, stageId]);

  return (
    <div
      ref={cardRef}
      data-dragging={dragging || undefined}
      className={cn(
        'flex flex-col rounded-xl border bg-card text-sm text-card-foreground shadow-xs transition-opacity has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/30 data-dragging:opacity-40',
        canDrag && 'cursor-grab',
      )}
    >
      <Link
        ref={handleRef}
        href={candidatesHref(basePath, { view: 'board', application: card.id })}
        scroll={false}
        draggable={false}
        className="flex flex-col gap-1 rounded-xl p-3 outline-none transition-colors hover:bg-muted/50"
      >
        <span className="truncate font-medium">{card.candidate.name}</span>
        <span className="truncate text-xs text-muted-foreground">{card.candidate.email}</span>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {card.appliedLabel}
          {/* Every card in an in-progress stage would carry the same badge: only the outcomes are worth showing. */}
          {card.status !== 'active' && <ApplicationStatusBadge status={card.status} />}
        </span>
      </Link>
      {canMove && (
        <div className="px-3 pb-3">
          <MoveToStageSelect
            stages={stages}
            currentStageId={stageId}
            label={`Move ${card.candidate.name} to stage`}
            size="sm"
            className="w-full"
            onMove={(toStageId) => onMove(card.id, toStageId)}
          />
        </div>
      )}
    </div>
  );
}
