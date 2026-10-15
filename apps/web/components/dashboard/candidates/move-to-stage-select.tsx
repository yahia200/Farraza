'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface MoveStageOption {
  id: string;
  name: string;
}

/**
 * "Move to stage": a Select of the job's stages with the candidate's current
 * one chosen. Presentational on purpose, shared by the detail sheet and the
 * board cards: the caller owns the action, the pending state, and whether to
 * render it at all (interviewers get no control, so it is not rendered).
 * Choosing the stage the candidate is already in does nothing.
 */
export function MoveToStageSelect({
  stages,
  currentStageId,
  disabled,
  onMove,
  label = 'Move to stage',
  size,
  className,
}: {
  stages: MoveStageOption[];
  currentStageId: string;
  /** True while a move is in flight. */
  disabled?: boolean;
  onMove: (stageId: string) => void;
  /** The control's accessible name. Where many are on screen (the board), include who it moves. */
  label?: string;
  size?: 'sm' | 'default';
  className?: string;
}) {
  // Base UI's Select shows an item's label only when it knows the items (`items`).
  const items = stages.map((stage) => ({ value: stage.id, label: stage.name }));

  return (
    <Select
      items={items}
      value={currentStageId}
      disabled={disabled}
      onValueChange={(stageId) => {
        if (stageId && stageId !== currentStageId) {
          onMove(stageId);
        }
      }}
    >
      <SelectTrigger aria-label={label} size={size} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className={className}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
