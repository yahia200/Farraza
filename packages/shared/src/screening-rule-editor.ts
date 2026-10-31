import type { FieldError, FormField, FormFields } from './form-fields.js';
import type { ScreeningCondition, ScreeningRule } from './screening-rules.js';

/**
 * What the Settings tab's Screening rule editor needs besides pixels (.scratch/screening-rules, ticket
 * 06): which questions can have a rule, what a rule starts as, the operator wording, option toggling
 * and where the API's errors belong. Pure, so it is tested here (the web app has no test runner) and
 * ticket 07 extends the three tables below with number, date and text.
 *
 * A condition describes the ACCEPTABLE answer and the rule fires when the answer falls outside it
 * (screening-rules.ts), so every label says when the rule fires, not what is accepted.
 */

type ChoiceField = Extract<FormField, { type: 'single_select' | 'multi_select' }>;

/** The question types the editor can set a condition for today. */
export const SCREENABLE_TYPES = ['single_select', 'multi_select', 'yes_no'] as const;
export type ScreenableType = (typeof SCREENABLE_TYPES)[number];

export function isScreenableType(type: string): type is ScreenableType {
  return (SCREENABLE_TYPES as readonly string[]).includes(type);
}

const isChoice = (field: FormField): field is ChoiceField =>
  field.type === 'single_select' || field.type === 'multi_select';

/** The form's top-level questions a rule can be about, in form order. */
export function screenableFields(fields: FormFields): FormField[] {
  return fields.filter((field) => isScreenableType(field.type));
}

/** The condition a new rule on this question starts with: nothing chosen yet, or accepting Yes. */
export function defaultCondition(field: FormField): ScreeningCondition {
  switch (field.type) {
    case 'single_select':
      return { type: 'single_select', op: 'in', optionIds: [] };
    case 'multi_select':
      return { type: 'multi_select', op: 'any_of', optionIds: [] };
    case 'yes_no':
      return { type: 'yes_no', answer: true };
    default:
      throw new Error(`No Screening rule editor for ${field.type} questions yet.`);
  }
}

/** A new rule: reject, with the default condition. `id` comes from the caller (`crypto.randomUUID()`). */
export function newRule(field: FormField, id: string): ScreeningRule {
  return { id, questionKey: field.key, outcome: 'reject', condition: defaultCondition(field) };
}

/**
 * The rule after the manager picks another question. The id and outcome stay. The condition stays when
 * the question's type is unchanged and its options still exist; the options are cleared when they
 * don't; a different type starts again from the default.
 */
export function retargetRule(rule: ScreeningRule, field: FormField): ScreeningRule {
  const next = { ...rule, questionKey: field.key };
  if (rule.condition.type !== field.type) return { ...next, condition: defaultCondition(field) };
  if (isChoice(field) && 'optionIds' in rule.condition) {
    const known = new Set(field.config.options.map((option) => option.id));
    return { ...next, condition: { ...rule.condition, optionIds: rule.condition.optionIds.filter((o) => known.has(o)) } };
  }
  return next;
}

/** The operators offered for a type, worded by when the rule fires. Empty: the type has no operator. */
export function conditionOps(type: ScreeningCondition['type']): { op: string; label: string }[] {
  switch (type) {
    case 'single_select':
      return [
        { op: 'in', label: 'unless the answer is one of' },
        { op: 'not_in', label: 'if the answer is one of' },
      ];
    case 'multi_select':
      return [
        { op: 'any_of', label: 'unless at least one of' },
        { op: 'all_of', label: 'unless all of' },
        { op: 'none_of', label: 'if any of' },
      ];
    default:
      return [];
  }
}

/** The condition with another operator, keeping the chosen options. Callers pass an op from `conditionOps`. */
export function setConditionOp(condition: ScreeningCondition, op: string): ScreeningCondition {
  return { ...condition, op } as ScreeningCondition;
}

/** The condition with one option ticked or unticked; the chosen ids stay in the question's option order. */
export function toggleConditionOption(
  condition: ScreeningCondition,
  field: FormField,
  optionId: string,
  checked: boolean,
): ScreeningCondition {
  if (!('optionIds' in condition) || !isChoice(field)) return condition;
  const chosen = new Set(condition.optionIds);
  if (checked) chosen.add(optionId);
  else chosen.delete(optionId);
  return { ...condition, optionIds: field.config.options.map((o) => o.id).filter((id) => chosen.has(id)) };
}

export interface RuleErrors {
  /** About the question picked (`questionKey`, `condition.type`). */
  question: string[];
  /** About the condition (`condition.…`, except its type). */
  condition: string[];
  /** Anything else on the rule (`id`, `outcome`). */
  rule: string[];
}

/**
 * Sorts the 400 `errors` of PUT .../screening-rules (`rules.<index>.<path>`) onto the rules they are
 * about. Errors not about one rule, such as "too many rules", go to `form`.
 */
export function groupRuleErrors(errors: readonly FieldError[]): { byRule: Record<number, RuleErrors>; form: string[] } {
  const byRule: Record<number, RuleErrors> = {};
  const form: string[] = [];
  for (const { path, message } of errors) {
    const [head, index, ...rest] = path.split('.');
    const n = Number(index);
    if (head !== 'rules' || index === undefined || !Number.isInteger(n)) {
      form.push(message);
      continue;
    }
    const entry = (byRule[n] ??= { question: [], condition: [], rule: [] });
    const where = rest.join('.');
    if (where === 'questionKey' || where === 'condition.type') entry.question.push(message);
    else if (rest[0] === 'condition') entry.condition.push(message);
    else entry.rule.push(message);
  }
  return { byRule, form };
}
