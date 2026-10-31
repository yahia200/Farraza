import { describe, expect, it } from 'vitest';
import type { FormFields } from './form-fields.js';
import { saveScreeningRulesSchema } from './jobs.js';
import {
  SCREENING_RULES_LIMIT,
  SCREENING_WORDS_LIMIT,
  SCREENING_WORD_MAX_LENGTH,
  MAX_RELATIVE_DAYS,
  isDuplicateScreeningWord,
  normaliseScreeningWord,
  evaluateScreeningRules,
  parseScreeningRules,
  type ScreeningRule,
} from './screening-rules.js';

/*
 * Screening rules (.scratch/screening-rules/spec.md, "Shared"). A condition states what an acceptable
 * answer looks like; the rule fires when the answer falls outside it. Every id below is a fixed
 * literal so failures are readable.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const K = {
  years: id(1),
  stack: id(2),
  tools: id(3),
  start: id(4),
  about: id(5),
  bio: id(6),
  remote: id(7),
  skipped: id(8),
};
const O = { a: id(101), b: id(102), c: id(103), x: id(104), y: id(105), z: id(106) };

const base = { helpText: null, required: false };

const fields: FormFields = [
  { ...base, key: K.years, label: 'Years of experience', type: 'number', config: { min: null, max: null, integerOnly: false } },
  {
    ...base,
    key: K.stack,
    label: 'Main stack',
    type: 'single_select',
    config: {
      options: [
        { id: O.a, label: 'Node' },
        { id: O.b, label: 'Go' },
        { id: O.c, label: 'Rust' },
      ],
    },
  },
  {
    ...base,
    key: K.tools,
    label: 'Tools you know',
    type: 'multi_select',
    config: {
      options: [
        { id: O.x, label: 'Postgres' },
        { id: O.y, label: 'Redis' },
        { id: O.z, label: 'Kafka' },
      ],
      maxSelections: null,
    },
  },
  { ...base, key: K.start, label: 'Available from', type: 'date', config: { min: null, max: null } },
  { ...base, key: K.about, label: 'About you', type: 'short_text', config: { maxLength: 200 } },
  { ...base, key: K.bio, label: 'Bio', type: 'long_text', config: { maxLength: 2000 } },
  { ...base, key: K.remote, label: 'Can work remotely', type: 'yes_no', config: {} },
  { ...base, key: K.skipped, label: 'Salary', type: 'number', config: { min: null, max: null, integerOnly: false } },
];

let next = 1000;
function rule(
  questionKey: string,
  condition: unknown,
  outcome: 'reject' | 'flag' = 'reject',
): ScreeningRule {
  return { id: id(next++), questionKey, outcome, condition } as ScreeningRule;
}

const SUBMITTED = Temporal.PlainDate.from('2026-10-31');

function fired(rules: ScreeningRule[], answers: Record<string, unknown>) {
  return evaluateScreeningRules(rules, fields, answers as never, SUBMITTED);
}

describe('parseScreeningRules', () => {
  const valid: [string, string, unknown][] = [
    ['single_select in', K.stack, { type: 'single_select', op: 'in', optionIds: [O.a, O.b] }],
    ['single_select not_in', K.stack, { type: 'single_select', op: 'not_in', optionIds: [O.c] }],
    ['multi_select any_of', K.tools, { type: 'multi_select', op: 'any_of', optionIds: [O.x] }],
    ['multi_select none_of', K.tools, { type: 'multi_select', op: 'none_of', optionIds: [O.x] }],
    ['multi_select all_of', K.tools, { type: 'multi_select', op: 'all_of', optionIds: [O.x, O.y] }],
    ['number min', K.years, { type: 'number', op: 'min', value: 5 }],
    ['number max', K.years, { type: 'number', op: 'max', value: 10 }],
    ['number range', K.years, { type: 'number', op: 'range', min: 2, max: 8 }],
    ['date fixed', K.start, { type: 'date', op: 'before', when: { kind: 'fixed', date: '2027-01-01' } }],
    ['date relative', K.start, { type: 'date', op: 'after', when: { kind: 'relative', days: 60 } }],
    ['short_text any_of', K.about, { type: 'short_text', op: 'any_of', words: ['sql'] }],
    ['long_text none_of', K.bio, { type: 'long_text', op: 'none_of', words: ['intern'] }],
    ['yes_no', K.remote, { type: 'yes_no', answer: true }],
  ];

  it.each(valid)('accepts a %s rule', (_name, questionKey, condition) => {
    const input = [rule(questionKey, condition)];
    const result = parseScreeningRules(input, fields);
    expect(result).toEqual({ ok: true, rules: input });
  });

  it('accepts the empty list and exactly the cap', () => {
    expect(parseScreeningRules([], fields).ok).toBe(true);
    const many = Array.from({ length: SCREENING_RULES_LIMIT }, () =>
      rule(K.years, { type: 'number', op: 'min', value: 1 }),
    );
    expect(parseScreeningRules(many, fields).ok).toBe(true);
  });

  it('refuses more than 20 rules', () => {
    const many = Array.from({ length: 21 }, () => rule(K.years, { type: 'number', op: 'min', value: 1 }));
    expect(SCREENING_RULES_LIMIT).toBe(20);
    expect(parseScreeningRules(many, fields).ok).toBe(false);
  });

  it('refuses a malformed rule with a path to the problem', () => {
    const result = parseScreeningRules(
      [rule(K.years, { type: 'number', op: 'min', value: 'five' }), { id: 'nope' }],
      fields,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('0.condition.value');
    expect(paths.some((p) => p.startsWith('1.'))).toBe(true);
  });

  it('refuses an unknown outcome and a repeated rule id', () => {
    const a = rule(K.years, { type: 'number', op: 'min', value: 1 });
    const bad = { ...rule(K.years, { type: 'number', op: 'min', value: 1 }), outcome: 'delete' };
    const result = parseScreeningRules([a, a, bad], fields);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('1.id');
    expect(paths).toContain('2.outcome');
  });

  it('refuses an inverted number range', () => {
    const result = parseScreeningRules([rule(K.years, { type: 'number', op: 'range', min: 9, max: 2 })], fields);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.path).toBe('0.condition.min');
  });

  it('refuses a non-date fixed date and a non-integer relative offset', () => {
    const result = parseScreeningRules(
      [
        rule(K.start, { type: 'date', op: 'before', when: { kind: 'fixed', date: '2026-02-30' } }),
        rule(K.start, { type: 'date', op: 'before', when: { kind: 'relative', days: 1.5 } }),
      ],
      fields,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('0.condition.when.date');
    expect(paths).toContain('1.condition.when.days');
  });

  it('enforces the word caps: 20 words, 60 characters each, none blank', () => {
    expect([SCREENING_WORDS_LIMIT, SCREENING_WORD_MAX_LENGTH]).toEqual([20, 60]);
    const words = (list: string[]) =>
      parseScreeningRules([rule(K.about, { type: 'short_text', op: 'any_of', words: list })], fields);
    expect(words(Array.from({ length: 20 }, (_, i) => `w${i}`)).ok).toBe(true);
    expect(words(Array.from({ length: 21 }, (_, i) => `w${i}`)).ok).toBe(false);
    expect(words(['a'.repeat(60)]).ok).toBe(true);
    expect(words(['a'.repeat(61)]).ok).toBe(false);
    expect(words([]).ok).toBe(false);
    expect(words(['   ']).ok).toBe(false);
  });

  it('refuses an empty option list', () => {
    const result = parseScreeningRules([rule(K.stack, { type: 'single_select', op: 'in', optionIds: [] })], fields);
    expect(result.ok).toBe(false);
  });

  describe('against the form', () => {
    it('refuses a question that is not on the form', () => {
      const result = parseScreeningRules([rule(id(999), { type: 'yes_no', answer: true })], fields);
      expect(result).toEqual({
        ok: false,
        errors: [{ path: '0.questionKey', message: expect.any(String) }],
      });
    });

    it('refuses a condition whose type does not match the question', () => {
      const result = parseScreeningRules([rule(K.years, { type: 'yes_no', answer: true })], fields);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]!.path).toBe('0.condition.type');
    });

    it('refuses an option the question does not have', () => {
      const result = parseScreeningRules(
        [rule(K.stack, { type: 'single_select', op: 'in', optionIds: [O.a, O.x] })],
        fields,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]!.path).toBe('0.condition.optionIds.1');
    });

    it('refuses a question inside a repeating group (out of scope)', () => {
      const inGroup: FormFields = [
        {
          ...base,
          key: id(50),
          label: 'Jobs',
          type: 'repeating_group',
          config: {
            maxEntries: 3,
            fields: [{ ...base, key: id(51), label: 'Years', type: 'number', config: { min: null, max: null, integerOnly: false } }],
          },
        },
      ];
      const result = parseScreeningRules([rule(id(51), { type: 'number', op: 'min', value: 1 })], inGroup);
      expect(result.ok).toBe(false);
    });

    it('refuses a list that is not an array', () => {
      expect(parseScreeningRules({}, fields).ok).toBe(false);
    });
  });
});

describe('saveScreeningRulesSchema', () => {
  it('takes { rules } and nothing else, leaving items to parseScreeningRules', () => {
    expect(saveScreeningRulesSchema.safeParse({ rules: [] }).success).toBe(true);
    expect(saveScreeningRulesSchema.safeParse({ rules: [{ anything: 1 }] }).success).toBe(true);
    expect(saveScreeningRulesSchema.safeParse({ rules: [], companyId: 'x' }).success).toBe(false);
    expect(saveScreeningRulesSchema.safeParse({}).success).toBe(false);
    expect(saveScreeningRulesSchema.safeParse({ rules: Array(21).fill({}) }).success).toBe(false);
  });
});

describe('evaluateScreeningRules', () => {
  describe('number', () => {
    const min = rule(K.years, { type: 'number', op: 'min', value: 5 });
    it('fires below the minimum with a generated reason', () => {
      expect(fired([min], { [K.years]: 2 })).toEqual([
        {
          ruleId: min.id,
          questionKey: K.years,
          questionLabel: 'Years of experience',
          outcome: 'reject',
          reason: 'Years of experience was 2, minimum 5',
        },
      ]);
    });
    it('does not fire when the answer equals the minimum', () => {
      expect(fired([min], { [K.years]: 5 })).toEqual([]);
    });
    it('fires above the maximum but not at it', () => {
      const max = rule(K.years, { type: 'number', op: 'max', value: 10 });
      expect(fired([max], { [K.years]: 11 })[0]!.reason).toBe('Years of experience was 11, maximum 10');
      expect(fired([max], { [K.years]: 10 })).toEqual([]);
    });
    it('checks both range ends inclusively', () => {
      const range = rule(K.years, { type: 'number', op: 'range', min: 2, max: 8 });
      expect(fired([range], { [K.years]: 1 })[0]!.reason).toBe('Years of experience was 1, expected 2 to 8');
      expect(fired([range], { [K.years]: 9 })).toHaveLength(1);
      expect(fired([range], { [K.years]: 2 })).toEqual([]);
      expect(fired([range], { [K.years]: 8 })).toEqual([]);
    });
    it('treats 0 as an answer', () => {
      expect(fired([min], { [K.years]: 0 })).toHaveLength(1);
    });
  });

  describe('single_select', () => {
    it('in: fires when the answer is outside the accepted set, naming the labels', () => {
      const r = rule(K.stack, { type: 'single_select', op: 'in', optionIds: [O.a, O.b] });
      expect(fired([r], { [K.stack]: O.c })[0]!.reason).toBe('Main stack was Rust, accepted: Node, Go');
      expect(fired([r], { [K.stack]: O.a })).toEqual([]);
    });
    it('not_in: fires when the answer is in the excluded set', () => {
      const r = rule(K.stack, { type: 'single_select', op: 'not_in', optionIds: [O.c] });
      expect(fired([r], { [K.stack]: O.c })[0]!.reason).toBe('Main stack was Rust, not accepted');
      expect(fired([r], { [K.stack]: O.a })).toEqual([]);
    });
  });

  describe('multi_select', () => {
    it('any_of: fires when none of the listed options was chosen', () => {
      const r = rule(K.tools, { type: 'multi_select', op: 'any_of', optionIds: [O.x, O.y] });
      expect(fired([r], { [K.tools]: [O.z] })[0]!.reason).toBe('Tools you know included none of: Postgres, Redis');
      expect(fired([r], { [K.tools]: [O.z, O.y] })).toEqual([]);
    });
    it('all_of: fires when any listed option is missing', () => {
      const r = rule(K.tools, { type: 'multi_select', op: 'all_of', optionIds: [O.x, O.y] });
      expect(fired([r], { [K.tools]: [O.x] })[0]!.reason).toBe('Tools you know was missing: Redis');
      expect(fired([r], { [K.tools]: [O.y, O.x, O.z] })).toEqual([]);
    });
    it('none_of: fires when a listed option was chosen', () => {
      const r = rule(K.tools, { type: 'multi_select', op: 'none_of', optionIds: [O.z] });
      expect(fired([r], { [K.tools]: [O.x, O.z] })[0]!.reason).toBe('Tools you know included Kafka');
      expect(fired([r], { [K.tools]: [O.x] })).toEqual([]);
    });
  });

  describe('date', () => {
    it('before a fixed date: fires on that day and later', () => {
      const r = rule(K.start, { type: 'date', op: 'before', when: { kind: 'fixed', date: '2027-01-01' } });
      expect(fired([r], { [K.start]: '2027-01-01' })[0]!.reason).toBe(
        'Available from was January 1, 2027, expected before January 1, 2027',
      );
      expect(fired([r], { [K.start]: '2026-12-31' })).toEqual([]);
    });
    it('after a fixed date: fires on that day and earlier', () => {
      const r = rule(K.start, { type: 'date', op: 'after', when: { kind: 'fixed', date: '2027-01-01' } });
      expect(fired([r], { [K.start]: '2027-01-01' })).toHaveLength(1);
      expect(fired([r], { [K.start]: '2027-01-02' })).toEqual([]);
    });
    it('relative: counts days from the submission date (60 days after 2026-10-31 is 2026-12-30)', () => {
      const r = rule(K.start, { type: 'date', op: 'before', when: { kind: 'relative', days: 60 } });
      expect(fired([r], { [K.start]: '2026-12-29' })).toEqual([]);
      const hit = fired([r], { [K.start]: '2026-12-30' });
      expect(hit[0]!.reason).toBe(
        'Available from was December 30, 2026, expected before December 30, 2026 (60 days after applying)',
      );
    });
    it('relative with a negative offset looks back', () => {
      const r = rule(K.start, { type: 'date', op: 'after', when: { kind: 'relative', days: -30 } });
      expect(fired([r], { [K.start]: '2026-10-01' })).toHaveLength(1);
      expect(fired([r], { [K.start]: '2026-10-02' })).toEqual([]);
    });
  });

  describe('text', () => {
    const words = (op: string, list: string[], key = K.about) =>
      rule(key, { type: key === K.about ? 'short_text' : 'long_text', op, words: list });

    it('matches whole words, case-insensitively ("sql" does not match "mysql")', () => {
      const r = words('any_of', ['sql']);
      expect(fired([r], { [K.about]: 'I use MySQL daily' })).toHaveLength(1);
      expect(fired([r], { [K.about]: 'I know SQL well' })).toEqual([]);
      expect(fired([r], { [K.about]: 'sql, postgres' })).toEqual([]);
    });
    it('matches words with punctuation and phrases', () => {
      expect(fired([words('any_of', ['c++'])], { [K.about]: 'I write C++ and Go' })).toEqual([]);
      expect(fired([words('any_of', ['node.js'])], { [K.about]: 'node js' })).toHaveLength(1);
      expect(fired([words('any_of', ['machine learning'])], { [K.about]: 'machine   learning' })).toEqual([]);
    });
    it('any_of fires when no word is found', () => {
      expect(fired([words('any_of', ['sql', 'nosql'])], { [K.about]: 'just js' })[0]!.reason).toBe(
        'About you included none of: sql, nosql',
      );
    });
    it('all_of fires naming the missing words', () => {
      expect(fired([words('all_of', ['sql', 'redis'])], { [K.about]: 'sql only' })[0]!.reason).toBe(
        'About you was missing: redis',
      );
      expect(fired([words('all_of', ['sql', 'redis'])], { [K.about]: 'Redis and SQL' })).toEqual([]);
    });
    it('none_of fires naming the found words, on long text too', () => {
      const r = words('none_of', ['intern', 'unpaid'], K.bio);
      expect(fired([r], { [K.bio]: 'Looking for an Intern role' })[0]!.reason).toBe('Bio included intern');
      expect(fired([r], { [K.bio]: 'Looking for an internship' })).toEqual([]);
    });
  });

  describe('yes_no', () => {
    const r = rule(K.remote, { type: 'yes_no', answer: true });
    it('fires when the answer differs from the one to match', () => {
      expect(fired([r], { [K.remote]: false })[0]!.reason).toBe('Can work remotely was No, expected Yes');
      expect(fired([r], { [K.remote]: true })).toEqual([]);
    });
  });

  describe('blank and unusable answers', () => {
    const every = [
      rule(K.skipped, { type: 'number', op: 'min', value: 5 }),
      rule(K.about, { type: 'short_text', op: 'any_of', words: ['sql'] }),
      rule(K.tools, { type: 'multi_select', op: 'all_of', optionIds: [O.x] }),
      rule(K.stack, { type: 'single_select', op: 'in', optionIds: [O.a] }),
      rule(K.start, { type: 'date', op: 'before', when: { kind: 'fixed', date: '2027-01-01' } }),
      rule(K.remote, { type: 'yes_no', answer: true }),
    ];
    it('never fires on a skipped question', () => {
      expect(fired(every, {})).toEqual([]);
    });
    it('never fires on blank text, null or an empty list', () => {
      expect(
        fired(every, { [K.about]: '   ', [K.tools]: [], [K.stack]: null, [K.start]: '', [K.skipped]: null }),
      ).toEqual([]);
    });
    it('treats false as an answer', () => {
      expect(fired([every[5]!], { [K.remote]: false })).toHaveLength(1);
    });
    it('ignores a rule whose question left the form or changed type', () => {
      expect(fired([rule(id(999), { type: 'yes_no', answer: true })], { [id(999)]: false })).toEqual([]);
      expect(fired([rule(K.years, { type: 'yes_no', answer: true })], { [K.years]: 3 })).toEqual([]);
    });
    it('ignores an answer of the wrong shape', () => {
      expect(fired([every[0]!], { [K.skipped]: 'lots' })).toEqual([]);
    });
  });

  describe('several rules', () => {
    it('evaluates each rule on one question and returns every fired rule, in rule order, with its own outcome', () => {
      const lo = rule(K.years, { type: 'number', op: 'min', value: 5 }, 'flag');
      const hi = rule(K.years, { type: 'number', op: 'max', value: 15 }, 'reject');
      const other = rule(K.remote, { type: 'yes_no', answer: true }, 'flag');
      expect(fired([lo, hi, other], { [K.years]: 20, [K.remote]: false }).map((f) => [f.ruleId, f.outcome])).toEqual([
        [hi.id, 'reject'],
        [other.id, 'flag'],
      ]);
      expect(fired([lo, hi], { [K.years]: 1 }).map((f) => f.ruleId)).toEqual([lo.id]);
    });
    it('does not apply outcomes: reject and flag both come back', () => {
      const a = rule(K.years, { type: 'number', op: 'min', value: 5 }, 'flag');
      const b = rule(K.years, { type: 'number', op: 'min', value: 9 }, 'reject');
      expect(fired([a, b], { [K.years]: 1 })).toHaveLength(2);
    });
  });
});

describe('screening word helpers', () => {
  it('normalises a word by trimming it, as the schema does', () => {
    expect(normaliseScreeningWord('  SQL ')).toBe('SQL');
  });

  it('treats a word as a duplicate ignoring case and surrounding spaces', () => {
    expect(isDuplicateScreeningWord(['SQL', 'Python'], ' sql ')).toBe(true);
    expect(isDuplicateScreeningWord(['SQL'], 'python')).toBe(false);
  });

  it('exports the relative-days limit the schema enforces', () => {
    const fields = [
      { key: id(2), type: 'date', label: 'D', required: false, config: { min: null, max: null } },
    ] as unknown as FormFields;
    const rule = (days: number) => ({
      id: id(1),
      questionKey: id(2),
      outcome: 'flag',
      condition: { type: 'date', op: 'before', when: { kind: 'relative', days } },
    });
    expect(parseScreeningRules([rule(MAX_RELATIVE_DAYS)], fields).ok).toBe(true);
    expect(parseScreeningRules([rule(MAX_RELATIVE_DAYS + 1)], fields).ok).toBe(false);
  });
});
