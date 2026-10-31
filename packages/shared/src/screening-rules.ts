import { z } from 'zod';
import { isBlankAnswer, type Answers } from './answers.js';
import { formatIsoDate, isoDateSchema, parseIsoDate } from './dates.js';
import type { FieldError, FormField, FormFields } from './form-fields.js';
import { RELOAD_MESSAGE } from './messages.js';

/**
 * Screening rules (.scratch/screening-rules/spec.md, ADR-0005, GLOSSARY.md "Screening rule"): what a
 * manager sets on a Job to reject or flag an Application from one answer.
 *
 * A condition states what an ACCEPTABLE answer looks like ("minimum 5", "in this set"); the rule
 * fires when the answer falls outside it. This is the "expand" step: `findKnockout` and the field
 * level `rejectWhen` / `rejectOptionIds` still exist beside this file until the API and web switch.
 *
 * Pure and server-or-browser safe. Like dates.ts it uses the platform's `Temporal`, never a polyfill.
 */

/** At most this many rules per Job. */
export const SCREENING_RULES_LIMIT = 20;
/** At most this many words in one word rule, each at most `SCREENING_WORD_MAX_LENGTH` characters. */
export const SCREENING_WORDS_LIMIT = 20;
export const SCREENING_WORD_MAX_LENGTH = 60;

/** A relative date may reach this many days either side of the submission date (about ten years). */
const MAX_RELATIVE_DAYS = 3650;

const outcomeSchema = z.enum(['reject', 'flag'], { error: RELOAD_MESSAGE });
export type ScreeningOutcome = z.infer<typeof outcomeSchema>;

const optionIds = z
  .array(z.uuid({ error: RELOAD_MESSAGE }), { error: RELOAD_MESSAGE })
  .min(1, { error: 'Choose at least one option.' })
  .max(50, { error: 'Choose at most 50 options.' });

const words = z
  .array(
    z
      .string({ error: 'Enter a word.' })
      .trim()
      .min(1, { error: 'Enter a word.' })
      .max(SCREENING_WORD_MAX_LENGTH, {
        error: `Words must be ${SCREENING_WORD_MAX_LENGTH} characters or fewer.`,
      }),
    { error: RELOAD_MESSAGE },
  )
  .min(1, { error: 'Add at least one word.' })
  .max(SCREENING_WORDS_LIMIT, { error: `Add at most ${SCREENING_WORDS_LIMIT} words.` });

const wordOp = z.enum(['any_of', 'all_of', 'none_of'], { error: RELOAD_MESSAGE });

const finite = z.number({ error: 'Enter a number.' });

const textCondition = <T extends 'short_text' | 'long_text'>(type: T) =>
  z.object({ type: z.literal(type), op: wordOp, words });

const conditionSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('single_select'),
      op: z.enum(['in', 'not_in'], { error: RELOAD_MESSAGE }),
      optionIds,
    }),
    z.object({
      type: z.literal('multi_select'),
      op: wordOp,
      optionIds,
    }),
    z.discriminatedUnion(
      'op',
      [
        z.object({ type: z.literal('number'), op: z.literal('min'), value: finite }),
        z.object({ type: z.literal('number'), op: z.literal('max'), value: finite }),
        z.object({ type: z.literal('number'), op: z.literal('range'), min: finite, max: finite }),
      ],
      { error: RELOAD_MESSAGE },
    ),
    z.object({
      type: z.literal('date'),
      op: z.enum(['before', 'after'], { error: RELOAD_MESSAGE }),
      when: z.discriminatedUnion(
        'kind',
        [
          z.object({ kind: z.literal('fixed'), date: isoDateSchema }),
          z.object({
            kind: z.literal('relative'),
            /** Days from the submission date; negative looks back. */
            days: z
              .number({ error: 'Enter a whole number of days.' })
              .int({ error: 'Enter a whole number of days.' })
              .min(-MAX_RELATIVE_DAYS, { error: `Use at most ${MAX_RELATIVE_DAYS} days.` })
              .max(MAX_RELATIVE_DAYS, { error: `Use at most ${MAX_RELATIVE_DAYS} days.` }),
          }),
        ],
        { error: RELOAD_MESSAGE },
      ),
    }),
    textCondition('short_text'),
    textCondition('long_text'),
    z.object({ type: z.literal('yes_no'), answer: z.boolean({ error: RELOAD_MESSAGE }) }),
  ],
  { error: RELOAD_MESSAGE },
);

export type ScreeningCondition = z.infer<typeof conditionSchema>;

