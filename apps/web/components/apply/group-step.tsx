'use client';

import { useId, useRef, useState } from 'react';
import { Controller, type Path, type UseFormReturn } from 'react-hook-form';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import {
  chosenOptions,
  emptyEntry,
  entriesOf,
  entryHasAnswer,
  isLockedOption,
  type AnswerInput,
  type ApplyValues,
  type EntryInput,
  type GroupField,
  type LeafInput,
} from './apply-values';

import { limitHint } from './limit-hint';
import { ENTER_CANCELLED_INPUT_TYPES, isTypedField, typedInputProps } from './typed-input';

type SubQuestion = GroupField['config']['fields'][number];

/**
 * What React Hook Form holds as the error of a group: nested errors are keyed by card position
 * and sub-question key (`parseAnswers` paths `<group>.<index>.<child>`); a message on the
 * group itself is `message`, or `root` when cards have errors too (@hookform/resolvers' `toNestErrors`).
 */
type GroupErrors = { message?: string; root?: { message?: string } } & Record<
  number,
  Record<string, { message?: string } | undefined> | undefined
>;

/** A callback ref defined once: React calls it with the element when it mounts (and null when it unmounts). */
const focusFirstControl = (card: HTMLElement | null) =>
  card?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, [role=radio], [role=checkbox]')?.focus();

/**
 * A repeating group (ADR-0004) as one questionnaire step: a card per Entry, with "Add another"
 * and "Remove". Like the CV and Attachment steps it is a custom control inside a normal
 * `QuestionnaireItem`: the questionnaire only counts a step as answered when one of its own
 * controls has a value, so `GroupCards` mirrors "some card has an answer" into a read-only
 * `sr-only` `QuestionnaireInput`. The cards' own controls are plain shadcn ones (not
 * `QuestionnaireChoice`), so the questionnaire's letter shortcuts, and the page-wide locked
 * options in `ApplyForm`, never see them. The value is the group's cards at `answers.<key>`.
 */
export function GroupStep({
  form,
  field,
  onAnswer,
}: {
  form: UseFormReturn<ApplyValues>;
  field: GroupField;
  /** Sets the value and re-checks the step if it currently shows an error. */
  onAnswer: (path: Path<ApplyValues>, value: AnswerInput) => void;
}) {
  const path = `answers.${field.key}` as const;
  const label = field.required ? field.label : `${field.label} (optional)`;

  return (
    <Controller
      name={path}
      control={form.control}
      render={({ field: input, fieldState }) => {
        const errors = fieldState.error as unknown as GroupErrors | undefined;
        const message = errors?.message ?? errors?.root?.message;
        const hasCardErrors = Object.keys(errors ?? {}).some((key) => /^\d+$/.test(key));

        return (
          <QuestionnaireItem name={field.key} required={field.required} invalid={fieldState.invalid}>
            <QuestionnaireTitle>{label}</QuestionnaireTitle>
            {field.helpText && <QuestionnaireDescription>{field.helpText}</QuestionnaireDescription>}
            {field.config.maxEntries > 1 && (
              <QuestionnaireDescription>Add up to {field.config.maxEntries} entries.</QuestionnaireDescription>
            )}

            <GroupCards
              field={field}
              entries={entriesOf(input.value)}
              errors={errors}
              onChange={(entries) => onAnswer(path, entries)}
            />

            <QuestionnaireError>
              {message ??
                (hasCardErrors
                  ? 'Fix the answers marked above to continue.'
                  : field.required
                    ? 'This question needs an answer.'
                    : 'Add an entry, or skip this question.')}
            </QuestionnaireError>
          </QuestionnaireItem>
        );
      }}
    />
  );
}

