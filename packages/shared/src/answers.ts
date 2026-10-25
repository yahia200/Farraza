import { isoDateOrder, parseIsoDate } from './dates.js';
import type { FieldError, FormField, FormFields } from './form-fields.js';

/**
 * What an applicant can submit for one field. A repeating group's answer is a
 * list of Entries, each one an `Answers` object keyed by sub-question key.
 */
export type AnswerValue = string | number | boolean | string[] | Entry[];

/** One Entry of a repeating group: answers keyed by sub-question key. */
export type Entry = Answers;

/** Answers keyed by field key. Unanswered optional fields are absent. */
export type Answers = Record<string, AnswerValue>;

type SingleSelectField = Extract<FormField, { type: 'single_select' }>;
type YesNoField = Extract<FormField, { type: 'yes_no' }>;

/** A field as applicants may see it: the same, minus knockout rules. */
export type PublicFormField =
  | Exclude<FormField, SingleSelectField | YesNoField>
  | (Omit<SingleSelectField, 'config'> & {
      config: Omit<SingleSelectField['config'], 'rejectOptionIds'>;
    })
  | (Omit<YesNoField, 'config'> & { config: Record<string, unknown> });

/** Removes everything an applicant must not learn about the form. */
export function toPublicFields(fields: FormFields): PublicFormField[] {
  return fields.map((field): PublicFormField => {
    if (field.type === 'single_select') {
      return { ...field, config: { options: field.config.options } };
    }
    if (field.type === 'yes_no') {
      return { ...field, config: {} };
    }
    return field;
  });
}

export type AnswersResult =
  | { ok: true; answers: Answers }
  | { ok: false; errors: FieldError[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether an answer, as typed by an applicant, counts as no answer: missing, `null`, text with
 * only spaces, or an empty list. `false` is an answer ("no"). The server and the apply page use
 * this one rule, so they agree on what a blank question or card is.
 */
export function isBlankAnswer(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** What checking one answer can come to; `errors` paths are relative to the question's key. */
type Checked =
  | { value: AnswerValue }
  | { error: string }
  | { errors: FieldError[] }
  | { absent: true };

/** The longest link accepted, the same bound as `logo_url`. */
const MAX_URL_LENGTH = 2048;

const NO_LONGER_ON_FORM = 'This question is no longer on the form. Reload the page and try again.';

function checkValue(field: PublicFormField, value: unknown): Checked {
  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return { error: 'Enter a text answer.' };
      const text = value.trim();
      return text.length > field.config.maxLength
        ? { error: `Keep your answer to ${field.config.maxLength} characters or fewer.` }
        : { value: text };
    }

    case 'single_select': {
      if (typeof value !== 'string' || !field.config.options.some((o) => o.id === value)) {
        return { error: 'Choose one of the options.' };
      }
      return { value };
    }

    case 'multi_select': {
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        return { error: 'Choose from the listed options.' };
      }
      const selected = value as string[];
      const optionIds = new Set(field.config.options.map((o) => o.id));
      if (new Set(selected).size !== selected.length) {
        return { error: 'Each option can only be chosen once.' };
      }
      if (!selected.every((id) => optionIds.has(id))) {
        return { error: 'Choose from the listed options.' };
      }
      const max = field.config.maxSelections;
      if (max !== null && selected.length > max) {
        return { error: `Choose up to ${max} ${max === 1 ? 'option' : 'options'}.` };
      }
      return { value: selected };
    }

    case 'yes_no':
      return typeof value === 'boolean' ? { value } : { error: 'Choose yes or no.' };

    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'Enter a number.' };
      const { min, max, integerOnly } = field.config;
      if (integerOnly && !Number.isInteger(value)) return { error: 'Enter a whole number.' };
      if (min !== null && value < min) return { error: `Enter a number of at least ${min}.` };
      if (max !== null && value > max) return { error: `Enter a number of at most ${max}.` };
      return { value };
    }

    case 'date': {
      if (typeof value !== 'string' || parseIsoDate(value) === null) return { error: 'Enter a date.' };
      const { min, max } = field.config;
      if (min !== null && isoDateOrder(value, min) < 0) return { error: `Choose a date on or after ${min}.` };
      if (max !== null && isoDateOrder(value, max) > 0) return { error: `Choose a date on or before ${max}.` };
      return { value };
    }

    case 'url': {
      const NOT_A_LINK = 'Enter a web address that starts with http:// or https://.';
      if (typeof value !== 'string') return { error: NOT_A_LINK };
      const text = value.trim();
      if (text.length > MAX_URL_LENGTH) return { error: 'Keep the link to 2,048 characters or fewer.' };
      try {
        const { protocol } = new URL(text);
        return protocol === 'http:' || protocol === 'https:' ? { value: text } : { error: NOT_A_LINK };
      } catch {
        return { error: NOT_A_LINK };
      }
    }

    case 'file':
      return typeof value === 'string' && UUID.test(value)
        ? { value }
        : { error: 'Upload a file.' };

    case 'repeating_group':
      return checkEntries(field, value);
  }
}

