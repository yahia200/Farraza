import type { CvSuggestions } from './cv-contacts.js';

/**
 * Which values in the apply form are still untouched CV suggestions (spec
 * `.scratch/cv-autofill/spec.md`, "Web"; glossary **Autofill**). Pure, so it is tested without a
 * browser; the apply form keeps one `CvAutofillState` in component state and calls these.
 *
 * A value is identified by its **form path**: `name`, `email`, `phone`, or `answers.<question key>`
 * (a later slice adds the Entries of a repeating group under the same idea). Every function takes a
 * state and returns a new one; nothing mutates.
 *
 * The rule the whole feature rests on: autofill only ever writes to an EMPTY value, and a value the
 * applicant changes (`touchAutofill`) stops being a suggestion, so Undo and a CV replacement never
 * discard the applicant's own work.
 */
export interface CvAutofillState {
  /** Form path -> the suggested value currently in the form, not yet changed by the applicant. */
  untouched: Readonly<Record<string, string>>;
}

export const EMPTY_AUTOFILL: CvAutofillState = { untouched: {} };

/**
 * The suggestions as form path -> text. Contact values and text answers only; an answer that is
 * not text (a list of Entries from the group extractor) is left to the slice that fills groups.
 */
export function suggestedValues(suggestions: CvSuggestions): Record<string, string> {
  const values: Record<string, string> = {};
  if (suggestions.name) values.name = suggestions.name;
  if (suggestions.email) values.email = suggestions.email;
  if (suggestions.phone) values.phone = suggestions.phone;
  for (const [key, value] of Object.entries(suggestions.answers)) {
    if (typeof value === 'string') values[`answers.${key}`] = value;
  }
  return values;
}

/**
 * Decides what to write. `isEmpty(path)` must read the form NOW (not when reading started), which
 * is what keeps a value typed while the CV was being read. Returns the values to write (`fill`) and
 * the new state, which remembers them as untouched suggestions.
 */
export function applySuggestions(
  state: CvAutofillState,
  suggested: Readonly<Record<string, string>>,
  isEmpty: (path: string) => boolean,
): { state: CvAutofillState; fill: Record<string, string> } {
  const fill: Record<string, string> = {};
  for (const [path, value] of Object.entries(suggested)) {
    if (isEmpty(path)) fill[path] = value;
  }
  if (Object.keys(fill).length === 0) return { state, fill };
  return { state: { untouched: { ...state.untouched, ...fill } }, fill };
}

/** The applicant changed this value: it is theirs now, no longer a suggestion. */
export function touchAutofill(state: CvAutofillState, path: string): CvAutofillState {
  if (!(path in state.untouched)) return state;
  const { [path]: _gone, ...rest } = state.untouched;
  return { untouched: rest };
}

/** Undo: the paths to clear (only untouched suggestions) and the emptied state. */
export function undoAutofill(state: CvAutofillState): { state: CvAutofillState; clear: string[] } {
  return { state: EMPTY_AUTOFILL, clear: Object.keys(state.untouched) };
}
