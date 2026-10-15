'use client';

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
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
      // Draw our own drag preview instead of the browser's native snapshot.
      // Chromium snapshots the dragged node within its stacking/paint context,
      // which here sweeps in the title, tabs and view toggle above the board.
      // A custom preview is rendered into a fresh container on <body>, so it's
      // only ever the card. `preserveOffsetOnSource` keeps the preview pinned
      // to the exact point on the card where the pointer grabbed it.
      onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: preserveOffsetOnSource({ element: source.element, input: location.current.input }),
          render: ({ container }) => {
            // Match the card's on-board width; the column no longer constrains it.
            container.style.width = `${source.element.getBoundingClientRect().width}px`;
            // TODO(human): render the drag preview into `container` and return a
            // cleanup that removes what you added (or return nothing).
          },
        });
      },
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [canDrag, card.id, stageId]);

  return (
    <div
      ref={cardRef}
      data-dragging={dragging || undefined}
      className={cn(
        'flex flex-col rounded-xl border bg-card text-sm text-card-foreground shadow-xs transition-opacity has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/30 data-dragging:opacity-40 hover:bg-muted/25',
        canDrag && 'cursor-grab',
      )}
    >
      <Link
        ref={handleRef}
        href={candidatesHref(basePath, { view: 'board', application: card.id })}
        scroll={false}
        draggable={false}
        className="flex flex-col gap-1 rounded-xl p-3 outline-none transition-colors"
      >
        <span className="truncate font-medium">{card.candidate.name}</span>
       
      </Link>
      {canMove && (
        <div className="px-3 pb-3">
          <MoveToStageSelect
            stages={stages}
            currentStageId={stageId}
            label={`Move ${card.candidate.name} to stage`}
            size="sm"
            className="w-full text-xs h-auto! py-1 px-2 font-medium"
            onMove={(toStageId) => onMove(card.id, toStageId)}
          />
        </div>
      )}
    </div>
  );
}
