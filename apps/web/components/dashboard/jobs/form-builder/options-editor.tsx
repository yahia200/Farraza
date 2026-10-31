'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { newOption } from './field-types';

type Option = { id: string; label: string };

/**
 * The choices of a single- or multiple-choice question, as a controlled list.
 * Not a nested useFieldArray: RHF uses an `id` key for its own row ids, and
 * these options already have a real `id` that must be saved unchanged.
 * `readOnly` is for people who may only view the form; `disabled` is a
 * temporary lock (the restore-backup banner). Either one hides the add/remove buttons.
 */
export function OptionsEditor({
  idPrefix,
  options,
  onChange,
  errors,
  readOnly,
  disabled,
}: {
  idPrefix: string;
  options: Option[];
  onChange: (options: Option[]) => void;
  errors: { list?: string; labels: (string | undefined)[] };
  readOnly: boolean;
  disabled: boolean;
}) {
  const editable = !readOnly && !disabled;

  function rename(index: number, label: string) {
    onChange(options.map((option, i) => (i === index ? { ...option, label } : option)));
  }

  function remove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Options</legend>
      {options.map((option, index) => {
        const inputId = `${idPrefix}-option-${option.id}`;
        return (
          <div key={option.id} className="grid gap-1">
            <div className="flex items-center gap-2">
              <Input
                id={inputId}
                aria-label={`Option ${index + 1}`}
                value={option.label}
                onChange={(event) => rename(index, event.target.value)}
                readOnly={readOnly}
                disabled={disabled}
                aria-invalid={Boolean(errors.labels[index])}
              />
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() => remove(index)}
                  disabled={options.length <= 2}
                >
                  <XIcon />
                </Button>
              )}
            </div>
            {errors.labels[index] && <FieldError>{errors.labels[index]}</FieldError>}
          </div>
        );
      })}
      {errors.list && <FieldError>{errors.list}</FieldError>}
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange([...options, newOption(`Option ${options.length + 1}`)])}
          disabled={options.length >= 50}
        >
          <PlusIcon data-icon="inline-start" />
          Add option
        </Button>
      )}
    </fieldset>
  );
}
