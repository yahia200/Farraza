import { isBlankAnswer, type Entry } from './answers.js';
import type { CvSuggestions } from './cv-contacts.js';

/**
 * Which values in the apply form are still untouched CV suggestions (spec
 * `.scratch/cv-autofill/spec.md`, "Web"; glossary **Autofill**). Pure, so it is tested without a
 * browser; the apply form keeps one `CvAutofillState` in a `useRef` and calls these.
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
  /**
   * Repeating groups (ADR-0004): form path (`answers.<group key>`) -> the suggested Entries whose
   * cards are still in the form unchanged. A card is identified by its content, not its position,
   * so removing or reordering cards never confuses it.
   */
  groups: Readonly<Record<string, readonly Entry[]>>;
}

export const EMPTY_AUTOFILL: CvAutofillState = { untouched: {}, groups: {} };

/**
 * The suggestions as form path -> text. Contact values and text answers only; an answer that is
 * not text (a list of Entries from the group extractor) is left to `suggestedGroups`.
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
  return { state: { ...state, untouched: { ...state.untouched, ...fill } }, fill };
}

/** The applicant changed this value: it is theirs now, no longer a suggestion. */
export function touchAutofill(state: CvAutofillState, path: string): CvAutofillState {
  if (!(path in state.untouched)) return state;
  const { [path]: _gone, ...rest } = state.untouched;
  return { ...state, untouched: rest };
}

/** Undo: the paths to clear (only untouched suggestions) and the emptied state. */
export function undoAutofill(state: CvAutofillState): {
  state: CvAutofillState;
  clear: string[];
  /** Per group path, the suggested Entries to take out (`removeSuggestedCards`). */
  remove: Record<string, readonly Entry[]>;
} {
  return { state: EMPTY_AUTOFILL, clear: Object.keys(state.untouched), remove: { ...state.groups } };
}

// --- Repeating groups -------------------------------------------------------------------------

/** A card as the apply form holds it: every sub-question present, the unanswered ones blank. */
type Card = Record<string, unknown>;

/** The Entry lists of the suggestions by form path. Only lists of Entries, never a choice list. */
export function suggestedGroups(suggestions: CvSuggestions): Record<string, Entry[]> {
  const groups: Record<string, Entry[]> = {};
  for (const [key, value] of Object.entries(suggestions.answers)) {
    if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'object')) {
      groups[`answers.${key}`] = value as Entry[];
    }
  }
  return groups;
}

/**
 * Autofill never adds to or mixes into what the applicant typed: a group is filled only when no
 * card has an answer (a required group's one blank card counts as empty). `group(path)` reads the
 * form NOW and says the group's cards and `maxEntries`, or `undefined` if the form has no such group.
 * Returns the Entries to write (at most `maxEntries`) and the state that remembers them.
 */
export function applyGroupSuggestions(
  state: CvAutofillState,
  suggested: Readonly<Record<string, readonly Entry[]>>,
  group: (path: string) => { cards: readonly Card[]; maxEntries: number } | undefined,
): { state: CvAutofillState; fill: Record<string, Entry[]> } {
  const fill: Record<string, Entry[]> = {};
  for (const [path, entries] of Object.entries(suggested)) {
    const target = group(path);
    if (!target || !target.cards.every(isBlankCard)) continue;
    const used = entries.slice(0, target.maxEntries);
    if (used.length > 0) fill[path] = used;
  }
  if (Object.keys(fill).length === 0) return { state, fill };
  return { state: { ...state, groups: { ...state.groups, ...fill } }, fill };
}

/** The applicant changed this group's cards: keep as suggestions only those still unchanged. */
export function touchGroup(state: CvAutofillState, path: string, cards: readonly Card[]): CvAutofillState {
  const suggested = state.groups[path];
  if (!suggested) return state;
  // One card per suggested Entry: a card already matched can't vouch for a second, equal Entry.
  const free = [...cards];
  const kept = suggested.filter((entry) => {
    const at = free.findIndex((card) => cardMatches(card, entry));
    if (at === -1) return false;
    free.splice(at, 1);
    return true;
  });
  const { [path]: _gone, ...others } = state.groups;
  return kept.length === 0 ? { ...state, groups: others } : { ...state, groups: { ...others, [path]: kept } };
}

/** The cards without the untouched suggested ones (each Entry removes at most one card). */
export function removeSuggestedCards<T extends Card>(cards: readonly T[], suggested: readonly Entry[]): T[] {
  const pending = [...suggested];
  return cards.filter((card) => {
    const at = pending.findIndex((entry) => cardMatches(card, entry));
    if (at === -1) return true;
    pending.splice(at, 1);
    return false;
  });
}

/** How many untouched suggestions are in the form, values and cards together (the notice shows above zero). */
export function autofillCount(state: CvAutofillState): number {
  return (
    Object.keys(state.untouched).length +
    Object.values(state.groups).reduce((total, entries) => total + entries.length, 0)
  );
}

function isBlankCard(card: Card): boolean {
  return Object.values(card).every(isBlankAnswer);
}

/** A card is the Entry when its answered sub-questions are exactly the Entry's. */
function cardMatches(card: Card, entry: Entry): boolean {
  const answered = Object.entries(card).filter(([, value]) => !isBlankAnswer(value));
  return (
    answered.length === Object.keys(entry).length &&
    answered.every(([key, value]) => JSON.stringify(value) === JSON.stringify(entry[key]))
  );
}
