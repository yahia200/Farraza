import type { FieldError, FormField, FormFields } from './form-fields.js';

/** What an applicant can submit for one field. */
export type AnswerValue = string | boolean | string[];

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

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

type Checked = { value: AnswerValue } | { error: string };

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

    case 'file':
      return typeof value === 'string' && UUID.test(value)
        ? { value }
        : { error: 'Upload a file.' };
  }
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
      errors.push({ path: key, message: 'This question is no longer on the form. Reload the page and try again.' });
    }
  }

  for (const field of fields) {
    const value = raw[field.key];

    if (isEmpty(value)) {
      if (field.required) {
        errors.push({ path: field.key, message: 'This question needs an answer.' });
      }
      continue;
    }

    const checked = checkValue(field, value);
    if ('error' in checked) {
      errors.push({ path: field.key, message: checked.error });
    } else {
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