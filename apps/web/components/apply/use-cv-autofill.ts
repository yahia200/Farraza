"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  EMPTY_AUTOFILL,
  applySuggestions,
  extractContactSuggestions,
  isBlankAnswer,
  suggestedValues,
  touchAutofill,
  undoAutofill,
  type CvText,
  type PublicFormField,
} from "@repo/shared";
import { readCvText } from "@/lib/cv-reader";
import type { ApplyValues } from "./apply-values";

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
      const suggested = suggestedValues(extractContactSuggestions(text, fields));
      const result = applySuggestions(state.current, suggested, (path) =>
        // Read the form now: the applicant may have typed while the CV was being read.
        isBlankAnswer(form.getValues(path as never)),
      );
      for (const [path, value] of Object.entries(result.fill)) {
        form.setValue(path as never, value as never, { shouldDirty: true });
      }
      state.current = result.state;
      setFilled(Object.keys(state.current.untouched).length);
    },
    [fields, form],
  );

  /** Clears the untouched suggestions from the form (not what the applicant changed). */
  const clearSuggestions = useCallback(() => {
    const result = undoAutofill(state.current);
    for (const path of result.clear) {
      form.setValue(path as never, "" as never, { shouldDirty: true });
    }
    state.current = result.state;
    setFilled(0);
  }, [form]);

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
      clearSuggestions();
      if (!file) return;
      void readCvText(file).then((result) => {
        if (!mounted.current || mine !== generation.current) return;
        setCvText(result);
        if (result.status === "readable") fillFrom(result.text);
      });
    },
    [fillFrom, clearSuggestions],
  );

  /** The applicant changed this value: it is theirs now. */
  const touch = useCallback((path: string) => {
    const next = touchAutofill(state.current, path);
    if (next === state.current) return;
    state.current = next;
    setFilled(Object.keys(next.untouched).length);
  }, []);

  /** Undo on the notice: clears only the untouched suggestions. */
  const undo = clearSuggestions;

  return { cvText, filled, pick, touch, undo };
}
