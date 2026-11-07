import type { FieldError } from './form-fields.js';
import {
  REQUIREMENT_KEYWORD_MAX_LENGTH,
  REQUIREMENT_KEYWORDS_LIMIT,
  type Requirement,
} from './requirements.js';

/**
 * What the Settings tab's Requirements editor needs besides pixels (.scratch/keyword-match, ticket 06):
 * what a new Requirement starts as, adding a keyword under the caps, reordering, and where errors belong.
 * Pure, so it is tested here (the web app has no test runner; same precedent as screening-rule-editor.ts).
 * The messages for the caps match `requirementsSchema`, which stays the one validator on save.
 */

/** A new Requirement: a must-have with no text or keywords yet (invalid until the manager fills it in). */
export function newRequirement(id: string): Requirement {
  return { id, text: '', tier: 'must_have', keywords: [] };
}

/**
 * Adds one keyword typed by the manager. Returns the list unchanged with an `error` when the input is
 * blank, too long, already listed (ignoring case) or past the cap; otherwise the list with the trimmed
 * keyword appended.
 */
export function addKeyword(keywords: readonly string[], input: string): { keywords: string[]; error?: string } {
  const current = [...keywords];
  const keyword = input.trim();
  if (keyword === '') return { keywords: current, error: 'Enter a keyword.' };
  if (keyword.length > REQUIREMENT_KEYWORD_MAX_LENGTH) {
    return { keywords: current, error: `Keywords must be ${REQUIREMENT_KEYWORD_MAX_LENGTH} characters or fewer.` };
  }
  if (current.some((existing) => existing.toLowerCase() === keyword.toLowerCase())) {
    return { keywords: current, error: `"${keyword}" is already listed.` };
  }
  if (current.length >= REQUIREMENT_KEYWORDS_LIMIT) {
    return { keywords: current, error: `Add at most ${REQUIREMENT_KEYWORDS_LIMIT} keywords.` };
  }
  return { keywords: [...current, keyword] };
}

/** The list with the item at `from` moved to `to`; unchanged (a copy) when either index is outside it. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export interface RequirementErrors {
  /** About the description (`text`). */
  text: string[];
  /** About the keyword list or one keyword (`keywords`, `keywords.<i>`). */
  keywords: string[];
  /** Anything else on the Requirement (`id`, `tier`). */
  other: string[];
}

/**
 * Sorts `requirements.<index>.<path>` errors (the API's 400, or `requirementErrorsFromIssues`) onto the
 * Requirements they are about. Errors not about one Requirement, such as "too many", go to `form`.
 */
export function groupRequirementErrors(errors: readonly FieldError[]): {
  byRequirement: Record<number, RequirementErrors>;
  form: string[];
} {
  const byRequirement: Record<number, RequirementErrors> = {};
  const form: string[] = [];
  for (const { path, message } of errors) {
    const [head, index, field] = path.split('.');
    const n = Number(index);
    if (head !== 'requirements' || index === undefined || !Number.isInteger(n)) {
      form.push(message);
      continue;
    }
    const entry = (byRequirement[n] ??= { text: [], keywords: [], other: [] });
    if (field === 'text') entry.text.push(message);
    else if (field === 'keywords') entry.keywords.push(message);
    else entry.other.push(message);
  }
  return { byRequirement, form };
}

/** Zod issues for `{ requirements }` as the same `{ path, message }` errors the API answers with. */
export function requirementErrorsFromIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): FieldError[] {
  return issues.map(({ path, message }) => ({ path: path.map(String).join('.'), message }));
}
