import { describe, expect, it } from 'vitest';
import { bandLabel, matchStateNote, requirementRows } from './embedding-match-display.js';

/**
 * The sheet's Requirements section (embedding-match ticket 09). Seams: `matchStateNote` (state to
 * words), `bandLabel` (band to words) and `requirementRows` (Layer 2 and Layer 3 side by side).
 */
describe('matchStateNote', () => {
  it('says nothing with no score row', () => {
    expect(matchStateNote(null)).toBeNull();
  });

  it('says nothing once scored (the bands speak for themselves)', () => {
    expect(matchStateNote({ status: 'scored' })).toBeNull();
  });

  it('says Scoring… while pending', () => {
    expect(matchStateNote({ status: 'scoring' })).toBe('Scoring…');
  });

  it('gives a plain reason for each not-scored case', () => {
    expect(matchStateNote({ status: 'not_scored', reason: 'cv_unreadable' })).toBe(
      'Not scored: the CV could not be read.',
    );
    expect(matchStateNote({ status: 'not_scored', reason: 'embedder_failed' })).toBe(
      'Not scored: the scoring service failed.',
    );
    expect(matchStateNote({ status: 'not_scored', reason: 'model_changed' })).toBe(
      'Not scored: the scoring model has changed since this was scored.',
    );
  });
});

describe('bandLabel', () => {
  it('uses the three labels', () => {
    expect(bandLabel('strong')).toBe('Strong');
    expect(bandLabel('related')).toBe('Related');
    expect(bandLabel('weak')).toBe('Weak');
  });
});

describe('requirementRows', () => {
  const layer2 = {
    results: [
      { id: 'a', text: 'Postgres', tier: 'must_have' as const, matched: false, terms: [] },
      { id: 'b', text: 'TypeScript', tier: 'nice_to_have' as const, matched: true, terms: ['typescript'] },
      { id: 'c', text: 'Mentoring', tier: 'nice_to_have' as const, matched: null, terms: [] },
    ],
  };
  const layer3 = {
    requirements: [
      { id: 'a', text: 'Postgres', tier: 'must_have' as const, band: 'strong' as const },
      { id: 'b', text: 'TypeScript', tier: 'nice_to_have' as const, band: 'weak' as const },
      { id: 'c', text: 'Mentoring', tier: 'nice_to_have' as const, band: 'related' as const },
    ],
  };

  it('pairs the verdict and the band for each Requirement, a Layer 2 miss with a Strong band included', () => {
    expect(requirementRows(layer2, layer3)).toEqual([
      { id: 'a', text: 'Postgres', tier: 'must_have', verdict: { kind: 'not_matched' }, band: 'strong' },
      { id: 'b', text: 'TypeScript', tier: 'nice_to_have', verdict: { kind: 'matched', terms: ['typescript'] }, band: 'weak' },
      { id: 'c', text: 'Mentoring', tier: 'nice_to_have', verdict: { kind: 'not_checked' }, band: 'related' },
    ]);
  });

  it('has no band without a Layer 3 payload, or when it is not scored', () => {
    expect(requirementRows(layer2, null).map((r) => r.band)).toEqual([null, null, null]);
    const unscored = { requirements: layer3.requirements.map((r) => ({ ...r, band: null })) };
    expect(requirementRows(layer2, unscored).map((r) => r.band)).toEqual([null, null, null]);
  });

  it('has no verdict without a Layer 2 check, and lists the Layer 3 Requirements', () => {
    const rows = requirementRows(null, layer3);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => r.verdict === null)).toBe(true);
    expect(rows[0]?.band).toBe('strong');
  });

  it('appends a Layer 3 Requirement the Layer 2 version does not have, with no verdict', () => {
    const rows = requirementRows(
      { results: layer2.results.slice(0, 1) },
      layer3,
    );
    expect(rows.map((r) => [r.id, r.verdict?.kind ?? null, r.band])).toEqual([
      ['a', 'not_matched', 'strong'],
      ['b', null, 'weak'],
      ['c', null, 'related'],
    ]);
  });

  it('is empty with neither layer, or with two empty lists', () => {
    expect(requirementRows(null, null)).toEqual([]);
    expect(requirementRows({ results: [] }, { requirements: [] })).toEqual([]);
  });
});
