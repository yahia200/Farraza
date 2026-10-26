'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { at } from './field-types';
import type { BuilderValues } from './question-card';

type Form = UseFormReturn<BuilderValues>;

/**
 * One optional limit input: empty means "no limit" (null in the schema). `kind` picks the box:
 * a number box, or the browser's date picker
 * (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date),
 * whose value is already the stored ISO `YYYY-MM-DD` text.
 */
function LimitInput({
  form,
  path,
  setting,
  id,
  label,
  kind,
  readOnly,
  disabled,
}: {
  form: Form;
  path: string;
  setting: 'min' | 'max';
  id: string;
  label: string;
  kind: 'number' | 'date';
  readOnly: boolean;
  disabled: boolean;
}) {
  return (
    <Controller
      name={at(path, `config.${setting}`)}
      control={form.control}
      render={({ field: input, fieldState }) => {
        const value = input.value as number | string | null;
        return (
          <Field data-invalid={fieldState.invalid} className="w-auto">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              id={id}
              type={kind}
              step={kind === 'number' ? 'any' : undefined}
              className={kind === 'number' ? 'w-40' : 'w-44'}
              // An unfinished number such as "-" is NaN: show it empty so React doesn't overwrite what is being typed.
              value={value === null || (typeof value === 'number' && Number.isNaN(value)) ? '' : String(value)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') input.onChange(null);
                else input.onChange(kind === 'date' ? raw : event.target.valueAsNumber);
              }}
              onBlur={input.onBlur}
              aria-invalid={fieldState.invalid}
              readOnly={readOnly}
              disabled={disabled}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
}

type EditorProps = { form: Form; path: string; idPrefix: string; readOnly: boolean; disabled: boolean };

/** A Number question's settings: smallest, largest, and whole numbers only. Leave a limit empty for none. */
export function NumberConfigEditor({ form, path, idPrefix, readOnly, disabled }: EditorProps) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <LimitInput form={form} path={path} setting="min" id={`${idPrefix}-min`} label="Minimum" kind="number" readOnly={readOnly} disabled={disabled} />
        <LimitInput form={form} path={path} setting="max" id={`${idPrefix}-max`} label="Maximum" kind="number" readOnly={readOnly} disabled={disabled} />
      </div>
      <FieldDescription>Leave a limit empty for no limit.</FieldDescription>
      <Controller
        name={at(path, 'config.integerOnly')}
        control={form.control}
        render={({ field: input }) => (
          <Field orientation="horizontal">
            <Switch
              id={`${idPrefix}-integer`}
              checked={input.value === true}
              onCheckedChange={input.onChange}
              readOnly={readOnly}
              disabled={disabled}
            />
            <FieldLabel htmlFor={`${idPrefix}-integer`}>Whole numbers only</FieldLabel>
          </Field>
        )}
      />
    </>
  );
}

/** A Date question's settings: earliest and latest date. Leave a date empty for none. */
export function DateConfigEditor({ form, path, idPrefix, readOnly, disabled }: EditorProps) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <LimitInput form={form} path={path} setting="min" id={`${idPrefix}-min`} label="Earliest date" kind="date" readOnly={readOnly} disabled={disabled} />
        <LimitInput form={form} path={path} setting="max" id={`${idPrefix}-max`} label="Latest date" kind="date" readOnly={readOnly} disabled={disabled} />
      </div>
      <FieldDescription>Leave a date empty for no limit.</FieldDescription>
    </>
  );
}