/** One Screening rule, about one top-level question of the Job's form. */
export const screeningRuleSchema = z.object({
  id: z.uuid({ error: RELOAD_MESSAGE }),
  questionKey: z.uuid({ error: RELOAD_MESSAGE }),
  outcome: outcomeSchema,
  condition: conditionSchema,
});

export type ScreeningRule = z.infer<typeof screeningRuleSchema>;

/** The shape of the whole list. Checks across rules and against the form are in `parseScreeningRules`. */
export const screeningRulesSchema = z
  .array(z.unknown(), { error: RELOAD_MESSAGE })
  .max(SCREENING_RULES_LIMIT, { error: `A job can have at most ${SCREENING_RULES_LIMIT} screening rules.` });

type Path = (string | number)[];

const join = (path: Path) => path.join('.');

export type ScreeningRulesResult =
  | { ok: true; rules: ScreeningRule[] }
  | { ok: false; errors: FieldError[] };

/**
 * Validates a rule list from an untrusted source against the Job's current form fields: the shape of
 * each rule, a unique id, an ordered range, then the form (the question exists at the top level, the
 * condition's type is the question's type, every option id is one of its options). Every problem is
 * reported at `<index>.<path>`, such as `2.condition.optionIds.1`. Rules inside a repeating group
 * are out of scope, so their keys count as unknown.
 */
export function parseScreeningRules(input: unknown, fields: FormFields): ScreeningRulesResult {
  const list = screeningRulesSchema.safeParse(input);
  if (!list.success) {
    return {
      ok: false,
      errors: list.error.issues.map((issue) => ({ path: join(issue.path as Path), message: issue.message })),
    };
  }

  const errors: FieldError[] = [];
  const rules: ScreeningRule[] = [];
  const seenIds = new Set<string>();
  const byKey = new Map(fields.map((field) => [field.key, field]));

  list.data.forEach((item, index) => {
    const parsed = screeningRuleSchema.safeParse(item);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ path: join([index, ...(issue.path as Path)]), message: issue.message });
      }
      return;
    }
    const rule = parsed.data;
    const before = errors.length;

    if (seenIds.has(rule.id)) {
      errors.push({ path: `${index}.id`, message: RELOAD_MESSAGE });
    }
    seenIds.add(rule.id);

    const { condition } = rule;
    if (condition.type === 'number' && condition.op === 'range' && condition.min > condition.max) {
      errors.push({ path: `${index}.condition.min`, message: "The minimum can't be more than the maximum." });
    }

    const field = byKey.get(rule.questionKey);
    if (field === undefined) {
      errors.push({
        path: `${index}.questionKey`,
        message: 'This rule is about a question that is not on the form. Remove the rule.',
      });
    } else if (field.type !== condition.type) {
      errors.push({
        path: `${index}.condition.type`,
        message: "This rule doesn't fit its question's type. Reload the page and try again.",
      });
    } else if (
      (field.type === 'single_select' || field.type === 'multi_select') &&
      (condition.type === 'single_select' || condition.type === 'multi_select')
    ) {
      const known = new Set(field.config.options.map((option) => option.id));
      condition.optionIds.forEach((optionId, i) => {
        if (!known.has(optionId)) {
          errors.push({
            path: `${index}.condition.optionIds.${i}`,
            message: 'This rule uses an option that is not on the question. Update the rule.',
          });
        }
      });
    }

    if (errors.length === before) rules.push(rule);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, rules };
}

/** A rule whose condition the answer did not meet. The caller applies the outcome. */
export interface FiredRule {
  ruleId: string;
  questionKey: string;
  /** The question's label when the rule fired, kept as text so a later rename never rewrites it. */
  questionLabel: string;
  outcome: ScreeningOutcome;
  /** For example "Years of experience was 2, minimum 5". Members only; never shown to applicants. */
  reason: string;
}

const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;

/**
 * Whether `text` contains `word` as a whole word or phrase, ignoring case. The rule's text is
 * escaped, so it is never a pattern; spaces match any run of whitespace. "sql" matches "SQL," but
 * not "mysql".
 */
function containsWord(text: string, word: string): boolean {
  const escaped = word
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/\s+/g, String.raw`\s+`);
  return new RegExp(`(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})`, 'iu').test(text);
}

function optionLabel(field: Extract<FormField, { type: 'single_select' | 'multi_select' }>, id: string) {
  return field.config.options.find((option) => option.id === id)?.label ?? 'Unknown option';
}

function relativeDaysText(days: number): string {
  if (days === 0) return 'the day of applying';
  const n = Math.abs(days);
  return `${n} ${n === 1 ? 'day' : 'days'} ${days > 0 ? 'after' : 'before'} applying`;
}

