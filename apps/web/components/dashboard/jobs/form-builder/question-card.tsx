'use client';

import { useState } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react';
import type { CvMode, FormField, FormFields } from '@repo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { at, errorAt, FIELD_TYPES } from './field-types';
import { FileConfigEditor } from './file-config-editor';
import { GroupEditor } from './group-editor';
import { OptionsEditor } from './options-editor';
import { COLLAPSIBLE_PANEL_CLASS, QuestionBasics } from './question-basics';

export type BuilderValues = { fields: FormFields; cvMode: CvMode };
type Form = UseFormReturn<BuilderValues>;

const REJECT_WHEN_ITEMS = [
  { value: 'none', label: 'No auto-reject' },
  { value: 'true', label: 'Reject if they answer Yes' },
  { value: 'false', label: 'Reject if they answer No' },
];

/**
 * One question: a shadcn Collapsible card. The header summarises it and has
 * move/delete buttons; the body is the editor for its type.
 *
 * - `readOnly`: the viewer may only look (e.g. interviewers). Controls keep full
 *   contrast and stay focusable and copyable, unlike `disabled`
 *   (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/readonly).
 * - `disabled`: editing is temporarily unavailable (the restore-backup banner).
 * Set on each control: Base UI's Switch, Checkbox and Select ignore a native
 * `<fieldset disabled>`, and a disabled fieldset would also block the expand button.
 */
