/**
 * What a card drag carries and what a column drop target offers.
 * pragmatic-drag-and-drop types `data` as Record<string, unknown>, so these
 * helpers are the one place that builds and narrows it.
 */

const APPLICATION = 'pipeline-application';
const STAGE = 'pipeline-stage';

/** `data` for a dragged candidate card. `fromStageId` is the column it was picked up from. */
export function applicationDragData(applicationId: string, fromStageId: string) {
  return { type: APPLICATION, applicationId, fromStageId };
}

/** The dragged card's data, or null if what is being dragged is something else (a file, selected text, ...). */
export function readApplicationDrag(data: Record<string | symbol, unknown>) {
  if (data.type === APPLICATION && typeof data.applicationId === 'string' && typeof data.fromStageId === 'string') {
    return { applicationId: data.applicationId, fromStageId: data.fromStageId };
  }
  return null;
}

/** `data` for a stage column that cards can be dropped on. */
export function stageDropData(stageId: string) {
  return { type: STAGE, stageId };
}

/** The stage a drop target stands for, or null if it is not a stage column. */
export function readStageDrop(data: Record<string | symbol, unknown>) {
  return data.type === STAGE && typeof data.stageId === 'string' ? data.stageId : null;
}
