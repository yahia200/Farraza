import { RATING_CRITERIA, buildActivityTimeline, type ActivityEntry, type ActivityEvent, type ActivityNote } from '@repo/shared';
import { formatDateTime } from '@/lib/format';

/**
 * One line of the activity timeline, ready to render: plain strings only, so
 * it can cross from the Server Component to the client timeline. Built on the
 * server because the times are formatted there (lib/format.ts).
 */
export type ActivityItem =
  | { kind: 'event'; id: string; text: string; at: string }
  | { kind: 'note'; id: string; body: string; author: string; at: string; pending?: boolean };

/** Who gave a Rating: its author's id and name, as the detail's `ratings` list has them. */
export interface Rater {
  userId: string | null;
  name: string;
}

/**
 * The application's history, oldest first, as items to render. `raters` names the actor of a
 * `rated` event: events carry only an actor id, and anyone who rated still has a Rating (it cannot
 * be removed), so the detail's Ratings are the lookup.
 */
export function toActivityItems(
  events: readonly ActivityEvent[],
  notes: readonly ActivityNote[],
  raters: readonly Rater[],
): ActivityItem[] {
  return buildActivityTimeline(events, notes).map((entry): ActivityItem => {
    const at = formatDateTime(entry.createdAt);
    if (entry.type !== 'note_added') {
      return { kind: 'event', id: entry.id, text: describeEvent(entry, raters), at };
    }
    // The event is there but its note is not: say so rather than drop the line.
    return entry.note
      ? { kind: 'note', id: entry.id, body: entry.note.body, author: entry.note.authorName ?? 'Former member', at }
      : { kind: 'event', id: entry.id, text: 'A note was added', at };
  });
}

/**
 * What happened, in words. Events carry only an actor id (docs/db-schema.md 4.3), so only a
 * `rated` line names who did it, and only through `raters`.
 */
function describeEvent({ type, data, actorId }: ActivityEntry, raters: readonly Rater[]): string {
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
      return `Hired${fromStage(data)}`;
    case 'rejected':
      return `Rejected${fromStage(data)}`;
    case 'withdrawn':
      return 'Withdrew their application';
    case 'rated':
      return describeRating(data, actorId === null ? undefined : raters.find((rater) => rater.userId === actorId));
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

/** " (from Interview)", or nothing: the stage a hire or rejection came from. */
function fromStage(data: unknown): string {
  const from = stringField(data, 'fromStageName');
  return from ? ` (from ${from})` : '';
}

/**
 * A `rated` event: `data` is `{ previous: { overall, criteria } | null, current: { overall, criteria }, stage }`
 * (docs/db-schema.md 4.3). "Alice rated 4 out of 5 (in Interview)" the first time; "Alice changed their rating
 * from 3 to 4" when the overall moved; "Alice scored Culture fit 4, cleared Communication" when only
 * Criteria moved; "Alice kept their rating at 4" when nothing did.
 * A line that can't be read says only who rated.
 */
function describeRating(data: unknown, rater: Rater | undefined): string {
  const who = rater?.name ?? 'Former member';
  const current = scoresOf(data, 'current');
  if (!current) {
    return `${who} rated`;
  }
  const previous = scoresOf(data, 'previous');
  const stage = stringField(data, 'stage');
  const inStage = stage ? ` (in ${stage})` : '';
  if (!previous) {
    return `${who} rated ${current.overall} out of 5${inStage}`;
  }
  if (previous.overall !== current.overall) {
    return `${who} changed their rating from ${previous.overall} to ${current.overall}${inStage}`;
  }
  const changes = criteriaChanges(previous.criteria, current.criteria);
  return changes.length > 0
    ? `${who} ${changes.join(', ')}${inStage}`
    : `${who} kept their rating at ${current.overall}${inStage}`;
}

type Scores = { overall: number; criteria: Record<string, number> };

/** `data[key]` as `{ overall, criteria }`, or null if it isn't one. `data` is JSONB, so it is not trusted. */
function scoresOf(data: unknown, key: string): Scores | null {
  if (typeof data !== 'object' || data === null || !(key in data)) {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { overall, criteria } = value as Record<string, unknown>;
  if (typeof overall !== 'number') {
    return null;
  }
  const scores: Record<string, number> = {};
  if (typeof criteria === 'object' && criteria !== null) {
    for (const [name, score] of Object.entries(criteria)) {
      if (typeof score === 'number') scores[name] = score;
    }
  }
  return { overall, criteria: scores };
}

/** What changed between two sets of Criteria scores, in catalog order: "scored Culture fit 4", "cleared Communication". */
function criteriaChanges(before: Record<string, number>, after: Record<string, number>): string[] {
  return RATING_CRITERIA.flatMap(({ key, label }) => {
    if (after[key] === before[key]) return [];
    return [after[key] === undefined ? `cleared ${label}` : `scored ${label} ${after[key]}`];
  });
}

/** `data[key]` if `data` is an object and the value is a non-empty string. `data` is JSONB, so it is not trusted. */
function stringField(data: unknown, key: string): string | null {
  if (typeof data !== 'object' || data === null || !(key in data)) {
    return null;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : null;
}
