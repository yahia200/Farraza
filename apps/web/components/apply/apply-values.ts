import { toNestErrors } from '@hookform/resolvers';
import type { FieldError as FormFieldError, FieldErrors, Resolver } from 'react-hook-form';
import {
  isBlankAnswer,
  isPlainObject,
  parseAnswers,
  submitApplicationSchema,
  type Answers,
  type CvMode,
  type Entry,
  type PublicFormField,
} from '@repo/shared';

/**
 * The apply form's values and validation. Answers are checked with
 * `parseAnswers` from @repo/shared, the same function the API runs on submit,
 * so the browser and the server agree on every rule and message.
 */

/** A single-question answer while the form is being filled in: `null` / '' / [] mean "not answered yet". */
export type LeafInput = string | string[] | boolean | null;

/**
 * One card of a repeating group while it is filled in, keyed by sub-question key (the same shape
 * as an Entry in `Answers`, with the blanks still in).
 */
export type EntryInput = Record<string, LeafInput>;

/** An answer while the form is being filled in. A repeating group's answer is its cards, in order. */
export type AnswerInput = LeafInput | EntryInput[];

export interface ApplyValues {
  name: string;
  email: string;
  phone: string;
  /** Honeypot: hidden from people, so only bots fill it in (see ApplyForm). */
  website: string;
  /** The id of the uploaded CV (a `files` row), or null. The file itself never enters the form. */
  cvFileId: string | null;
  /** Keyed by question key. */
  answers: Record<string, AnswerInput>;
}

export type GroupField = Extract<PublicFormField, { type: 'repeating_group' }>;

/** What a single question holds before the applicant touches it. */
function blankLeaf(field: Exclude<PublicFormField, GroupField>): LeafInput {
  return field.type === 'multi_select' ? [] : field.type === 'short_text' || field.type === 'long_text' ? '' : null;
}

/** A new card with every sub-question blank. */
export function emptyEntry(group: GroupField): EntryInput {
  return Object.fromEntries(group.config.fields.map((child) => [child.key, blankLeaf(child)]));
}

export function emptyValues(fields: readonly PublicFormField[]): ApplyValues {
  const answers: Record<string, AnswerInput> = {};
  for (const field of fields) {
    // A required group starts with one empty card; an optional one starts with none.
    answers[field.key] =
      field.type === 'repeating_group' ? (field.required ? [emptyEntry(field)] : []) : blankLeaf(field);
  }
  return { name: '', email: '', phone: '', website: '', cvFileId: null, answers };
}

/**
 * A group's answer holds cards (objects); a multiple-choice answer holds option ids (strings).
 * An empty list can't be told apart and doesn't need to be: it is a blank answer either way, so
 * it is not "cards" here and `compactAnswers` leaves it out as blank.
 */
function isEntries(value: AnswerInput): value is EntryInput[] {
  return Array.isArray(value) && value.length > 0 && value.some(isPlainObject);
}

/** A group's cards, from its value in the form. */
export function entriesOf(value: AnswerInput | undefined): EntryInput[] {
  return Array.isArray(value) ? value.filter((item): item is EntryInput => isPlainObject(item)) : [];
}

/** An Entry's answers without its blanks, as the API expects (`false` is an answer and stays). */
function compactEntry(entry: EntryInput): Entry {
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => !isBlankAnswer(value))) as Entry;
}

/** The option ids of a multiple-choice answer (a group's cards are the other kind of array). */
export function chosenOptions(value: AnswerInput | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Whether a card has something in it. Spaces alone don't count, as in `parseAnswers`. */
export function entryHasAnswer(entry: EntryInput): boolean {
  return Object.values(entry).some((value) => !isBlankAnswer(value));
}

/**
 * Leaves out unanswered questions, as the API expects (an optional question is simply absent).
 * A group keeps all its cards, blank ones as `{}`, in their order, so an error index from
 * `parseAnswers` (the position in this list) is the card's position on the page. A group with
 * nothing in any card is left out.
 */
export function compactAnswers(answers: Record<string, AnswerInput>): Answers {
  const compact: Answers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (isEntries(value)) {
      if (value.some(entryHasAnswer)) {
        compact[key] = value.map(compactEntry);
      }
    } else if (!isBlankAnswer(value)) {
      compact[key] = value as string | string[] | boolean;
    }
  }
  return compact;
}

/**
 * At a multiple-choice question's limit, the options not chosen yet can't be added. Pass the
 * question's own answer: for a sub-question, the card's, so each card counts on its own.
 */
export function isLockedOption(field: PublicFormField, answer: AnswerInput | undefined, optionId: string): boolean {
  if (field.type !== 'multi_select' || field.config.maxSelections === null || !Array.isArray(answer)) {
    return false;
  }
  const chosen = chosenOptions(answer);
  return !chosen.includes(optionId) && chosen.length >= field.config.maxSelections;
}

const contactSchema =submitApplicationSchema.pick({ name: true, email: true, phone: true });

/**
 * A custom React Hook Form resolver: a function that returns either the values
 * or the errors (https://react-hook-form.com/docs/useform#resolver).
 * zodResolver can't be used for the answers, because their rules depend on the
 * job's questions; `toNestErrors` turns flat paths like "answers.<key>" into
 * RHF's nested error object.
 */
export function applyResolver(fields: readonly PublicFormField[], cvMode: CvMode): Resolver<ApplyValues> {
  return (values, _context, options) => {
    const errors: Record<string, FormFieldError> = {};

    // Same rule as the API's submit. Whether the file is really this job's is the API's call.
    if (cvMode === 'required' && !values.cvFileId) {
      errors.cvFileId = { type: 'validation', message: 'Upload your CV to apply.' };
    }

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
