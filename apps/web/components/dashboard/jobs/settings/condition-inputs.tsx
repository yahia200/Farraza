'use client';

import {
  isDuplicateScreeningWord,
  MAX_RELATIVE_DAYS,
  normaliseScreeningWord,
  SCREENING_WORD_MAX_LENGTH,
  SCREENING_WORDS_LIMIT,
  type ScreeningCondition,
} from '@repo/shared';
import { PlusIcon, XIcon } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/**
 * The inputs of the number, date and text conditions in the Screening rules editor (ticket 07).
 * Each takes the matching `ScreeningCondition` member and returns the next one, so the editor's
 * state stays the exact payload. A condition describes the ACCEPTABLE answer (screening-rules.ts).
 */

type Of<T extends ScreeningCondition['type']> = Extract<ScreeningCondition, { type: T }>;

/**
 * A number the manager types. The text is kept while typing ("-", "1.", empty) and only a finite
 * number is passed up, so an unfinished entry never changes the rule; on blur the box shows the
 * rule's value again. https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number
 */
function NumberBox({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !Number.isFinite(Number(draft === '' ? NaN : draft));
  return (
    <div className="flex flex-col gap-1">
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        aria-label={label}
        aria-invalid={invalid}
        className="w-32"
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number(event.target.value);
          if (event.target.value !== '' && Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid && <p className="text-sm text-destructive">Enter a number.</p>}
    </div>
  );
}

export function NumberConditionEditor({
  condition,
  disabled,
  label,
  onChange,
}: {
  condition: Of<'number'>;
  disabled: boolean;
  label: string;
  onChange: (condition: Of<'number'>) => void;
}) {
  if (condition.op === 'range') {
    return (
      <div className="flex flex-wrap items-start gap-2">
        <NumberBox
          label={`${label}: minimum`}
          value={condition.min}
          disabled={disabled}
          onChange={(min) => onChange({ ...condition, min })}
        />
        <span className="pt-1.5 text-sm">and</span>
        <NumberBox
          label={`${label}: maximum`}
          value={condition.max}
          disabled={disabled}
          onChange={(max) => onChange({ ...condition, max })}
        />
      </div>
    );
  }
  return (
    <NumberBox
      label={`${label}: ${condition.op === 'min' ? 'minimum' : 'maximum'}`}
      value={condition.value}
      disabled={disabled}
      onChange={(value) => onChange({ ...condition, value })}
    />
  );
}

/** Today as ISO `YYYY-MM-DD` in local time (never through UTC, which can shift the day). */
function todayIso(): string {
  const now = new Date();
  return [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function DateConditionEditor({
  condition,
  disabled,
  label,
  onChange,
}: {
  condition: Of<'date'>;
  disabled: boolean;
  label: string;
  onChange: (condition: Of<'date'>) => void;
}) {
  const { when } = condition;
  const days = when.kind === 'relative' ? when.days : 0;
  const direction = days < 0 ? 'before' : 'after';
  const directionItems = [
    { value: 'after', label: 'days after the day of applying' },
    { value: 'before', label: 'days before the day of applying' },
  ];

  return (
    <div className="flex flex-col items-start gap-2">
      <ToggleGroup
        aria-label={`${label}: compare with`}
        variant="outline"
        spacing={0}
        value={[when.kind]}
        disabled={disabled}
        onValueChange={(value) => {
          const next = value[0];
          if (next === 'fixed' && when.kind !== 'fixed') {
            onChange({ ...condition, when: { kind: 'fixed', date: todayIso() } });
          } else if (next === 'relative' && when.kind !== 'relative') {
            onChange({ ...condition, when: { kind: 'relative', days: 0 } });
          }
        }}
      >
        <ToggleGroupItem value="fixed">A fixed date</ToggleGroupItem>
        <ToggleGroupItem value="relative">Relative to applying</ToggleGroupItem>
      </ToggleGroup>

      {when.kind === 'fixed' ? (
        <DatePicker
          label={`${label}: date`}
          value={when.date}
          disabled={disabled}
          onChange={(date) => {
            // Choosing the selected day again clears it; a rule needs a date, so keep the old one.
            if (date) onChange({ ...condition, when: { kind: 'fixed', date } });
          }}
        />
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <NumberBox
            label={`${label}: number of days`}
            value={Math.abs(days)}
            disabled={disabled}
            onChange={(n) => {
              // Whole days only; the API refuses a fraction, so round here rather than show its error.
              const whole = Math.min(MAX_RELATIVE_DAYS, Math.round(Math.abs(n)));
              onChange({ ...condition, when: { kind: 'relative', days: direction === 'before' ? -whole : whole } });
            }}
          />
          <Select
            items={directionItems}
            value={direction}
            disabled={disabled}
            onValueChange={(next) => {
              if (next) {
                const whole = Math.abs(days);
                onChange({ ...condition, when: { kind: 'relative', days: next === 'before' ? -whole : whole } });
              }
            }}
          >
            <SelectTrigger aria-label={`${label}: before or after applying`} className="w-auto min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {directionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * The word list: type a word, press Enter or Add, remove with the x. The caps are enforced here
 * (the input stops at `SCREENING_WORD_MAX_LENGTH`, Add stops at `SCREENING_WORDS_LIMIT`) and the API
 * checks them again.
 */
export function WordsConditionEditor({
  condition,
  disabled,
  label,
  onChange,
}: {
  condition: Of<'short_text'> | Of<'long_text'>;
  disabled: boolean;
  label: string;
  onChange: (condition: Of<'short_text'> | Of<'long_text'>) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const { words } = condition;
  const full = words.length >= SCREENING_WORDS_LIMIT;
  const word = normaliseScreeningWord(draft);
  const duplicate = isDuplicateScreeningWord(words, word);
  const canAdd = word !== '' && !full && !duplicate;

  function add() {
    if (!canAdd) return;
    onChange({ ...condition, words: [...words, word] });
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the word instead of submitting any surrounding form.
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {words.length > 0 && (
        <ul aria-label={`${label}: words`} className="flex flex-wrap gap-1.5">
          {words.map((existing, i) => (
            <li
              key={existing}
              className="flex max-w-full items-center gap-1 rounded-full border bg-muted py-0.5 pr-0.5 pl-3 text-sm"
            >
              <span className="min-w-0 wrap-break-words">{existing}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${existing}`}
                disabled={disabled}
                onClick={() => onChange({ ...condition, words: words.filter((_, j) => j !== i) })}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${id}-word`} className="sr-only">
          {label}: add a word or phrase
        </Label>
        <Input
          id={`${id}-word`}
          className="w-full sm:max-w-xs"
          placeholder={full ? 'Word limit reached' : 'Add a word or phrase'}
          maxLength={SCREENING_WORD_MAX_LENGTH}
          disabled={disabled || full}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={`${id}-note`}
        />
        <Button variant="outline" disabled={disabled || !canAdd} onClick={add}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      <p id={`${id}-note`} className="text-sm text-muted-foreground">
        Matches whole words, ignoring upper and lower case: &quot;sql&quot; matches &quot;SQL&quot; but not
        &quot;mysql&quot;. {words.length} of {SCREENING_WORDS_LIMIT} words, up to {SCREENING_WORD_MAX_LENGTH} characters
        each.
        {duplicate && ' That word is already in the list.'}
      </p>
    </div>
  );
}
