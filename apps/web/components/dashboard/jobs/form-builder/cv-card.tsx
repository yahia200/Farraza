"use client";

import { Controller, type Control } from "react-hook-form";
import { FileTextIcon } from "lucide-react";
import type { CvMode } from "@repo/shared";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BuilderValues } from "./question-card";

const CV_OPTIONS: readonly { value: CvMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "Applicants aren't asked for a CV." },
  {
    value: "optional",
    label: "Optional",
    hint: "Applicants can add a CV, or skip it.",
  },
  {
    value: "required",
    label: "Required",
    hint: "Applicants must add a CV to apply.",
  },
];

/**
 * The CV setting, shown above the questions. The CV is a built-in step of the
 * apply form, not a question (ADR-0002), so it has its own card instead of an
 * entry in the question list.
 *
 * Single-choice toggle group: Base UI's `value` is an array, and pressing the
 * active item reports an empty one, which we ignore so a mode is always chosen
 * (@base-ui/react toggle-group/ToggleGroup.d.ts).
 *
 * `readOnly` (interviewers) has no Base UI prop for toggles, so the group stays
 * enabled, focusable and full contrast, and simply doesn't report changes, as
 * with the question cards. `disabled` is the restore-backup lock.
 */
export function CvCard({
  control,
  readOnly,
  disabled,
}: {
  control: Control<BuilderValues>;
  readOnly: boolean;
  disabled: boolean;
}) {
  return (
    <Controller
      name="cvMode"
      control={control}
      render={({ field }) => {
        const current = CV_OPTIONS.find(
          (option) => option.value === field.value,
        );
        return (
          <section
            aria-labelledby="cv-card-title"
            className="rounded-2xl border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2
                  id="cv-card-title"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <FileTextIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  CV
                </h2>
                {current && (
                  <p
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {current.hint}
                  </p>
                )}
              </div>
              <ToggleGroup
                aria-labelledby="cv-card-title"
                variant="outline"
                size="sm"
                value={[field.value]}
                disabled={disabled}
                onValueChange={(value) => {
                  const next = value[0] as CvMode | undefined;
                  if (next && !readOnly) {
                    field.onChange(next);
                  }
                }}
              >
                {CV_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value} className="px-6">
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </section>
        );
      }}
    />
  );
}
