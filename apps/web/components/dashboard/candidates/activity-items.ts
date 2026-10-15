import { buildActivityTimeline, type ActivityEntry, type ActivityEvent, type ActivityNote } from '@repo/shared';
import { formatDateTime } from '@/lib/format';

/**
 * One line of the activity timeline, ready to render: plain strings only, so
 * it can cross from the Server Component to the client timeline. Built on the
 * server because the times are formatted there (lib/format.ts).
 */
export type ActivityItem =
  | { kind: 'event'; id: string; text: string; at: string }
  | { kind: 'note'; id: string; body: string; author: string; at: string; pending?: boolean };

/** The application's history, oldest first, as items to render. */
export function toActivityItems(events: readonly ActivityEvent[], notes: readonly ActivityNote[]): ActivityItem[] {
  return buildActivityTimeline(events, notes).map((entry): ActivityItem => {
    const at = formatDateTime(entry.createdAt);
    if (entry.type !== 'note_added') {
      return { kind: 'event', id: entry.id, text: describeEvent(entry), at };
    }
    // The event is there but its note is not: say so rather than drop the line.
    return entry.note
      ? { kind: 'note', id: entry.id, body: entry.note.body, author: entry.note.authorName ?? 'Former member', at }
      : { kind: 'event', id: entry.id, text: 'A note was added', at };
  });
}

/** What happened, in words. Events carry only an actor id, so there is no "who" (docs/db-schema.md 4.3). */
function describeEvent({ type, data }: ActivityEntry): string {
  switch (type) {
    case 'applied': {
      const source = stringField(data, 'source');
      return source ? `Applied via ${source}` : 'Applied';
    }
    case 'auto_rejected': {
      const label = stringField(data, 'fieldLabel');
      return label
        ? `Rejected automatically: their answer to “${label}” matched a rule`
        : 'Rejected automatically';
    }
    case 'stage_changed':
      return `Moved ${fromTo(data)}`;
    case 'hired':
      return `Hired (moved ${fromTo(data)})`;
    case 'rejected':
      return `Rejected (moved ${fromTo(data)})`;
    case 'withdrawn':
      return 'Withdrew their application';
    default:
      return type.replaceAll('_', ' ');
  }
}

/** "from Screening to Interview", from a stage move's `{ fromStageName, toStageName }`. */
function fromTo(data: unknown): string {
  const from = stringField(data, 'fromStageName');
  const to = stringField(data, 'toStageName');
  return from && to ? `from ${from} to ${to}` : to ? `to ${to}` : 'to another stage';
}

/** `data[key]` if `data` is an object and the value is a non-empty string. `data` is JSONB, so it is not trusted. */
function stringField(data: unknown, key: string): string | null {
  if (typeof data !== 'object' || data === null || !(key in data)) {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : null;
}
