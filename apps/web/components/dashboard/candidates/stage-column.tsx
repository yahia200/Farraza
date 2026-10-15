'use client';

import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { PipelineColumn } from '@/lib/dal';
import { readApplicationDrag, stageDropData } from './pipeline-drag';

/**
 * One stage column of the desktop board: its heading, count, and cards (the
 * children). When `acceptsDrops`, a dragged candidate can be dropped on it;
 * the column the card came from is not a target, so dropping a card back
 * where it started is a no-op by construction. The board's monitor reacts to
 * the drop; the column only highlights itself while a card is over it.
 */
export function StageColumn({
  column,
  acceptsDrops,
  children,
}: {
  column: PipelineColumn;
  acceptsDrops: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!acceptsDrops || !element) return;
    return dropTargetForElements({
      element,
      getData: () => stageDropData(column.id),
      canDrop: ({ source }) => {
        const drag = readApplicationDrag(source.data);
        return drag !== null && drag.fromStageId !== column.id;
      },
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [acceptsDrops, column.id]);

  return (
    <section
      ref={ref}
      aria-labelledby={`stage-${column.id}`}
      data-over={isOver || undefined}
      className="flex min-w-0 flex-col gap-3 rounded-2xl bg-muted/50 p-3 ring-2 ring-transparent transition-shadow data-over:bg-muted data-over:ring-ring"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id={`stage-${column.id}`} className="truncate text-sm font-medium">
          {column.name}
        </h2>
        <Badge variant="secondary">{column.applications.length}</Badge>
      </header>
      {children}
    </section>
  );
}
