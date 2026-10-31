import { describe, expect, it } from 'vitest';
import type { FormFields } from './form-fields.js';
import {
  conditionOps,
  groupRuleErrors,
  newRule,
  retargetRule,
  screenableFields,
  setConditionOp,
  toggleConditionOption,
} from './screening-rule-editor.js';

/*
 * The Settings tab's rule editor, minus the pixels: which questions can have a rule, what a new or
 * re-targeted rule starts as, the operators offered per type, option toggling, and where the API's
 * errors land. A condition describes the ACCEPTABLE answer (screening-rules.ts).
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K = { stack: id(1), tools: id(2), remote: id(3), bio: id(4) };
const O = { a: id(101), b: id(102), c: id(103) };
const base = { helpText: null, required: false };
const options = [
  { id: O.a, label: 'A' },
  { id: O.b, label: 'B' },
  { id: O.c, label: 'C' },
];

const bio = { ...base, key: K.bio, label: 'Bio', type: 'long_text', config: { maxLength: null } };
const stack = { ...base, key: K.stack, label: 'Stack', type: 'single_select', config: { options, rejectOptionIds: [] } };
const tools = {
  ...base,
  key: K.tools,
  label: 'Tools',
  type: 'multi_select',
  config: { options, rejectOptionIds: [], maxSelections: null },
};
const remote = { ...base, key: K.remote, label: 'Remote?', type: 'yes_no', config: { rejectWhen: null } };

// The editor only reads key, label, type and options, so the fixtures skip the rest of the config schema.
const asField = (f: unknown) => f as FormFields[number];
const fields = [bio, stack, tools, remote].map(asField) as FormFields;

describe('screenableFields', () => {
  it('lists the choice and yes/no questions in form order and skips the rest', () => {
    expect(screenableFields(fields).map((f) => f.label)).toEqual(['Stack', 'Tools', 'Remote?']);
  });
});

describe('newRule', () => {
  it('starts a choice question with a reject rule and nothing chosen', () => {
    expect(newRule(asField(stack), id(900))).toEqual({
      id: id(900),
      questionKey: K.stack,
      outcome: 'reject',
      condition: { type: 'single_select', op: 'in', optionIds: [] },
    });
    expect(newRule(asField(tools), id(901)).condition).toEqual({ type: 'multi_select', op: 'any_of', optionIds: [] });
  });

  it('starts a yes/no question accepting Yes', () => {
    expect(newRule(asField(remote), id(902)).condition).toEqual({ type: 'yes_no', answer: true });
  });
});

describe('retargetRule', () => {
  const rule = {
    id: id(900),
    questionKey: K.stack,
    outcome: 'flag' as const,
    condition: { type: 'single_select' as const, op: 'not_in' as const, optionIds: [O.a] },
  };

  it('keeps the rule as it is when the same question is picked again', () => {
    expect(retargetRule(rule, asField(stack))).toEqual(rule);
  });

  it('keeps the id and outcome but resets the condition when the type changes', () => {
    expect(retargetRule(rule, asField(remote))).toEqual({
      id: id(900),
      questionKey: K.remote,
      outcome: 'flag',
      condition: { type: 'yes_no', answer: true },
    });
  });

  it('keeps the operator but drops the options when moving to another question of the same type', () => {
    const other = asField({ ...stack, key: id(77), config: { options: [{ id: O.b, label: 'B' }], rejectOptionIds: [] } });
    expect(retargetRule(rule, other)).toEqual({
      id: id(900),
      questionKey: id(77),
      outcome: 'flag',
      condition: { type: 'single_select', op: 'not_in', optionIds: [] },
    });
  });
});

describe('conditionOps', () => {
  it('words each operator by when the rule fires, not by the acceptable answer', () => {
    expect(conditionOps('single_select')).toEqual([
      { op: 'in', label: 'unless the answer is one of' },
      { op: 'not_in', label: 'if the answer is one of' },
    ]);
    expect(conditionOps('multi_select')).toEqual([
      { op: 'any_of', label: 'unless at least one of' },
      { op: 'all_of', label: 'unless all of' },
      { op: 'none_of', label: 'if any of' },
    ]);
    expect(conditionOps('yes_no')).toEqual([]);
  });
});

describe('setConditionOp', () => {
  it('changes the operator and keeps the chosen options', () => {
    expect(setConditionOp({ type: 'multi_select', op: 'any_of', optionIds: [O.a] }, 'none_of')).toEqual({
      type: 'multi_select',
      op: 'none_of',
      optionIds: [O.a],
    });
  });
});

describe('toggleConditionOption', () => {
  it("adds and removes an option and keeps the question's option order", () => {
    let condition = newRule(asField(tools), id(1)).condition;
    condition = toggleConditionOption(condition, asField(tools), O.c, true);
    condition = toggleConditionOption(condition, asField(tools), O.a, true);
    expect(condition).toMatchObject({ optionIds: [O.a, O.c] });
    condition = toggleConditionOption(condition, asField(tools), O.a, false);
    expect(condition).toMatchObject({ optionIds: [O.c] });
  });
});

describe('groupRuleErrors', () => {
  it('puts each API error on its rule and says which part it is about', () => {
    const grouped = groupRuleErrors([
      { path: 'rules.1.condition.optionIds', message: 'Choose at least one option.' },
      { path: 'rules.1.questionKey', message: 'Gone.' },
      { path: 'rules.0.condition.optionIds.2', message: 'Bad option.' },
      { path: 'rules.0.id', message: 'Reload.' },
      { path: 'rules', message: 'Too many.' },
    ]);
    expect(grouped.byRule[1]).toEqual({ question: ['Gone.'], condition: ['Choose at least one option.'], rule: [] });
    expect(grouped.byRule[0]).toEqual({ question: [], condition: ['Bad option.'], rule: ['Reload.'] });
    expect(grouped.form).toEqual(['Too many.']);
  });
});
