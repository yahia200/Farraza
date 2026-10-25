'use client';

import { useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { ChevronRightIcon } from 'lucide-react';
import type { LeafFormField } from '@repo/shared';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { at, errorAt, FIELD_TYPES, hasErrorAt } from './field-types';
import { COLLAPSIBLE_PANEL_CLASS, QuestionBasics } from './question-basics';
import type { BuilderValues } from './question-card';

/**
 * The body of a repeating group's card (ADR-0004): the Entry limit, then the group's sub-questions,
 * listed and edited in place. The recruiter can change a sub-question's text, help text and
 * "required", and nothing else: no add, remove, reorder, type change or option edit, so there is
 * deliberately no control for them. The group's own text, help text and "required" are
 * `QuestionBasics` in the card, above this.
 * `readOnly` / `disabled` are set on each control, as in QuestionCard.
 */
export function GroupEditor({
  form,
  path,
  idPrefix,
  questions,
  readOnly,
  disabled,
}: {
  form: UseFormReturn<BuilderValues>;
  /** Where the group sits, `fields.2`. */
  path: string;
  idPrefix: string;
  /** The group's live sub-questions, so each row's summary follows edits. */
  questions: readonly LeafFormField[];
  readOnly: boolean;
  disabled: boolean;
}) {
  const listError = errorAt(form.formState.errors, at(path, 'config.fields'));

  return (
    <>
      <Controller
        name={at(path, 'config.maxEntries')}
        control={form.control}
        render={({ field: input, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-max-entries`}>Most entries</FieldLabel>
            <Input
              id={`${idPrefix}-max-entries`}
              readOnly={readOnly}
              disabled={disabled}
              type="number"
              inputMode="numeric"
              className="w-32"
              value={String(input.value ?? '')}
              // A number in the schema, so convert; an empty box stays NaN and fails validation.
              onChange={(event) => input.onChange(event.target.valueAsNumber)}
              onBlur={input.onBlur}
              aria-describedby={`${idPrefix}-max-entries-help`}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription id={`${idPrefix}-max-entries-help`}>
              From 1 to 10. How many entries an applicant can add.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Questions in each entry</legend>
        {questions.map((question, index) => (
          <SubQuestionRow
            key={question.key}
            form={form}
            path={at(path, `config.fields.${index}`)}
            question={question}
            readOnly={readOnly}
            disabled={disabled}
          />
        ))}
        {listError && <FieldError>{listError}</FieldError>}
      </fieldset>
    </>
  );
}

/**
 * One sub-question: a small collapsible row (summary, then the shared basic controls). It opens
 * itself when it has an error, by adjusting state during render, like QuestionCard.
 */
function SubQuestionRow({
  form,
  path,
  question,
  readOnly,
  disabled,
}: {
  form: UseFormReturn<BuilderValues>;
  path: string;
  question: LeafFormField;
  readOnly: boolean;
  disabled: boolean;
}) {
  const hasError = hasErrorAt(form.formState.errors, path);
  const [open, setOpen] = useState(hasError);
  if (hasError && !open) {
    setOpen(true);
  }
  const { label: typeLabel, icon: TypeIcon } = FIELD_TYPES[question.type];
  const idPrefix = `question-${question.key}`;
  const choices =
    question.type === 'single_select' || question.type === 'multi_select'
      ? question.config.options.map((option) => option.label).join(', ')
      : null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-xl border bg-background', hasError && 'border-destructive')}
    >
      <CollapsibleTrigger
        render={<button type="button" />}
        className="flex w-full min-w-0 items-center gap-2 p-2 pl-3 text-left text-sm"
      >
        <ChevronRightIcon className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
        <TypeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{question.label || <span className="text-muted-foreground">Untitled question</span>}</span>
        <span className="sr-only">({typeLabel})</span>
        {question.required && <Badge variant="secondary">Required</Badge>}
      </CollapsibleTrigger>
      <CollapsibleContent className={COLLAPSIBLE_PANEL_CLASS}>
        <div className="border-t p-3">
          <FieldGroup>
            <QuestionBasics form={form} path={path} idPrefix={idPrefix} readOnly={readOnly} disabled={disabled} />
            <p className="text-xs text-muted-foreground">
              {typeLabel}
              {choices && <>. Choices: {choices}. The choices can&apos;t be changed.</>}
            </p>
          </FieldGroup>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
