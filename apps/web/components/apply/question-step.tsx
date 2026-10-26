'use client';

import { Controller, type Path, type UseFormReturn } from 'react-hook-form';
import type { PublicFormField } from '@repo/shared';
import {
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { DatePicker } from '@/components/date-picker';
import { limitHint } from './limit-hint';
import { isTextBox, isTypedField, typedInputProps } from './typed-input';
import { chosenOptions, isLockedOption, type AnswerInput, type ApplyValues } from './apply-values';

/**
 * One job question as a questionnaire step (shadcn Questionnaire:
 * https://ui.shadcn.com/docs/components/base/questionnaire). React Hook Form
 * owns the value, so every choice and input is controlled; the step's `name`
 * is the question key, which is also its answer key. File questions are `AttachmentStep`s
 * (attachment-step.tsx), which the questionnaire's inputs can't express.
 */
export function QuestionStep({
  form,
  field,
  onAnswer,
}: {
  form: UseFormReturn<ApplyValues>;
  field: PublicFormField;
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
        const value: AnswerInput = input.value;
        const answer = (next: AnswerInput) => onAnswer(path, next);
        const hint = isTypedField(field) ? limitHint(field) : null;

        return (
          <QuestionnaireItem
            name={field.key}
            required={field.required}
            multiple={field.type === 'multi_select'}
            invalid={fieldState.invalid}
          >
            <QuestionnaireTitle>{label}</QuestionnaireTitle>
            {field.helpText && <QuestionnaireDescription>{field.helpText}</QuestionnaireDescription>}
            {field.type === 'multi_select' && field.config.maxSelections !== null && (
              <QuestionnaireDescription>
                Choose up to {field.config.maxSelections} {field.config.maxSelections === 1 ? 'option' : 'options'}.
              </QuestionnaireDescription>
            )}

            {hint && <QuestionnaireDescription>{hint}</QuestionnaireDescription>}

            <QuestionnaireChoices>
              {/* Number, Date and URL keep the box's text in the form (apply-values.ts turns a
                  number's text into a JSON number). The native number input only yields a valid
                  value or ''. A date is picked from a calendar (`DatePicker`), limited by `min`/`max`. */}
              {field.type === 'date' && (
                <>
                  <DatePicker
                    ref={input.ref}
                    label={label}
                    value={typeof value === 'string' ? value : ''}
                    onChange={answer}
                    min={field.config.min ?? undefined}
                    max={field.config.max ?? undefined}
                    invalid={fieldState.invalid}
                  />
                  {/* The questionnaire counts a step as answered only when one of its own
                      controls has a value, and a button has none, so this read-only input
                      mirrors the date (as `UploadControl` does for a file id). */}
                  <QuestionnaireInput
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                    value={typeof value === 'string' ? value : ''}
                    onChange={() => {}}
                  />
                </>
              )}

              {(field.type === 'number' || field.type === 'url') && (
                <QuestionnaireInput
                  ref={input.ref}
                  {...typedInputProps(field)}
                  aria-label={label}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => answer(event.target.value)}
                />
              )}

              {field.type === 'short_text' && (
                <QuestionnaireInput
                  ref={input.ref}
                  aria-label={label}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => answer(event.target.value)}
                  maxLength={field.config.maxLength}
                />
              )}

              {field.type === 'long_text' && (
                <>
                  {/* The questionnaire's Input is a native <input>; its render prop swaps in a
                      <textarea> for multi-line answers (Base UI-style `render`). */}
                  <QuestionnaireInput
                    ref={input.ref}
                    render={<textarea rows={5} />}
                    aria-label={label}
                    className="h-auto min-h-32 resize-y rounded-2xl py-2.5"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => answer(event.target.value)}
                    maxLength={field.config.maxLength}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(typeof value === 'string' ? value.length : 0).toLocaleString()} /{' '}
                    {field.config.maxLength.toLocaleString()} characters
                  </p>
                </>
              )}

              {field.type === 'single_select' &&
                field.config.options.map((option) => (
                  <QuestionnaireChoice
                    key={option.id}
                    value={option.id}
                    checked={value === option.id}
                    onChange={() => answer(option.id)}
                  >
                    {option.label}
                  </QuestionnaireChoice>
                ))}

              {field.type === 'yes_no' &&
                ([
                  [true, 'Yes'],
                  [false, 'No'],
                ] as const).map(([choice, text]) => (
                  // Native values are strings; the answer itself is a boolean.
                  <QuestionnaireChoice
                    key={text}
                    value={String(choice)}
                    checked={value === choice}
                    onChange={() => answer(choice)}
                  >
                    {text}
                  </QuestionnaireChoice>
                ))}

              {field.type === 'multi_select' &&
                field.config.options.map((option) => {
                  const selected = chosenOptions(value);
                  return (
                    <QuestionnaireChoice
                      key={option.id}
                      value={option.id}
                      checked={selected.includes(option.id)}
                      // Must match the step list in ApplyForm, which uses the same rule.
                      disabled={isLockedOption(field, value, option.id)}
                      onChange={(event) =>
                        answer(
                          event.target.checked
                            ? [...selected, option.id]
                            : selected.filter((id) => id !== option.id),
                        )
                      }
                    >
                      {option.label}
                    </QuestionnaireChoice>
                  );
                })}

            </QuestionnaireChoices>

            {/* Text questions get parseAnswers' wording instead of the questionnaire's
                default ("Choose an answer to continue."), which suits choices. */}
            <QuestionnaireError>
              {fieldState.error?.message ??
                (isTextBox(field) ? 'This question needs an answer.' : undefined)}
            </QuestionnaireError>
          </QuestionnaireItem>
        );
      }}
    />
  );
}
