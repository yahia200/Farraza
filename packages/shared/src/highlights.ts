import { z } from 'zod';
import type { FieldError, FormField, LeafFormField } from './form-fields.js';

/*
 * Highlighted questions: up to three single-answer Questions whose answers a Job shows on every
 * Application in its candidate list (GLOSSARY.md, "Highlighted question").
 */

/** How many Highlighted questions a Job can have. */
export const HIGHLIGHT_LIMIT = 3;

/**
 * The Question types with a single answer that fits on one line. An allowlist, so a type added
 * later is not highlightable until someone decides how it reads in the list.
 */
const HIGHLIGHTABLE_TYPES: ReadonlySet<FormField['type']> = new Set<LeafFormField['type']>([
  'short_text',
  'long_text',
  'single_select',
  'multi_select',
  'yes_no',
  'number',
  'date',
  'url',
]);

function isHighlightableField(field: FormField): field is LeafFormField {
  return HIGHLIGHTABLE_TYPES.has(field.type);
}

/**
 * The Questions of a form that can be highlighted, in form order: its top-level Questions of a
 * single-answer type. A file Question, a Repeating group and a group's sub-questions are not.
 */
export function highlightableQuestions(fields: readonly FormField[]): LeafFormField[] {
  return fields.filter(isHighlightableField);
}

/** Whether the Question with this key can be highlighted on this form (false when the form lacks it). */
export function isHighlightable(fields: readonly FormField[], key: string): boolean {
  return highlightableQuestions(fields).some((question) => question.key === key);
}

// Keys come from the picker, not from typing, so a bad one means a stale page or a bug.
const RELOAD = 'Something went wrong. Reload the page and try again.';

/**
 * The Highlighted questions a Job stores: at most `HIGHLIGHT_LIMIT` Question keys, each a UUID and
 * none twice. Whether each key is on the form is not a schema concern: `checkHighlightKeys` does
 * that against the latest published form. Order carries no meaning (the list follows form order).
 */
export const highlightedQuestionKeysSchema = z
  .array(z.uuid({ error: RELOAD }), { error: RELOAD })
  .max(HIGHLIGHT_LIMIT, { error: `Choose up to ${HIGHLIGHT_LIMIT} questions.` })
  .superRefine((keys, ctx) => {
    keys.forEach((key, index) => {
      if (keys.indexOf(key) !== index) {
        ctx.addIssue({ code: 'custom', message: RELOAD, path: [index] });
      }
    });
  });

export type HighlightKeysResult = { ok: true; keys: string[] } | { ok: false; errors: FieldError[] };

/**
 * Checks a list of keys against a form's fields (the latest published form): every key must be a
 * highlightable Question there. Returns the keys unchanged, or one error per bad key with its
 * index as the path, like the other validators.
 */
export function checkHighlightKeys(keys: readonly string[], fields: readonly FormField[]): HighlightKeysResult {
  const errors = keys.flatMap((key, index): FieldError[] => {
    if (isHighlightable(fields, key)) {
      return [];
    }
    return [
      {
        path: String(index),
        message: isOnForm(fields, key)
          ? "This question can't be shown in the list."
          : "This question isn't on the published form. Reload the page and try again.",
      },
    ];
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, keys: [...keys] };
}

/** Whether the form has a Question with this key anywhere, a group's sub-questions included. */
function isOnForm(fields: readonly FormField[], key: string): boolean {
  return fields.some(
    (field) =>
      field.key === key ||
      (field.type === 'repeating_group' && field.config.fields.some((child) => child.key === key)),
  );
}
