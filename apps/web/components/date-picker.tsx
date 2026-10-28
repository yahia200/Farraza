'use client';

import { CalendarIcon } from 'lucide-react';
import { useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatIsoDate } from '@repo/shared';
import { cn } from '@/lib/utils';

/** `YYYY-MM-DD` as a local-time Date (what the calendar works in), or undefined if it isn't one. */
function isoToDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // `new Date(2026, 1, 30)` rolls over to March; a real date comes back unchanged.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

/** The calendar day the Date shows locally, as `YYYY-MM-DD` (never through UTC, which can shift the day). */
function dateToIso(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A calendar day, chosen from a popover calendar: the shadcn Date Picker, which is a `Popover`
 * around a `Calendar` with no root component of its own
 * (https://ui.shadcn.com/docs/components/base/date-picker, the "Date of Birth" example, so the
 * month and year are dropdowns and a far-off year is two clicks away).
 *
 * The value is the same text the API stores, ISO `YYYY-MM-DD`, or `''` for no date, so it drops
 * into forms that already hold dates as text. `min` and `max` (also ISO) grey out the days outside
 * them and bound the year dropdown. Choosing the selected day again clears it.
 *
 * `label` is the question's name: the button reads "<label>: March 5, 2026" to a screen reader,
 * because a labelled button would otherwise hide the chosen date behind the label. Key presses
 * inside it (the button and the calendar, which is portalled but still a React child) stop here:
 * a parent such as the questionnaire uses Enter, arrows and letters for its own shortcuts.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  disabled,
  invalid,
  describedBy,
  className,
  ref,
}: {
  id?: string;
  label: string;
  /** ISO `YYYY-MM-DD`, or `''`. */
  value: string;
  /** The chosen day as ISO, or `''` when cleared. */
  onChange: (value: string) => void;
  /** Earliest allowed day, ISO. */
  min?: string;
  /** Latest allowed day, ISO. */
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /** The button, so a form library can focus it. */
  ref?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);
  const earliest = min ? isoToDate(min) : undefined;
  const latest = max ? isoToDate(max) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        disabled={disabled}
        render={
          <Button
            id={id}
            variant="outline"
            data-empty={!selected}
            aria-label={`${label}: ${selected ? formatIsoDate(value) : 'no date chosen'}`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(
              'w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground sm:w-60',
              className,
            )}
            onKeyDown={(event) => event.stopPropagation()}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {selected ? formatIsoDate(value) : <span>{placeholder}</span>}
      </PopoverTrigger>
      {/* Escape is left alone so the popover still closes with it. */}
      <PopoverContent
        className="w-auto overflow-hidden p-0"
        align="start"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') event.stopPropagation();
        }}
      >
        <DatePickerCalendar
          selected={selected}
          earliest={earliest}
          latest={latest}
          onSelect={(date) => {
            onChange(date ? dateToIso(date) : '');
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The calendar itself. It is its own component, mounted only while the popover is open, because
 * the default year range reads today's date and Next.js refuses that during a prerender
 * (https://nextjs.org/docs/messages/blocking-prerender-current-time-client): nothing here renders until a click.
 */
function DatePickerCalendar({
  selected,
  earliest,
  latest,
  onSelect,
}: {
  selected: Date | undefined;
  earliest: Date | undefined;
  latest: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}) {
  const year = new Date().getFullYear();
  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={selected}
      defaultMonth={selected}
      // Month and year are dropdowns. Without limits the years run from 100 back to ten ahead (a
      // graduation can be in the future); with them they stop at the limit.
      startMonth={earliest ?? new Date(year - 100, 0)}
      endMonth={latest ?? new Date(year + 10, 11)}
      disabled={[...(earliest ? [{ before: earliest }] : []), ...(latest ? [{ after: latest }] : [])]}
      onSelect={onSelect}
    />
  );
}
