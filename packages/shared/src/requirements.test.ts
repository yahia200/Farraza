import { describe, expect, it } from 'vitest';
import {
  REQUIREMENT_KEYWORDS_LIMIT,
  REQUIREMENT_KEYWORD_MAX_LENGTH,
  REQUIREMENTS_LIMIT,
  matchRequirements,
  missedMustHave,
  requirementsSchema,
  type Requirement,
} from './requirements.js';

/*
 * Requirements (.scratch/keyword-match/spec.md, "Shared"). Every id is a fixed literal so failures read well.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const req = (n: number, keywords: string[], tier: Requirement['tier'] = 'must_have'): Requirement => ({
  id: id(n),
  text: `Requirement ${n}`,
  tier,
  keywords,
});

const matched = (keywords: string[], cvText: string) =>
  matchRequirements([req(1, keywords)], cvText)[id(1)]!;

describe('matchRequirements', () => {
  it('matches keywords made of symbols', () => {
    expect(matched(['C#'], 'Five years of C# and .NET').matched).toBe(true);
    expect(matched(['Node.js'], 'Built APIs with Node.js.').matched).toBe(true);
    expect(matched(['C++'], 'Systems work in C++, mostly').matched).toBe(true);
  });

  it('needs a whole word: "Go" does not match "Google"', () => {
    expect(matched(['Go'], 'Worked at Google on search').matched).toBe(false);
    expect(matched(['Go'], 'Wrote services in Go.').matched).toBe(true);
    expect(matched(['Go'], 'Gopher and cargo and go2').matched).toBe(false);
  });

  it('ignores case', () => {
    expect(matched(['PostgreSQL'], 'ran postgresql in production').matched).toBe(true);
    expect(matched(['postgresql'], 'Ran POSTGRESQL in production').matched).toBe(true);
  });

  it('treats a trailing "s" as the same word, either way round', () => {
    expect(matched(['microservice'], 'Designed microservices at scale').matched).toBe(true);
    expect(matched(['microservices'], 'Designed a microservice').matched).toBe(true);
  });

  it('is not fooled by surrounding punctuation in the CV', () => {
    expect(matched(['Docker'], '(Docker), "Kubernetes"; Terraform').matched).toBe(true);
  });

  it('matches when any one keyword is found and reports the keywords found', () => {
    const result = matched(['Postgres', 'PostgreSQL', 'MySQL'], 'Postgres and mysql experience');
    expect(result.matched).toBe(true);
    expect(result.terms).toEqual(['Postgres', 'MySQL']);
  });

  it('reports no terms when nothing matches', () => {
    expect(matched(['Rust'], 'Wrote Python')).toEqual({ matched: false, terms: [] });
  });

  it('treats a keyword literally, never as a regex', () => {
    expect(matched(['C.+'], 'Cooking, C++').matched).toBe(false);
    expect(matched(['a|b'], 'a and b').matched).toBe(false);
  });

  it('does not detect negation (known, accepted limit)', () => {
    // "no experience with Postgres" still matches: the matcher only looks for the word.
    expect(matched(['Postgres'], 'I have no experience with Postgres').matched).toBe(true);
  });

  it('reports "not checked" (matched: null) for a Requirement with no keywords', () => {
    expect(matched([], 'Anything at all, even Postgres')).toEqual({ matched: null, terms: [] });
  });

  it('returns one result per Requirement id', () => {
    const results = matchRequirements([req(1, ['Go']), req(2, ['Rust'])], 'Go developer');
    expect(results[id(1)]!.matched).toBe(true);
    expect(results[id(2)]!.matched).toBe(false);
  });
});

describe('missedMustHave', () => {
  const reqs = [req(1, ['Go'], 'must_have'), req(2, ['Rust'], 'nice_to_have')];

  it('is true when a must-have did not match', () => {
    expect(missedMustHave(reqs, matchRequirements(reqs, 'Rust only'))).toBe(true);
  });

  it('is false when every must-have matched, whatever the nice-to-haves did', () => {
    expect(missedMustHave(reqs, matchRequirements(reqs, 'Go only'))).toBe(false);
  });

  it('ignores a must-have with no keywords: not checked is not a miss', () => {
    const noKeywords = [req(1, [], 'must_have')];
    expect(missedMustHave(noKeywords, matchRequirements(noKeywords, 'Any CV text'))).toBe(false);
  });

  it('still flags another must-have that missed beside a keyword-less one', () => {
    const mixed = [req(1, [], 'must_have'), req(2, ['Rust'], 'must_have')];
    expect(missedMustHave(mixed, matchRequirements(mixed, 'Go only'))).toBe(true);
  });

  it('reads a result stored before this change (matched: boolean) as it did', () => {
    const stored = { [id(1)]: { matched: false, terms: [] } };
    expect(missedMustHave([req(1, ['Go'], 'must_have')], stored)).toBe(true);
    expect(missedMustHave([req(1, ['Go'], 'must_have')], { [id(1)]: { matched: true, terms: ['Go'] } })).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(missedMustHave([], {})).toBe(false);
  });
});

describe('requirementsSchema', () => {
  it('accepts an empty list', () => {
    expect(requirementsSchema.safeParse([]).success).toBe(true);
  });

  it('accepts a valid Requirement and trims keywords', () => {
    const parsed = requirementsSchema.parse([req(1, ['  Go  '])]);
    expect(parsed[0]!.keywords).toEqual(['Go']);
  });

  it('accepts a Requirement with no keywords (only the sentence)', () => {
    const parsed = requirementsSchema.parse([req(1, [])]);
    expect(parsed[0]!.keywords).toEqual([]);
  });

  it('still needs the sentence when there are no keywords', () => {
    const result = requirementsSchema.safeParse([{ ...req(1, []), text: ' ' }]);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual([0, 'text']);
  });

  it('rejects a blank or over-long keyword', () => {
    expect(requirementsSchema.safeParse([req(1, ['   '])]).success).toBe(false);
    const long = 'x'.repeat(REQUIREMENT_KEYWORD_MAX_LENGTH + 1);
    expect(requirementsSchema.safeParse([req(1, [long])]).success).toBe(false);
  });

  it('enforces the caps', () => {
    const tooMany = Array.from({ length: REQUIREMENTS_LIMIT + 1 }, (_, n) => req(n + 1, ['Go']));
    expect(requirementsSchema.safeParse(tooMany).success).toBe(false);
    const keywords = Array.from({ length: REQUIREMENT_KEYWORDS_LIMIT + 1 }, (_, n) => `k${n}`);
    expect(requirementsSchema.safeParse([req(1, keywords)]).success).toBe(false);
  });

  it('rejects a bad tier, empty text and a repeated id', () => {
    expect(requirementsSchema.safeParse([{ ...req(1, ['Go']), tier: 'maybe' }]).success).toBe(false);
    expect(requirementsSchema.safeParse([{ ...req(1, ['Go']), text: ' ' }]).success).toBe(false);
    expect(requirementsSchema.safeParse([req(1, ['Go']), req(1, ['Rust'])]).success).toBe(false);
  });
});
