'use client';

import { RATING_MAX, RATING_MIN } from '@repo/shared';
import { startTransition, useId, useMemo, useOptimistic, useState } from 'react';
import { saveRating, type SaveRatingResult } from '@/app/actions/applications';
import { toast } from '@/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const SCORES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, index) => RATING_MIN + index);

/** The viewer's own Rating as the sheet shows it. A Criterion with no entry is not scored. */
type OwnRating = { overall: number | null; criteria: Record<string, number> };

/** What one click changes: the overall, or one Criterion (`null` clears it). */
type Change = { overall: number } | { criterion: string; score: number | null };

function apply(state: OwnRating, change: Change): OwnRating {
  if ('overall' in change) {
    return { ...state, overall: change.overall };
  }
  const criteria = { ...state.criteria };
  if (change.score === null) {
    delete criteria[change.criterion];
  } else {
    criteria[change.criterion] = change.score;
  }
  return { ...state, criteria };
}

/**
 * The viewer's own Rating on an Application: the overall as five buttons (1 to 5), then a row of
 * five buttons for each Criterion the Job currently uses. Every click saves at once through the
 * `saveRating` action, and `useOptimistic` shows it while the action runs. When the transition
 * ends the buttons show the server's Rating again (refreshed by the action's revalidation after a
 * success, unchanged after a failure, so a failed save snaps back and a toast says why). Next.js
 * sends Server Actions one at a time per client, so quick clicks reach the API in order.
 *
 * The overall can be changed but not cleared (the API takes no way to remove a Rating), so
 * pressing the chosen number again does nothing. A Criterion can be cleared the same way
 * (pressing the chosen score again). A Criterion can't be scored before the overall is given,
 * because the API requires `overall` on every save and never works it out from the Criteria.
 * Criteria the Job no longer uses are not offered; their old scores stay in the Member's Rating
 * untouched (the API carries them over).
 */
export function RatingControl({
  companySlug,
  jobSlug,
  applicationId,
  criteria,
  saved,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  /** The Criteria the Job uses now, in catalog order. */
  criteria: { key: string; label: string }[];
  /** The viewer's saved Rating, or null if they have not rated yet. */
  saved: { overall: number; criteria: Record<string, number> } | null;
}) {
  const base = useMemo<OwnRating>(
    () => ({ overall: saved?.overall ?? null, criteria: saved?.criteria ?? {} }),
    [saved],
  );
  const [own, setOwn] = useOptimistic(base, apply);
  const [announcement, setAnnouncement] = useState('');
  const overallLabelId = useId();
  const hintId = useId();

  function save(change: Change, saidAs: string) {
    const overall = 'overall' in change ? change.overall : own.overall;
    if (overall === null) {
      return; // the Criteria are disabled until the overall is given; nothing to send
    }
    startTransition(async () => {
      setOwn(change);
      let result: SaveRatingResult;
      try {
        result = await saveRating(companySlug, jobSlug, applicationId, {
          overall,
          ...('criterion' in change && { criteria: { [change.criterion]: change.score } }),
        });
      } catch {
        // The request itself failed (offline, server down). The buttons go back when the transition ends.
        result = { formError: 'Check your connection and try again.' };
      }
      if (result.ok) {
        setAnnouncement(saidAs);
      } else {
        setAnnouncement('');
        toast.add({ type: 'error', title: "Couldn't save your rating", description: result.formError });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-3">
      <p className="font-medium">Your rating</p>
      <ScoreRow
        labelId={overallLabelId}
        label="Overall"
        hiddenLabel=" rating, 1 to 5"
        score={own.overall ?? undefined}
        onChange={(score) => {
          // Pressing the chosen number again gives `null`: the overall can't be cleared.
          if (score !== null) save({ overall: score }, `Overall rating saved: ${score}.`);
        }}
      />
      {criteria.length > 0 && (
        <>
          <p id={hintId} className="border-t pt-3 text-muted-foreground">
            {own.overall === null
              ? 'Give an overall rating first, then score the criteria you can judge.'
              : 'Score the criteria you can judge. Press a chosen score again to clear it.'}
          </p>
          {criteria.map((criterion) => (
            <CriterionRow
              key={criterion.key}
              criterion={criterion}
              score={own.criteria[criterion.key]}
              disabled={own.overall === null}
              describedBy={hintId}
              onChange={(score) =>
                save(
                  { criterion: criterion.key, score },
                  score === null ? `${criterion.label} cleared.` : `${criterion.label} saved: ${score}.`,
                )
              }
            />
          ))}
        </>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function CriterionRow({
  criterion,
  score,
  disabled,
  describedBy,
  onChange,
}: {
  criterion: { key: string; label: string };
  score: number | undefined;
  disabled: boolean;
  describedBy: string;
  onChange: (score: number | null) => void;
}) {
  const labelId = useId();
  return (
    <ScoreRow
      labelId={labelId}
      label={criterion.label}
      hiddenLabel=" score, 1 to 5"
      score={score}
      disabled={disabled}
      describedBy={describedBy}
      onChange={onChange}
    />
  );
}

/**
 * A label and five buttons, 1 to 5. A Base UI ToggleGroup (docs/react/components/toggle-group.md):
 * `value` is an array even when one button is pressed, and pressing the pressed button gives `[]`,
 * which is passed on as `null` ("no score") for the caller to ignore or send. Arrow keys move
 * between the buttons; each is a `<button aria-pressed>`.
 */
function ScoreRow({
  labelId,
  label,
  hiddenLabel,
  score,
  disabled,
  describedBy,
  onChange,
}: {
  labelId: string;
  label: string;
  /** Said by a screen reader after the visible label (the group's name). */
  hiddenLabel: string;
  score: number | undefined;
  disabled?: boolean;
  describedBy?: string;
  onChange: (score: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span id={labelId} className="min-w-0 break-words">
        {label}
        <span className="sr-only">{hiddenLabel}</span>
      </span>
      <ToggleGroup
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        variant="outline"
        size="sm"
        spacing={1}
        disabled={disabled}
        value={score === undefined ? [] : [String(score)]}
        onValueChange={(value) => onChange(value[0] ? Number(value[0]) : null)}
        className="shrink-0"
      >
        {SCORES.map((value) => (
          <ToggleGroupItem
            key={value}
            value={String(value)}
            className="h-9 min-w-9 px-0 sm:h-8 sm:min-w-8 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