function GroupCards({
  field,
  entries,
  errors,
  onChange,
}: {
  field: GroupField;
  entries: EntryInput[];
  errors: GroupErrors | undefined;
  onChange: (entries: EntryInput[]) => void;
}) {
  const idPrefix = useId();
  // A card needs an identity that outlives its position, or removing the first card would hand its
  // controls (and their focus) to the next one. The values stay in the form; this list only keeps
  // one key per card, in step with `entries`. `added` is the card to focus when it mounts.
  const [cards, setCards] = useState(() => ({
    ids: entries.map((_, index) => index),
    next: entries.length,
    added: null as number | null,
  }));
  const list = useRef<HTMLDivElement>(null);
  const atLimit = entries.length >= field.config.maxEntries;

  function add() {
    setCards((current) => ({ ids: [...current.ids, current.next], next: current.next + 1, added: current.next }));
    onChange([...entries, emptyEntry(field)]);
  }

  function remove(index: number) {
    // Focus the list first: the button that was pressed is about to unmount.
    list.current?.focus();
    setCards((current) => ({ ...current, ids: current.ids.filter((_, position) => position !== index) }));
    onChange(entries.filter((_, position) => position !== index));
  }

  function answer(index: number, key: string, value: LeafInput) {
    onChange(entries.map((entry, position) => (position === index ? { ...entry, [key]: value } : entry)));
  }

  return (
    <QuestionnaireChoices
      className="flex flex-col gap-3"
      // The questionnaire's keys are for its own controls: Enter goes to the next step (and would
      // submit the application from a plain text input), the arrow keys change step, and letters
      // pick choices. Inside the cards they would do the wrong thing, so they stop here.
      onKeyDown={(event) => {
        event.stopPropagation();
        if (
          event.key === 'Enter' &&
          event.target instanceof HTMLInputElement &&
          ENTER_CANCELLED_INPUT_TYPES.includes(event.target.type)
        ) {
          event.preventDefault();
        }
      }}
    >
      <div ref={list} tabIndex={-1} className="flex flex-col gap-3 outline-none">
        {entries.map((entry, index) => {
          const id = cards.ids[index] ?? `index-${index}`;
          const title = `${field.label} ${index + 1}`;
          const cardErrors = errors?.[index];
          const childKeys = field.config.fields.map((child) => child.key);
          // An error for something this card doesn't show (a question removed meanwhile).
          const otherErrors = Object.entries(cardErrors ?? {}).filter(([key]) => !childKeys.includes(key));

          return (
            <Card
              key={id}
              size="sm"
              role="group"
              aria-labelledby={`${idPrefix}-${id}-title`}
              ref={cards.added === id ? focusFirstControl : undefined}
              className="shadow-none ring-border"
            >
              <CardHeader>
                <CardTitle id={`${idPrefix}-${id}-title`}>{title}</CardTitle>
                <CardAction>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${title}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Remove
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {/* Not shadcn's FieldGroup: it is a size container (`@container`, container-type
                    inline-size), and inside this card Chrome collapsed it to zero height each time
                    an error under one of its inputs cleared. A plain column does the same job. */}
                <div className="flex flex-col gap-5">
                  {field.config.fields.map((child) => (
                    <SubQuestionControl
                      key={child.key}
                      child={child}
                      id={`${idPrefix}-${id}-${child.key}`}
                      value={entry[child.key]}
                      error={cardErrors?.[child.key]?.message}
                      onChange={(value) => answer(index, child.key, value)}
                    />
                  ))}
                  {otherErrors.map(([key, error]) => (
                    <FieldError key={key}>{error?.message}</FieldError>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-fit" disabled={atLimit} onClick={add}>
        <PlusIcon data-icon="inline-start" />
        {entries.length === 0 ? 'Add' : 'Add another'}
      </Button>

      <QuestionnaireInput
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={entries.some(entryHasAnswer) ? 'answered' : ''}
        onChange={() => {}}
      />
    </QuestionnaireChoices>
  );
}

/**
 * One sub-question of one card. Plain shadcn controls on Base UI, controlled by the form's value;
 * the multiple-choice limit is read from this card's own selection (`isLockedOption`), so a
 * card never affects another.
 */
function SubQuestionControl({
  child,
  id,
  value,
  error,
  onChange,
}: {
  child: SubQuestion;
  id: string;
  value: LeafInput | undefined;
  error: string | undefined;
  onChange: (value: LeafInput) => void;
}) {
  const label = child.required ? child.label : `${child.label} (optional)`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [child.helpText ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const help = child.helpText && <FieldDescription id={helpId}>{child.helpText}</FieldDescription>;
  const problem = error && <FieldError id={errorId}>{error}</FieldError>;

  if (child.type === 'short_text' || child.type === 'long_text') {
    const text = typeof value === 'string' ? value : '';
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help}
        {child.type === 'short_text' ? (
          <Input
            id={id}
            value={text}
            maxLength={child.config.maxLength}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <>
            <Textarea
              id={id}
              rows={4}
              value={text}
              maxLength={child.config.maxLength}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              onChange={(event) => onChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {text.length.toLocaleString()} / {child.config.maxLength.toLocaleString()} characters
            </p>
          </>
        )}
        {problem}
      </Field>
    );
  }

  if (isTypedField(child)) {
    const text = typeof value === 'string' ? value : '';
    const hint = limitHint(child);
    const hintId = `${id}-limit`;
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {help}
        {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
        <Input
          id={id}
          value={text}
          {...typedInputProps(child)}
          aria-invalid={Boolean(error)}
          aria-describedby={[describedBy, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {problem}
      </Field>
    );
  }

  // Choices: a labelled group of options. Wrapping labels as in Base UI's radio and checkbox docs
  // (docs/react/components/radio.md, checkbox.md "Labeling a checkbox").
  const legendId = `${id}-legend`;
  return (
    <FieldSet data-invalid={Boolean(error)} aria-describedby={describedBy} className="gap-2">
      <FieldLegend variant="label" id={legendId} className="mb-0">
        {label}
      </FieldLegend>
      {help}
      {child.type === 'multi_select' && child.config.maxSelections !== null && (
        <FieldDescription>
          Choose up to {child.config.maxSelections} {child.config.maxSelections === 1 ? 'option' : 'options'}.
        </FieldDescription>
      )}

      {child.type === 'single_select' && (
        <RadioGroup
          aria-labelledby={legendId}
          value={typeof value === 'string' ? value : ''}
          onValueChange={(next) => onChange(String(next))}
          className="gap-1"
        >
          {child.config.options.map((option) => (
            <Label key={option.id} className="min-h-11 font-normal sm:min-h-8">
              <RadioGroupItem value={option.id} aria-invalid={Boolean(error)} />
              {option.label}
            </Label>
          ))}
        </RadioGroup>
      )}

      {child.type === 'yes_no' && (
        <RadioGroup
          aria-labelledby={legendId}
          value={typeof value === 'boolean' ? String(value) : ''}
          onValueChange={(next) => onChange(next === 'true')}
          className="gap-1"
        >
          {(
            [
              ['true', 'Yes'],
              ['false', 'No'],
            ] as const
          ).map(([choice, text]) => (
            <Label key={choice} className="min-h-11 font-normal sm:min-h-8">
              <RadioGroupItem value={choice} aria-invalid={Boolean(error)} />
              {text}
            </Label>
          ))}
        </RadioGroup>
      )}

      {child.type === 'multi_select' && (
        <div role="group" aria-labelledby={legendId} className="grid gap-1">
          {child.config.options.map((option) => {
            const selected = chosenOptions(value);
            return (
              <Label key={option.id} className="min-h-11 font-normal sm:min-h-8">
                <Checkbox
                  checked={selected.includes(option.id)}
                  // Counts this card's selection only, unlike the page-wide locks of top-level questions.
                  disabled={isLockedOption(child, selected, option.id)}
                  aria-invalid={Boolean(error)}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...selected, option.id] : selected.filter((chosen) => chosen !== option.id))
                  }
                />
                {option.label}
              </Label>
            );
          })}
        </div>
      )}
      {problem}
    </FieldSet>
  );
}
