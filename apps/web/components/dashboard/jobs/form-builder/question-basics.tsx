'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { at, errorAt } from './field-types';
import type { BuilderValues } from './question-card';

/**
 * The class names that animate a Collapsible panel's height, from Base UI's Collapsible docs
 * (docs/react/components/collapsible.md): the panel animates between 0 and --collapsible-panel-height,
 * so its padding and border live on an inner div. Shared by the question cards and a group's sub-questions.
 */
export const COLLAPSIBLE_PANEL_CLASS =
  'h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none';

/**
 * The settings every question has, at any depth: its text, help text and whether it is required.
 * `path` says where the question sits (`fields.2`, or `fields.2.config.fields.0` for a sub-question
 * of a group), so a repeating group edits its sub-questions with the same controls as a top-level card.
 * Meant to sit inside a FieldGroup. `readOnly` / `disabled` are set on each control, as in QuestionCard.
 */
export function QuestionBasics({
  form,
  path,
  idPrefix,
  readOnly,
  disabled,
}: {
  form: UseFormReturn<BuilderValues>;
  path: string;
  idPrefix: string;
  readOnly: boolean;
  disabled: boolean;
}) {
  const errors = form.formState.errors;
  // `key` and `presetKey` have no control, but the schema can still fault them (a stale page, a hand-edited backup).
  const hiddenError = errorAt(errors, at(path, 'key')) ?? errorAt(errors, at(path, 'presetKey'));

  return (
    <>
      {hiddenError && <FieldError>{hiddenError}</FieldError>}
      <Controller
        name={at(path, 'label')}
        control={form.control}
        render={({ field: input, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-label`}>Question</FieldLabel>
            <Input
              id={`${idPrefix}-label`}
              name={input.name}
              ref={input.ref}
              value={String(input.value ?? '')}
              onChange={input.onChange}
              onBlur={input.onBlur}
              readOnly={readOnly}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name={at(path, 'helpText')}
        control={form.control}
        render={({ field: input, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-help`}>Help text</FieldLabel>
            <Input
              id={`${idPrefix}-help`}
              readOnly={readOnly}
              disabled={disabled}
              value={typeof input.value === 'string' ? input.value : ''}
              // Empty means no help text: the schema stores null.
              onChange={(event) => input.onChange(event.target.value === '' ? null : event.target.value)}
              onBlur={input.onBlur}
              aria-describedby={`${idPrefix}-help-description`}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription id={`${idPrefix}-help-description`}>Optional. Shown under the question.</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name={at(path, 'required')}
        control={form.control}
        render={({ field: input }) => (
          <Field orientation="horizontal">
            <Switch
              id={`${idPrefix}-required`}
              checked={input.value === true}
              onCheckedChange={input.onChange}
              readOnly={readOnly}
              disabled={disabled}
            />
            <FieldLabel htmlFor={`${idPrefix}-required`}>Required</FieldLabel>
          </Field>
        )}
      />
    </>
  );
}
