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
import { readCvText } from "@/lib/cv-reader";
import { emptyEntry, entriesOf, type ApplyValues, type EntryInput, type GroupField } from "./apply-values";

/**
 * CV autofill for the apply form (ADR-0006, spec `.scratch/cv-autofill/spec.md`, "Web").
 *
 * This hook is the one place that joins the three pieces: the reader (`lib/cv-reader.ts`), the
 * shared extractor, and the "untouched suggestion" state (`CvAutofillState` in
 * `@repo/shared/src/cv-autofill.ts`, tested there). Later slices extend the same three seams: more
 * extractors in `fillFrom`, more paths in the state, replace/remove in `pick`.
 *
 * What it promises the form:
 * - Reading starts at `pick(file)`, runs beside the upload, and is never awaited by anything.
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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
        const group = fields.find((field) => `answers.${field.key}` === path);
        if (group?.type !== "repeating_group") return undefined;
        return {
          cards: entriesOf(form.getValues(path as never)),
          maxEntries: group.config.maxEntries,
        };
      });
      for (const [path, entries] of Object.entries(groups.fill)) {
        const group = fields.find((field) => `answers.${field.key}` === path) as GroupField;
        // A suggested Entry is partial; the sub-questions it lacks start blank like a new card.
        const cards: EntryInput[] = entries.map((entry) => ({ ...emptyEntry(group), ...entry }));
        form.setValue(path as never, cards as never, { shouldDirty: true });
      }
      state.current = groups.state;
      setFilled(autofillCount(state.current));
    },
    [fields, form],
  );

  /** A CV was picked (a File) or removed (null). */
  const pick = useCallback(
    (file: File | null) => {
      const mine = ++generation.current;
      setCvText(null);
      if (!file) return;
      void readCvText(file).then((result) => {
        if (!mounted.current || mine !== generation.current) return;
        setCvText(result);
        if (result.status === "readable") fillFrom(result.text);
      });
    },
    [fillFrom],
  );

  /** The applicant changed this value (a group: `value` is its new cards): it is theirs now. */
  const touch = useCallback((path: string, value?: unknown) => {
    const next = touchGroup(touchAutofill(state.current, path), path, entriesOf(value as never));
    if (next === state.current) return;
    state.current = next;
    setFilled(autofillCount(next));
  }, []);

  /** Undo on the notice: clears only the untouched suggestions. */
  const undo = useCallback(() => {
    const result = undoAutofill(state.current);
    for (const path of result.clear) {
      form.setValue(path as never, "" as never, { shouldDirty: true });
    }
    // Untouched suggested cards go; edited ones stay. A required group keeps one blank card.
    for (const [path, entries] of Object.entries(result.remove)) {
      const group = fields.find((field) => `answers.${field.key}` === path);
      if (group?.type !== "repeating_group") continue;
      const left = removeSuggestedCards(entriesOf(form.getValues(path as never)), entries);
      const cards = left.length === 0 && group.required ? [emptyEntry(group)] : left;
      form.setValue(path as never, cards as never, { shouldDirty: true });
    }
    state.current = result.state;
    setFilled(0);
  }, [fields, form]);

  return { cvText, filled, pick, touch, undo };
}