/** The reason when the answer misses the condition, or null when it meets it (or cannot be judged). */
function unmet(
  condition: ScreeningCondition,
  field: FormField,
  answer: unknown,
  submittedOn: Temporal.PlainDate,
): string | null {
  const label = field.label;
  if (field.type !== condition.type) return null;

  switch (condition.type) {
    case 'single_select': {
      if (field.type !== 'single_select' || typeof answer !== 'string') return null;
      const inSet = condition.optionIds.includes(answer);
      const chosen = optionLabel(field, answer);
      if (condition.op === 'in') {
        const accepted = condition.optionIds.map((id) => optionLabel(field, id)).join(', ');
        return inSet ? null : `${label} was ${chosen}, accepted: ${accepted}`;
      }
      return inSet ? `${label} was ${chosen}, not accepted` : null;
    }

    case 'multi_select': {
      if (field.type !== 'multi_select' || !Array.isArray(answer)) return null;
      const chosen = new Set(answer as string[]);
      const listed = condition.optionIds.map((id) => optionLabel(field, id));
      const hit = condition.optionIds.filter((id) => chosen.has(id)).map((id) => optionLabel(field, id));
      if (condition.op === 'any_of') return hit.length > 0 ? null : `${label} included none of: ${listed.join(', ')}`;
      if (condition.op === 'none_of') return hit.length === 0 ? null : `${label} included ${hit.join(', ')}`;
      const missing = condition.optionIds.filter((id) => !chosen.has(id)).map((id) => optionLabel(field, id));
      return missing.length === 0 ? null : `${label} was missing: ${missing.join(', ')}`;
    }

    case 'number': {
      if (typeof answer !== 'number' || !Number.isFinite(answer)) return null;
      if (condition.op === 'min') {
        return answer >= condition.value ? null : `${label} was ${answer}, minimum ${condition.value}`;
      }
      if (condition.op === 'max') {
        return answer <= condition.value ? null : `${label} was ${answer}, maximum ${condition.value}`;
      }
      return answer >= condition.min && answer <= condition.max
        ? null
        : `${label} was ${answer}, expected ${condition.min} to ${condition.max}`;
    }

    case 'date': {
      const given = parseIsoDate(answer);
      if (given === null) return null;
      const { when } = condition;
      const target =
        when.kind === 'fixed' ? parseIsoDate(when.date) : submittedOn.add({ days: when.days });
      if (target === null) return null;
      const order = Temporal.PlainDate.compare(given, target);
      const met = condition.op === 'before' ? order < 0 : order > 0;
      if (met) return null;
      const suffix = when.kind === 'relative' ? ` (${relativeDaysText(when.days)})` : '';
      return `${label} was ${formatIsoDate(given.toString())}, expected ${condition.op} ${formatIsoDate(target.toString())}${suffix}`;
    }

    case 'short_text':
    case 'long_text': {
      if (typeof answer !== 'string') return null;
      const found = condition.words.filter((word) => containsWord(answer, word));
      if (condition.op === 'any_of') {
        return found.length > 0 ? null : `${label} included none of: ${condition.words.join(', ')}`;
      }
      if (condition.op === 'none_of') return found.length === 0 ? null : `${label} included ${found.join(', ')}`;
      const missing = condition.words.filter((word) => !found.includes(word));
      return missing.length === 0 ? null : `${label} was missing: ${missing.join(', ')}`;
    }

    case 'yes_no':
      if (typeof answer !== 'boolean') return null;
      return answer === condition.answer
        ? null
        : `${label} was ${answer ? 'Yes' : 'No'}, expected ${condition.answer ? 'Yes' : 'No'}`;
  }
}

/**
 * Every Screening rule the answers fire, in rule order, each with a generated reason. It does not
 * apply outcomes: the caller sends the Application to Rejected when any fired rule rejects, and
 * records the flags. A blank or skipped answer never fires, and neither does a rule whose question
 * left the form, changed type, or got an answer of the wrong shape. `submittedOn` is the day the
 * Application was submitted, the base for relative dates. Server-side only.
 */
export function evaluateScreeningRules(
  rules: readonly ScreeningRule[],
  fields: FormFields,
  answers: Answers,
  submittedOn: Temporal.PlainDate,
): FiredRule[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const fired: FiredRule[] = [];

  for (const rule of rules) {
    const field = byKey.get(rule.questionKey);
    const answer = answers[rule.questionKey];
    if (field === undefined || isBlankAnswer(answer)) continue;

    const reason = unmet(rule.condition, field, answer, submittedOn);
    if (reason !== null) {
      fired.push({
        ruleId: rule.id,
        questionKey: rule.questionKey,
        questionLabel: field.label,
        outcome: rule.outcome,
        reason,
      });
    }
  }
  return fired;
}
