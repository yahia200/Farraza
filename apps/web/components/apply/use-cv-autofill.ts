"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  EMPTY_AUTOFILL,
  applyGroupSuggestions,
  applySuggestions,
  autofillCount,
  extractContactSuggestions,
  isBlankAnswer,
  removeSuggestedCards,
  suggestedGroups,
  suggestedValues,
  touchAutofill,
  touchGroup,
  undoAutofill,
  type CvText,
  type PublicFormField,
} from "@repo/shared";
import { CV_READ_FAILED, CV_SUBMIT_WAIT_MS, readCvText } from "@/lib/cv-reader";
import { emptyEntry, entriesOf, type AnswerInput, type ApplyValues, type EntryInput, type GroupField } from "./apply-values";

/** The repeating group whose form path is `path` (`answers.<key>`), or undefined if it is not one. */
function groupAt(fields: readonly PublicFormField[], path: string): GroupField | undefined {
  const field = fields.find((candidate) => `answers.${candidate.key}` === path);
  return field?.type === "repeating_group" ? (field as GroupField) : undefined;
}

/**
 * CV autofill for the apply form (ADR-0006, spec `.scratch/cv-autofill/spec.md`, "Web").
 *
 * This hook is the one place that joins the three pieces: the reader (`lib/cv-reader.ts`), the
 * shared extractor, and the "untouched suggestion" state (`CvAutofillState` in
 * `@repo/shared/src/cv-autofill.ts`, tested there).
 *
 * What it promises the form:
 * - Reading starts at `pick(file)` and runs beside the upload. Only the submit waits for it, for at
 *   most 5 s (`cvTextForSubmit`); Next and Skip never do.
 * - Suggestions only go into values that are empty at the moment reading finishes.
 * - `touch(path)` must be called for every change the applicant makes, so that value stops being a
 *   suggestion. (Autofill itself writes with `form.setValue` directly, not through `touch`.)
 */
export function useCvAutofill(
  form: UseFormReturn<ApplyValues>,
  fields: readonly PublicFormField[],
) {
  // The reader's result for the CV currently picked: null before a read finishes or with no CV.
  const [cvText, setCvText] = useState<CvText | null>(null);
  // How many untouched suggestions are in the form; the notice shows while it is above zero.
  const [filled, setFilled] = useState(0);
  // The state itself lives in a ref: an async read finishing must see the latest, not the render's.
  const state = useRef(EMPTY_AUTOFILL);
  // Counts picks, so a read that finishes after a newer pick (or a removal) is ignored.
  const generation = useRef(0);
  const mounted = useRef(true);
  // The current CV's read while it runs, and its result once it has finished (for `cvTextForSubmit`).
  const inFlight = useRef<Promise<CvText> | null>(null);
  const settled = useRef<CvText | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** The cards a group holds in the form right now (`getValues` with a runtime path is untyped). */
  const cardsAt = useCallback(
    (path: string) => entriesOf(form.getValues(path as never) as unknown as AnswerInput),
    [form],
  );

  const fillFrom = useCallback(
    (text: string) => {
      const suggestions = extractContactSuggestions(text, fields);
      const suggested = suggestedValues(suggestions);
      const result = applySuggestions(state.current, suggested, (path) =>
        // Read the form now: the applicant may have typed while the CV was being read.
        isBlankAnswer(form.getValues(path as never)),
      );
      for (const [path, value] of Object.entries(result.fill)) {
        form.setValue(path as never, value as never, { shouldDirty: true });
      }
      state.current = result.state;

      // Education / Experience cards (ADR-0004): only into a group with no answered card, read now.
      const groups = applyGroupSuggestions(state.current, suggestedGroups(suggestions), (path) => {
        const group = groupAt(fields, path);
        if (!group) return undefined;
        return {
          cards: cardsAt(path),
          maxEntries: group.config.maxEntries,
        };
      });
      for (const [path, entries] of Object.entries(groups.fill)) {
        const group = groupAt(fields, path) as GroupField;
        // A suggested Entry is partial; the sub-questions it lacks start blank like a new card.
        const cards: EntryInput[] = entries.map((entry) => ({ ...emptyEntry(group), ...entry }) as EntryInput);
        form.setValue(path as never, cards as never, { shouldDirty: true });
      }
      state.current = groups.state;
      setFilled(autofillCount(state.current));
    },
    [fields, form, cardsAt],
  );

  /** Clears the untouched suggestions from the form (not what the applicant changed). */
  const clearSuggestions = useCallback(() => {
    const result = undoAutofill(state.current);
    for (const path of result.clear) {
      form.setValue(path as never, "" as never, { shouldDirty: true });
    }
    // Untouched suggested cards go; edited ones stay. A required group keeps one blank card.
    for (const [path, entries] of Object.entries(result.remove)) {
      const group = groupAt(fields, path);
      if (!group) continue;
      const left = removeSuggestedCards(cardsAt(path), entries);
      const cards = left.length === 0 && group.required ? [emptyEntry(group)] : left;
      form.setValue(path as never, cards as never, { shouldDirty: true });
    }
    state.current = result.state;
    setFilled(0);
  }, [fields, form, cardsAt]);

  /**
   * A CV was picked (a File) or removed (null). Either way the suggestions of the previous CV are
   * cleared first (ticket 09), so none outlives it, a failed read of the new CV leaves no stale
   * notice, and removing is just "replace with nothing". Edited values are not suggestions any
   * more, so they stay. The new read then fills what is empty, including what was just cleared.
   */
  const pick = useCallback(
    (file: File | null) => {
      const mine = ++generation.current;
      setCvText(null);
      settled.current = null;
      inFlight.current = null;
      clearSuggestions();
      if (!file) return;
      const read = readCvText(file);
      inFlight.current = read;
      void read.then((result) => {
        if (!mounted.current || mine !== generation.current) return;
        settled.current = result;
        inFlight.current = null;
        setCvText(result);
        if (result.status === "readable") fillFrom(result.text);
      });
    },
    [fillFrom, clearSuggestions],
  );

  /**
   * The CV text to send with the submit. Waits for a read still in progress for at most
   * `timeoutMs` (5 s by default); if it has not finished by then the CV goes as `failed` with no
   * text, so "not read" stays distinct from "no CV". `null` when no CV was picked. Reads the refs,
   * not the render's state, so it sees a read that finished while the applicant pressed Send.
   */
  const cvTextForSubmit = useCallback(
    async (timeoutMs: number = CV_SUBMIT_WAIT_MS): Promise<CvText | null> => {
      if (settled.current) return settled.current;
      const read = inFlight.current;
      if (!read) return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<CvText>((resolve) => {
        timer = setTimeout(() => resolve(CV_READ_FAILED), timeoutMs);
      });
      try {
        return await Promise.race([read, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
    [],
  );

  /** The applicant changed this value (a group: `value` is its new cards): it is theirs now. */
  const touch = useCallback((path: string, value?: unknown) => {
    const next = touchGroup(touchAutofill(state.current, path), path, entriesOf(value as never));
    if (next === state.current) return;
    state.current = next;
    setFilled(autofillCount(next));
  }, []);

  // `undo` (the notice's button) is `clearSuggestions`: it clears only the untouched suggestions.
  return { cvText, cvTextForSubmit, filled, pick, touch, undo: clearSuggestions };
}
