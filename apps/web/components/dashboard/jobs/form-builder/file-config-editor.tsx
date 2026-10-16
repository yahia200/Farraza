'use client';

import { Controller, type Path, type UseFormReturn } from 'react-hook-form';
import {
  FILE_KINDS,
  MAX_FILE_SIZE_MB,
  MIN_FILE_SIZE_MB,
  formatDurationInWords,
  kindsNeedDuration,
  suggestedMaxSizeMb,
  type FileKind,
} from '@repo/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FILE_KIND_OPTIONS } from './field-types';
import type { BuilderValues } from './question-card';

/**
 * The settings of a file question (an Attachment): which kinds of file it accepts and the largest
 * size, with the size following the builder's suggestion for the chosen kinds until it is edited.
 *
 * The length limit is shown only while video or audio is allowed (`kindsNeedDuration`): it is
 * required then, and is cleared to null when the last of them is unticked, which is what the shared
 * schema expects. The size suggestion for a mix of kinds is the largest of them (`suggestedMaxSizeMb`).
 * `readOnly` / `disabled` are set on each control, as in the other editors (see QuestionCard).
 */
export function FileConfigEditor({
  form,
  index,
  idPrefix,
  kinds,
  maxSizeMb,
  maxDurationSeconds,
  kindsError,
  readOnly,
  disabled,
}: {
  form: UseFormReturn<BuilderValues>;
  index: number;
  idPrefix: string;
  /** The question's live settings, so toggling a kind can compare the size with its suggestion. */
  kinds: readonly FileKind[];
  maxSizeMb: number;
  maxDurationSeconds: number | null;
  kindsError?: string;
  readOnly: boolean;
  disabled: boolean;
}) {
  const kindsPath = `fields.${index}.config.kinds` as Path<BuilderValues>;
  const sizePath = `fields.${index}.config.maxSizeMb` as Path<BuilderValues>;
  const durationPath = `fields.${index}.config.maxDurationSeconds` as Path<BuilderValues>;
  const suggested = kinds.length > 0 ? suggestedMaxSizeMb(kinds) : undefined;

  function toggle(kind: FileKind, checked: boolean, onChange: (next: FileKind[]) => void) {
    const next = FILE_KINDS.filter((other) => (other === kind ? checked : kinds.includes(other)));
    onChange(next);
    // Keep the size at the suggestion while the recruiter hasn't chosen a size of their own.
    if (kinds.length > 0 && next.length > 0 && maxSizeMb === suggestedMaxSizeMb(kinds)) {
      form.setValue(sizePath, suggestedMaxSizeMb(next), {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
    // The length limit belongs to video and audio only: drop it when neither is allowed any more.
    if (!kindsNeedDuration(next) && maxDurationSeconds !== null) {
      form.setValue(durationPath, null, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    } else if (form.formState.isSubmitted) {
      void form.trigger(durationPath);
    }
  }

  return (
    <>
      <Controller
        name={kindsPath}
        control={form.control}
        render={({ field: input }) => (
          <fieldset className="grid gap-2" aria-describedby={kindsError ? `${idPrefix}-kinds-error` : undefined}>
            <legend className="mb-1 text-sm font-medium">Accepted files</legend>
            {FILE_KINDS.map((kind) => (
              <Label key={kind} className="font-normal">
                <Checkbox
                  checked={kinds.includes(kind)}
                  onCheckedChange={(checked) => toggle(kind, checked, input.onChange)}
                  readOnly={readOnly}
                  disabled={disabled}
                />
                {FILE_KIND_OPTIONS[kind].label}
                <span className="text-muted-foreground">({FILE_KIND_OPTIONS[kind].formats})</span>
              </Label>
            ))}
            {kindsError && <FieldError id={`${idPrefix}-kinds-error`}>{kindsError}</FieldError>}
          </fieldset>
        )}
      />

      <Controller
        name={sizePath}
        control={form.control}
        render={({ field: input, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-size`}>Maximum file size (MB)</FieldLabel>
            <Input
              id={`${idPrefix}-size`}
              readOnly={readOnly}
              disabled={disabled}
              type="number"
              inputMode="numeric"
              min={MIN_FILE_SIZE_MB}
              max={MAX_FILE_SIZE_MB}
              className="w-32"
              value={String(input.value ?? '')}
              // A number in the schema, so convert; an empty box stays NaN and fails validation.
              onChange={(event) => input.onChange(event.target.valueAsNumber)}
              onBlur={input.onBlur}
              aria-describedby={`${idPrefix}-size-help`}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription id={`${idPrefix}-size-help`}>
              From {MIN_FILE_SIZE_MB} to {MAX_FILE_SIZE_MB} MB.
              {suggested !== undefined && <> Suggested for these files: {suggested} MB.</>}
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {kindsNeedDuration(kinds) && (
        <Controller
          name={durationPath}
          control={form.control}
          render={({ field: input, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-duration`}>Maximum length of video and audio (seconds)</FieldLabel>
              <Input
                id={`${idPrefix}-duration`}
                readOnly={readOnly}
                disabled={disabled}
                type="number"
                inputMode="numeric"
                min={1}
                className="w-32"
                value={input.value === null || input.value === undefined ? '' : String(input.value)}
                // Empty is null, which the schema refuses while video or audio is allowed.
                onChange={(event) => input.onChange(event.target.value === '' ? null : event.target.valueAsNumber)}
                onBlur={input.onBlur}
                aria-describedby={`${idPrefix}-duration-help`}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription id={`${idPrefix}-duration-help`}>
                Required. Longer files are turned away before they upload.
                {Number.isInteger(maxDurationSeconds) && (maxDurationSeconds ?? 0) >= 1 && (
                  <> That is {formatDurationInWords(maxDurationSeconds as number)}.</>
                )}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}
    </>
  );
}