export function QuestionCard({
  form,
  index,
  count,
  onMove,
  onRemove,
  readOnly,
  disabled,
  defaultOpen,
}: {
  form: Form;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  readOnly: boolean;
  disabled: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // The live question, so the header summary follows edits.
  const field = useWatch({ control: form.control, name: `fields.${index}` }) as FormField;
  const errors = form.formState.errors;
  // RHF keeps every error for this question under errors.fields[index].
  const hasError = Boolean(errors.fields?.[index]);
  // An error opens the card, and it stays open once fixed (not snapping shut
  // while you type). Adjusting state during render, without an Effect:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (hasError && !open) {
    setOpen(true);
  }
  const TypeIcon = FIELD_TYPES[field.type].icon;
  const autoRejects =
    (field.type === 'single_select' && field.config.rejectOptionIds.length > 0) ||
    (field.type === 'yes_no' && field.config.rejectWhen !== null);
  const path = `fields.${index}`;
  const idPrefix = `question-${field.key}`;
  const editable = !readOnly && !disabled;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-2xl border bg-card', hasError && 'border-destructive')}
    >
      <div className="flex items-center gap-2 p-2 pl-3">
        <CollapsibleTrigger
          render={<button type="button" />}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
        >
          <ChevronRightIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
          <TypeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium">{field.label || <span className="text-muted-foreground">Untitled question</span>}</span>
          <span className="sr-only">({FIELD_TYPES[field.type].label})</span>
          {field.required && <Badge variant="secondary">Required</Badge>}
          {autoRejects && <Badge variant="outline">Auto-reject</Badge>}
          {field.type === 'repeating_group' && Number.isFinite(field.config.maxEntries) && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              Up to {field.config.maxEntries} entries
            </Badge>
          )}
        </CollapsibleTrigger>
        {editable && (
          <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              <ArrowUpIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
              <ArrowDownIcon />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete question" onClick={() => onRemove(index)}>
              <Trash2Icon />
            </Button>
          </div>
        )}
      </div>

      {/* Height animation: see COLLAPSIBLE_PANEL_CLASS. */}
      <CollapsibleContent className={COLLAPSIBLE_PANEL_CLASS}>
        <div className="border-t p-4">
          <FieldGroup>
            <QuestionBasics form={form} path={path} idPrefix={idPrefix} readOnly={readOnly} disabled={disabled} />

            {(field.type === 'short_text' || field.type === 'long_text') && (
              <Controller
                name={at(path, 'config.maxLength')}
                control={form.control}
                render={({ field: input, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${idPrefix}-max`}>Answer limit (characters)</FieldLabel>
                    <Input
                      id={`${idPrefix}-max`}
                      readOnly={readOnly}
                      disabled={disabled}
                      type="number"
                      inputMode="numeric"
                      className="w-32"
                      value={String(input.value ?? '')}
                      // Numbers in the schema, so convert; an empty box stays NaN and fails validation.
                      onChange={(event) => input.onChange(event.target.valueAsNumber)}
                      onBlur={input.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}

            {(field.type === 'single_select' || field.type === 'multi_select') && (
              <Controller
                name={at(path, 'config.options')}
                control={form.control}
                render={({ field: input }) => (
                  <OptionsEditor
                    idPrefix={idPrefix}
                    options={field.config.options}
                    onChange={(options) => input.onChange(options)}
                    rejectIds={field.type === 'single_select' ? field.config.rejectOptionIds : undefined}
                    onRejectChange={
                      field.type === 'single_select'
                        ? (ids) =>
                            form.setValue(at(path, 'config.rejectOptionIds'), ids, {
                              shouldDirty: true,
                              shouldValidate: form.formState.isSubmitted,
                            })
                        : undefined
                    }
                    errors={{
                      list:
                        errorAt(errors, `fields.${index}.config.options`) ??
                        errorAt(errors, `fields.${index}.config.rejectOptionIds`),
                      labels: field.config.options.map((_, i) => errorAt(errors, `fields.${index}.config.options.${i}.label`)),
                    }}
                    readOnly={readOnly}
                    disabled={disabled}
                  />
                )}
              />
            )}

            {field.type === 'multi_select' && (
              <Controller
                name={at(path, 'config.maxSelections')}
                control={form.control}
                render={({ field: input, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${idPrefix}-max-selections`}>Selection limit</FieldLabel>
                    <Input
                      id={`${idPrefix}-max-selections`}
                      type="number"
                      inputMode="numeric"
                      className="w-32"
                      value={input.value === null ? '' : String(input.value)}
                      // Empty means "no limit" (null in the schema).
                      onChange={(event) => input.onChange(event.target.value === '' ? null : event.target.valueAsNumber)}
                      onBlur={input.onBlur}
                      aria-describedby={`${idPrefix}-max-selections-help`}
                      aria-invalid={fieldState.invalid}
                      readOnly={readOnly}
                      disabled={disabled}
                    />
                    <FieldDescription id={`${idPrefix}-max-selections-help`}>Leave empty for no limit.</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}

            {field.type === 'file' && (
              <FileConfigEditor
                form={form}
                index={index}
                idPrefix={idPrefix}
                kinds={field.config.kinds}
                maxSizeMb={field.config.maxSizeMb}
                maxDurationSeconds={field.config.maxDurationSeconds}
                kindsError={errorAt(errors, `fields.${index}.config.kinds`)}
                readOnly={readOnly}
                disabled={disabled}
              />
            )}

            {field.type === 'repeating_group' && (
              <GroupEditor
                form={form}
                path={path}
                idPrefix={idPrefix}
                questions={field.config.fields}
                readOnly={readOnly}
                disabled={disabled}
              />
            )}

            {field.type === 'yes_no' && (
              <Controller
                name={at(path, 'config.rejectWhen')}
                control={form.control}
                render={({ field: input }) => {
                  const value = input.value === null ? 'none' : String(input.value);
                  return (
                    <Field>
                      <FieldLabel htmlFor={`${idPrefix}-reject`}>Auto-reject</FieldLabel>
                      <Select
                        items={REJECT_WHEN_ITEMS}
                        value={value}
                        onValueChange={(next) => input.onChange(next === 'none' ? null : next === 'true')}
                        readOnly={readOnly}
                        disabled={disabled}
                      >
                        <SelectTrigger id={`${idPrefix}-reject`} className="w-fit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REJECT_WHEN_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  );
                }}
              />
            )}
          </FieldGroup>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
