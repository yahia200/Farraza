"use client";

import { draggable } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { HighlightedQuestion, PipelineCard } from "@/lib/dal";
import { cn } from "@/lib/utils";
import { ApplicationStatusBadge } from "./application-status-badge";
import { candidatesHref } from "./candidates-href";
import { ContactActions } from "./contact-actions";
import { HighlightAnswer } from "./highlight-answer";
import {
  MoveToStageSelect,
  type MoveStageOption,
} from "./move-to-stage-select";
import { applicationDragData } from "./pipeline-drag";

/**
 * One application on the board, used by both the desktop columns and the
 * mobile stage tabs.
 *
 * The card is a div holding two siblings: a link (the name, then one block
 * per Highlighted question: the Question in small muted type over the
 * answer, clamped to two lines, "—" for none) that opens the detail sheet
 * (?application=<id>), and, for people who can move
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
  highlightedQuestions,
  stageId,
  stages,
  basePath,
  canMove,
  canDrag,
  onMove,
}: {
  card: PipelineCard;
  /** The Job's Highlighted questions, in form order: one label-over-answer block each, under the name. */
  highlightedQuestions: HighlightedQuestion[];
  /** The stage the card is in now (the optimistic one). */
  stageId: string;
  stages: MoveStageOption[];
  basePath: string;
  canMove: boolean;
  canDrag: boolean;
  onMove: (applicationId: string, toStageId: string) => void;
}) {
  const nameId = useId();
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
          getOffset: preserveOffsetOnSource({
            element: source.element,
            input: location.current.input,
          }),
          render: ({ container }) => {
            // Match the card's on-board width; the column no longer constrains it.
            container.style.width = `${source.element.getBoundingClientRect().width}px`;
            // The preview is a copy of the card as it looks now. The library
            // removes `container` itself when the drag ends, so no cleanup.
            const preview = source.element.cloneNode(true) as HTMLElement;
            preview.removeAttribute("data-dragging");
            preview.classList.add("shadow-lg");
            container.appendChild(preview);
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
        "relative flex flex-col rounded-xl border bg-card text-sm text-card-foreground shadow-xs transition-opacity has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/30 data-dragging:opacity-40 hover:bg-muted/25",
        canDrag && "cursor-grab",
      )}
    >
      <Link
        ref={handleRef}
        href={candidatesHref(basePath, { view: "board", application: card.id })}
        scroll={false}
        draggable={false}
        // Named by the candidate alone, not every answer below the name.
        aria-labelledby={nameId}
        className="flex flex-col gap-1 rounded-xl p-3 outline-none transition-colors"
      >
        {/* pr-14 keeps a long name clear of the call/email icons laid over the corner. */}
        <span id={nameId} className="truncate pr-14 font-medium">
          {card.candidate.name}
        </span>

        {highlightedQuestions.length > 0 && (
          <dl className="mt-1 flex flex-col gap-2">
            {highlightedQuestions.map(({ key, label }) => (
              <div key={key} className="flex min-w-0 flex-col gap-0.5">
                <dt className="truncate text-xs text-muted-foreground">
                  {label}
                </dt>
                <dd>
                  <HighlightAnswer
                    answer={card.highlights[key] ?? null}
                    className="line-clamp-2 wrap-anywhere"
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Link>
      {/* A sibling of the link, not inside it: a link can't contain links, and a click here must not open the sheet. */}
      <ContactActions
        name={card.candidate.name}
        email={card.candidate.email}
        phone={card.candidate.phone}
        className="absolute right-2 top-2"
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        {canMove && (
          <MoveToStageSelect
            stages={stages}
            currentStageId={stageId}
            label={`Move ${card.candidate.name} to stage`}
            size="sm"
            className="w-full text-xs h-auto! py-1 px-2 font-medium"
            onMove={(toStageId) => onMove(card.id, toStageId)}
          />
        )}
      </div>
    </div>
  );
}
