import { describe, expect, it } from 'vitest';
import { nextPoll, parseRecheckStatus, recheckButton } from './recheck-progress.js';

/** The Re-check control's logic (.scratch/keyword-match, ticket 08). Seam: these three functions. */
const idle = { state: 'idle', lastRun: null } as const;
const running = { state: 'running', processed: 12, total: 40 } as const;

describe('recheckButton', () => {
  it('shows the count when idle and is enabled above zero', () => {
    expect(recheckButton({ count: 7, status: idle, starting: false })).toEqual({
      label: 'Re-check 7',
      disabled: false,
      running: false,
    });
  });

  it('is disabled at zero', () => {
    expect(recheckButton({ count: 0, status: idle, starting: false })).toMatchObject({
      label: 'Re-check 0',
      disabled: true,
    });
  });

  it('shows progress and is disabled while a run is active, whatever the count', () => {
    expect(recheckButton({ count: 7, status: running, starting: false })).toEqual({
      label: 'Re-checking… 12 / 40',
      disabled: true,
      running: true,
    });
  });

  it('is disabled while the start request is in flight', () => {
    expect(recheckButton({ count: 7, status: idle, starting: true })).toMatchObject({ disabled: true });
  });

  it('is disabled until the count is known', () => {
    expect(recheckButton({ count: null, status: idle, starting: false })).toMatchObject({
      label: 'Re-check',
      disabled: true,
    });
  });
});

describe('nextPoll', () => {
  it('keeps polling while the run is going', () => {
    expect(nextPoll({ ok: true, status: running })).toEqual({ keepPolling: true, status: running });
  });

  it('stops when the run is idle', () => {
    expect(nextPoll({ ok: true, status: idle })).toEqual({ keepPolling: false, status: idle });
  });

  it('stops on an error and carries the message, so there is no loop', () => {
    expect(nextPoll({ ok: false, message: 'Nope' })).toEqual({ keepPolling: false, error: 'Nope' });
  });
});

describe('parseRecheckStatus', () => {
  it('accepts the API shapes', () => {
    expect(parseRecheckStatus({ state: 'running', processed: 1, total: 3 })).toEqual({
      state: 'running',
      processed: 1,
      total: 3,
    });
    expect(parseRecheckStatus({ state: 'idle', lastRun: { finishedAt: null, processed: 2, failed: true } })).toEqual({
      state: 'idle',
      lastRun: { finishedAt: null, processed: 2, failed: true },
    });
    expect(parseRecheckStatus({ state: 'idle', lastRun: null })).toEqual(idle);
  });

  it('refuses anything else', () => {
    expect(parseRecheckStatus({ state: 'weird' })).toBeNull();
    expect(parseRecheckStatus(null)).toBeNull();
    expect(parseRecheckStatus({ state: 'running', processed: '1', total: 3 })).toBeNull();
  });
});
