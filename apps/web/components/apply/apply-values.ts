import { toNestErrors } from '@hookform/resolvers';
import type { FieldError as FormFieldError, FieldErrors, Resolver } from 'react-hook-form';
import { parseAnswers, submitApplicationSchema, type Answers, type PublicFormField } from '@repo/shared';

/**
 * The apply form's values and validation. Answers are checked with
 * `parseAnswers` from @repo/shared, the same function the API runs on submit,
 * so the browser and the server agree on every rule and message.
 */

/** An answer while the form is being filled in: `null` / '' / [] mean "not answered yet". */
export type AnswerInput = string | string[] | boolean | null;

export interface ApplyValues {
  name: string;
  email: string;
  phone: string;
  /** Honeypot: hidden from people, so only bots fill it in (see ApplyForm). */
  website: string;
  /** Keyed by question key. */
  answers: Record<string, AnswerInput>;
}

export function emptyValues(fields: readonly PublicFormField[]): ApplyValues {
  const answers: Record<string, AnswerInput> = {};
  for (const field of fields) {
    answers[field.key] =
      field.type === 'multi_select' ? [] : field.type === 'short_text' || field.type === 'long_text' ? '' : null;
  }
  return { name: '', email: '', phone: '', website: '', answers };
}

/** Leaves out unanswered questions, as the API expects (an optional question is simply absent). */
export function compactAnswers(answers: Record<string, AnswerInput>): Answers {
  const compact: Answers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    compact[key] = value;
  }
  return compact;
}

/** At a multiple-choice question's limit, the options not chosen yet can't be added. */
export function isLockedOption(field: PublicFormField, answer: AnswerInput | undefined, optionId: string): boolean {
  if (field.type !== 'multi_select' || field.config.maxSelections === null || !Array.isArray(answer)) {
    return false;
  }
  return !answer.includes(optionId) && answer.length >= field.config.maxSelections;
}

const contactSchema =submitApplicationSchema.pick({ name: true, email: true, phone: true });

/**
 * A custom React Hook Form resolver: a function that returns either the values
 * or the errors (https://react-hook-form.com/docs/useform#resolver).
 * zodResolver can't be used for the answers, because their rules depend on the
 * job's questions; `toNestErrors` turns flat paths like "answers.<key>" into
 * RHF's nested error object.
 */
export function applyResolver(fields: readonly PublicFormField[]): Resolver<ApplyValues> {
  return (values, _context, options) => {
    const errors: Record<string, FormFieldError> = {};

    const contact = contactSchema.safeParse({ name: values.name, email: values.email, phone: values.phone });
    if (!contact.success) {
      for (const issue of contact.error.issues) {
        errors[String(issue.path[0])] ??= { type: 'validation', message: issue.message };
      }
    }

    const answers = parseAnswers(fields, compactAnswers(values.answers));
    if (!answers.ok) {
      for (const { path, message } of answers.errors) {
        errors[`answers.${path}`] ??= { type: 'validation', message };
      }
    }

    if (Object.keys(errors).length > 0) {
      return { values: {}, errors: toNestErrors(errors as FieldErrors, options) };
    }
    return { values, errors: {} };
  };
}
