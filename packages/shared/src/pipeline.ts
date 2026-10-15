/**
 * Pure pipeline logic shared by the API and the web app: what an application's
 * status is in a stage, how a board changes when a card moves, and how an
 * application's history reads. Shapes mirror the API's responses in
 * apps/api/src/pipeline/pipeline.ts (dates as ISO strings, as the web gets them).
 */

/** Mirrors StageKind in apps/api/src/jobs/job.ts. */
export type StageKind = 'normal' | 'hired' | 'rejected';

/** Mirrors ApplicationStatus in apps/api/src/pipeline/pipeline.ts. */
export type ApplicationStatus = 'active' | 'rejected' | 'hired' | 'withdrawn';

const STATUS_FOR_STAGE_KIND: Record<StageKind, ApplicationStatus> = {
  normal: 'active',
  hired: 'hired',
  rejected: 'rejected',
};

/**
 * The status an application takes when it is in a stage of this kind. Mirrors
 * STATUS_FOR_STAGE in apps/api/src/pipeline/pipeline.ts.
 */
export function statusForStageKind(kind: StageKind): ApplicationStatus {
  return STATUS_FOR_STAGE_KIND[kind];
}

/** The part of a board card the move logic needs; the API's card has more (candidate), which is kept. */
export interface BoardApplication {
  id: string;
  status: ApplicationStatus;
  /** ISO timestamp. Cards are listed newest first in a column. */
  submittedAt: string;
}

/** One stage column of the board, as GET .../applications returns it. */
export interface BoardColumn<A extends BoardApplication = BoardApplication> {
  id: string;
  name: string;
  kind: StageKind;
  applications: A[];
}

/**
 * The board after moving a card to another stage: the card leaves its column,
 * lands in the target (newest first, as the API orders a column, so the board
 * doesn't reshuffle when the server's copy arrives) and takes the status the
 * target stage's kind gives it. Nothing is mutated; untouched columns keep their
 * identity. When there is nothing to move (the card is already in that stage, or the
 * card or stage is not on the board) the same array comes back.
 */
export function applyMove<A extends BoardApplication, C extends BoardColumn<A>>(
  columns: C[],
  applicationId: string,
  toStageId: string,
): C[] {
  const source = columns.find((column) => column.applications.some((application) => application.id === applicationId));
  const card = source?.applications.find((application) => application.id === applicationId);
  const target = columns.find((column) => column.id === toStageId);
  if (!source || !card || !target || source.id === toStageId) {
    return columns;
  }

  const moved = { ...card, status: statusForStageKind(target.kind) };
  return columns.map((column) => {
    if (column.id === toStageId) {
      const before = column.applications.findIndex(
        (application) => Date.parse(application.submittedAt) < Date.parse(moved.submittedAt),
      );
      const applications = [...column.applications];
      applications.splice(before === -1 ? applications.length : before, 0, moved);
      return { ...column, applications };
    }
    if (column.id === source.id) {
      return {
        ...column,
        applications: column.applications.filter((application) => application.id !== applicationId),
      };
    }
    return column;
  });
}

/** An application event, as GET .../applications/:id returns it (apps/api ApplicationEventView). */
export interface ActivityEvent {
  id: string;
  /** `applied`, `auto_rejected`, `stage_changed`, `hired`, `rejected`, `note_added`, ... (docs/db-schema.md 4.3). */
  type: string;
  fromStageId: string | null;
  toStageId: string | null;
  actorId: string | null;
  /** Shape depends on `type`; `note_added` carries `{ noteId }`. */
  data: unknown;
  /** ISO timestamp. */
  createdAt: string;
}

/** A note, as the same response returns it (apps/api NoteView). */
export interface ActivityNote {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

/** One line of an application's history: the event, plus the note it refers to (`note_added` only). */
export interface ActivityEntry extends ActivityEvent {
  /** Null for every other event type, and for a `note_added` whose note cannot be found. */
  note: ActivityNote | null;
}

/**
 * The application's history in one list, oldest first. Events are the spine: they
 * carry only `{ noteId }` for a note, so each `note_added` is resolved to its note
 * (notes are not listed separately, which would show them twice). Events at the same
 * moment keep the order they were given in. Neither input is changed.
 */
export function buildActivityTimeline(
  events: readonly ActivityEvent[],
  notes: readonly ActivityNote[],
): ActivityEntry[] {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  return events
    .map((event): ActivityEntry => ({
      ...event,
      note: event.type === 'note_added' ? (notesById.get(noteIdOf(event.data)) ?? null) : null,
    }))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The `noteId` of a `note_added` event's data, or an empty string if it has none. */
function noteIdOf(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'noteId' in data && typeof data.noteId === 'string') {
    return data.noteId;
  }
  return '';
}
