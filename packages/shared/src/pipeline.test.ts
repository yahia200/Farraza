import { describe, expect, it } from 'vitest';
import {
  applyMove,
  buildActivityTimeline,
  statusForStageKind,
  type ActivityEvent,
  type ActivityNote,
  type BoardColumn,
} from './pipeline.js';

/** Applied -> Interview -> Hired -> Rejected, with a couple of cards. Newest first, as the API sorts. */
const board = (): BoardColumn[] => [
  {
    id: 'applied',
    name: 'Applied',
    kind: 'normal',
    applications: [
      { id: 'a1', status: 'active', submittedAt: '2026-03-03T10:00:00.000Z' },
      { id: 'a2', status: 'active', submittedAt: '2026-03-01T10:00:00.000Z' },
    ],
  },
  {
    id: 'interview',
    name: 'Interview',
    kind: 'normal',
    applications: [{ id: 'i1', status: 'active', submittedAt: '2026-03-02T10:00:00.000Z' }],
  },
  { id: 'hired', name: 'Hired', kind: 'hired', applications: [] },
  {
    id: 'rejected',
    name: 'Rejected',
    kind: 'rejected',
    applications: [{ id: 'r1', status: 'rejected', submittedAt: '2026-03-04T10:00:00.000Z' }],
  },
];

const ids = (columns: BoardColumn[]) => columns.map((column) => column.applications.map((card) => card.id));

describe('statusForStageKind', () => {
  it('maps each stage kind to the status an application takes in it', () => {
    expect(statusForStageKind('normal')).toBe('active');
    expect(statusForStageKind('hired')).toBe('hired');
    expect(statusForStageKind('rejected')).toBe('rejected');
  });
});

describe('applyMove', () => {
  it('moves a card out of its column and into the target column', () => {
    const moved = applyMove(board(), 'a1', 'interview');
    expect(ids(moved)).toEqual([['a2'], ['a1', 'i1'], [], ['r1']]);
  });

  it.each([
    ['hired', 'hired'],
    ['rejected', 'rejected'],
    ['interview', 'active'],
  ])('sets the status from the kind of the target stage (%s -> %s)', (toStageId, status) => {
    const moved = applyMove(board(), 'a1', toStageId);
    const card = moved.flatMap((column) => column.applications).find((application) => application.id === 'a1');
    expect(card?.status).toBe(status);
  });

  it('puts a rejected card back to active when it is moved to a normal stage', () => {
    const moved = applyMove(board(), 'r1', 'applied');
    expect(moved[0]?.applications[0]).toMatchObject({
      id: 'r1',
      status: 'active',
    });
  });

  it('keeps the newest-first order of the target column', () => {
    const moved = applyMove(board(), 'a2', 'rejected');
    expect(ids(moved)[3]).toEqual(['r1', 'a2']);
  });

  it('keeps the extra fields the API puts on cards and columns', () => {
    const columns = [
      {
        id: 'x',
        name: 'X',
        kind: 'normal' as const,
        position: 0,
        applications: [
          {
            id: 'c',
            status: 'active' as const,
            submittedAt: '2026-01-01T00:00:00.000Z',
            candidate: { name: 'Sam' },
          },
        ],
      },
      {
        id: 'y',
        name: 'Y',
        kind: 'hired' as const,
        position: 1,
        applications: [],
      },
    ];
    const moved = applyMove(columns, 'c', 'y');
    expect(moved[1]).toEqual({
      ...columns[1],
      applications: [{ ...columns[0]?.applications[0], status: 'hired' }],
    });
  });

  it('does nothing when the card is already in the target stage', () => {
    const columns = board();
    const moved = applyMove(columns, 'i1', 'interview');
    expect(moved).toBe(columns);
    expect(moved).toEqual(board());
  });

  it('does nothing when the card or the stage is not on the board', () => {
    const columns = board();
    expect(applyMove(columns, 'nope', 'interview')).toBe(columns);
    expect(applyMove(columns, 'a1', 'nope')).toBe(columns);
  });

  it('does not change the board it is given', () => {
    const columns = board();
    applyMove(columns, 'a1', 'hired');
    expect(columns).toEqual(board());
  });
});

const event = (id: string, type: string, createdAt: string, data: unknown = {}): ActivityEvent => ({
  id,
  type,
  fromStageId: null,
  toStageId: null,
  actorId: null,
  data,
  createdAt,
});

const note = (id: string, body: string, createdAt: string): ActivityNote => ({
  id,
  body,
  authorId: 'u1',
  authorName: 'Dana',
  createdAt,
});

describe('buildActivityTimeline', () => {
  it('lists the events oldest first', () => {
    const timeline = buildActivityTimeline(
      [
        event('e3', 'hired', '2026-03-03T09:00:00.000Z'),
        event('e1', 'applied', '2026-03-01T09:00:00.000Z'),
        event('e2', 'stage_changed', '2026-03-02T09:00:00.000Z'),
      ],
      [],
    );
    expect(timeline.map((entry) => entry.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('keeps the given order for events at the same moment', () => {
    const at = '2026-03-01T09:00:00.000Z';
    const timeline = buildActivityTimeline([event('first', 'applied', at), event('second', 'auto_rejected', at)], []);
    expect(timeline.map((entry) => entry.id)).toEqual(['first', 'second']);
  });

  it('gives a note_added entry the note it points to, in event order', () => {
    const timeline = buildActivityTimeline(
      [
        event('e1', 'applied', '2026-03-01T09:00:00.000Z'),
        event('e2', 'note_added', '2026-03-02T09:00:00.000Z', { noteId: 'n1' }),
        event('e3', 'stage_changed', '2026-03-03T09:00:00.000Z', {
          fromStageName: 'Applied',
          toStageName: 'Interview',
        }),
      ],
      [note('n1', 'Strong on systems design.', '2026-03-02T09:00:00.000Z')],
    );
    expect(timeline.map((entry) => entry.note?.body ?? null)).toEqual([null, 'Strong on systems design.', null]);
    expect(timeline[1]?.note).toMatchObject({
      authorName: 'Dana',
      createdAt: '2026-03-02T09:00:00.000Z',
    });
  });

  it('keeps a note_added entry whose note is missing, with no note', () => {
    const timeline = buildActivityTimeline(
      [
        event('e1', 'note_added', '2026-03-01T09:00:00.000Z', {
          noteId: 'gone',
        }),
        event('e2', 'note_added', '2026-03-02T09:00:00.000Z'),
        event('e3', 'note_added', '2026-03-03T09:00:00.000Z', null),
      ],
      [note('n1', 'Unrelated.', '2026-03-01T09:00:00.000Z')],
    );
    expect(timeline.map((entry) => [entry.id, entry.note])).toEqual([
      ['e1', null],
      ['e2', null],
      ['e3', null],
    ]);
  });

  it('keeps the other event fields on each entry', () => {
    const applied = {
      ...event('e1', 'applied', '2026-03-01T09:00:00.000Z', {
        source: 'linkedin',
      }),
      toStageId: 's1',
    };
    expect(buildActivityTimeline([applied], [])).toEqual([{ ...applied, note: null }]);
  });

  it('does not change the lists it is given', () => {
    const events = [
      event('e2', 'hired', '2026-03-02T09:00:00.000Z'),
      event('e1', 'applied', '2026-03-01T09:00:00.000Z'),
    ];
    buildActivityTimeline(events, []);
    expect(events.map((e) => e.id)).toEqual(['e2', 'e1']);
  });
});