type GroupField = Extract<PublicFormField, { type: 'repeating_group' }>;

/** An Entry (or any object), as opposed to `null`, a list or a primitive. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A group's answer: each Entry's sub-answers go through `checkQuestion`, the
 * same check a top-level answer gets. Fully blank Entries are dropped, so
 * "Add another" left empty is not an error and does not count toward the limit.
 */
function checkEntries(field: GroupField, value: unknown): Checked {
  if (!Array.isArray(value)) return { error: 'Add your answers as a list of entries.' };

  const children = field.config.fields;
  const childKeys = new Set(children.map((child) => child.key));
  const errors: FieldError[] = [];
  const entries: Entry[] = [];

  value.forEach((raw: unknown, index) => {
    if (!isPlainObject(raw)) {
      errors.push({ path: String(index), message: 'Fill in this entry again.' });
      return;
    }

    const unknownKeys = Object.keys(raw).filter((key) => !childKeys.has(key));
    if (unknownKeys.length === 0 && children.every((child) => isBlankAnswer(raw[child.key]))) {
      return;
    }

    for (const key of unknownKeys) {
      errors.push({ path: `${index}.${key}`, message: NO_LONGER_ON_FORM });
    }

    const entry: Entry = {};
    for (const child of children) {
      const checked = checkQuestion(child, raw[child.key]);
      if ('error' in checked) {
        errors.push({ path: `${index}.${child.key}`, message: checked.error });
      } else if ('value' in checked) {
        entry[child.key] = checked.value;
      }
    }
    entries.push(entry);
  });

  const max = field.config.maxEntries;
  if (entries.length > max) {
    errors.push({ path: '', message: `Add at most ${max} ${max === 1 ? 'entry' : 'entries'}.` });
  }

  if (errors.length > 0) return { errors };
  return entries.length > 0 ? { value: entries } : { absent: true };
}

/**
 * The check every question gets, whatever its depth: an empty answer is fine
 * unless the question is required, anything else must pass `checkValue`.
 */
function checkQuestion(field: PublicFormField, value: unknown): Checked {
  const checked = isBlankAnswer(value) ? ({ absent: true } as const) : checkValue(field, value);
  return 'absent' in checked && field.required
    ? { error: 'This question needs an answer.' }
    : checked;
}

/** Checks an applicant's answers against a form's fields. */
export function parseAnswers(fields: readonly PublicFormField[], input: unknown): AnswersResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ path: '', message: 'Something went wrong sending your answers. Reload the page and try again.' }] };
  }

  const raw = input as Record<string, unknown>;
  const errors: FieldError[] = [];
  const answers: Answers = {};
  const knownKeys = new Set(fields.map((field) => field.key));

  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) {
      errors.push({ path: key, message: NO_LONGER_ON_FORM });
    }
  }

  for (const field of fields) {
    const checked = checkQuestion(field, raw[field.key]);
    if ('error' in checked) {
      errors.push({ path: field.key, message: checked.error });
    } else if ('errors' in checked) {
      for (const { path, message } of checked.errors) {
        errors.push({ path: path === '' ? field.key : `${field.key}.${path}`, message });
      }
    } else if ('value' in checked) {
      answers[field.key] = checked.value;
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, answers };
}

export interface KnockoutHit {
  fieldKey: string;
  fieldLabel: string;
}

/** The first knockout rule the answers trigger, or null. Server-side only. */
export function findKnockout(fields: FormFields, answers: Answers): KnockoutHit | null {
  for (const field of fields) {
    const answer = answers[field.key];

    if (
      field.type === 'yes_no' &&
      field.config.rejectWhen !== null &&
      answer === field.config.rejectWhen
    ) {
      return { fieldKey: field.key, fieldLabel: field.label };
    }

    if (
      field.type === 'single_select' &&
      typeof answer === 'string' &&
      field.config.rejectOptionIds.includes(answer)
    ) {
      return { fieldKey: field.key, fieldLabel: field.label };
    }
  }
  return null;
}