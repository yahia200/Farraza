import { describe, expect, it } from 'vitest';
import { flagMarkerLabel, screeningDisplay } from './screening-display.js';

const flag = (ruleId: string, reason = `${ruleId} reason`) => ({
  ruleId,
  questionKey: `q-${ruleId}`,
  questionLabel: `Question ${ruleId}`,
  reason,
});

describe('flagMarkerLabel', () => {
  it('names the count for assistive technology', () => {
    expect(flagMarkerLabel(1)).toBe('Flagged: 1 screening flag');
    expect(flagMarkerLabel(3)).toBe('Flagged: 3 screening flags');
  });
});

describe('screeningDisplay', () => {
  it('is empty for an application nothing fired on', () => {
    expect(screeningDisplay([], [])).toEqual({ rejected: [], flagged: [] });
  });

  it('lists the rules of an auto_rejected event with their reasons', () => {
    const rules = [{ ...flag('a'), outcome: 'reject' }];
    const events = [{ type: 'auto_rejected', data: { rules } }];
    expect(screeningDisplay(events, []).rejected).toEqual([flag('a')]);
  });

  it('reads the older auto_rejected shape as one rule without a reason', () => {
    const events = [{ type: 'auto_rejected', data: { fieldKey: 'k', fieldLabel: 'Visa?' } }];
    expect(screeningDisplay(events, []).rejected).toEqual([
      { ruleId: null, questionKey: 'k', questionLabel: 'Visa?', reason: null },
    ]);
  });

  it('shows flags from the application, and from the flagged event when the column is empty', () => {
    const events = [{ type: 'flagged', data: { rules: [flag('b')] } }];
    expect(screeningDisplay(events, [flag('c')]).flagged).toEqual([flag('c')]);
    expect(screeningDisplay(events, []).flagged).toEqual([flag('b')]);
  });

  it('shows both outcomes when both applied', () => {
    const events = [
      { type: 'auto_rejected', data: { rules: [flag('a')] } },
      { type: 'flagged', data: { rules: [flag('b')] } },
    ];
    expect(screeningDisplay(events, [flag('b')])).toEqual({ rejected: [flag('a')], flagged: [flag('b')] });
  });

  it('skips unreadable data instead of throwing', () => {
    const events = [
      { type: 'auto_rejected', data: null },
      { type: 'flagged', data: { rules: [{ reason: 1 }, 'x', flag('d')] } },
    ];
    expect(screeningDisplay(events, [])).toEqual({ rejected: [], flagged: [flag('d')] });
  });
});
