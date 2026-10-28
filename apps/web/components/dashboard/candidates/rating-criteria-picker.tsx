'use client';

import { RATING_CRITERIA, RATING_CRITERIA_LIMIT } from '@repo/shared';
import { startTransition, useId, useOptimistic, useState } from 'react';
import { saveRatingCriteria, type SaveRatingCriteriaResult } from '@/app/actions/jobs';
import { Button } from '@/components/ui/button';
import { RatingStarIcon } from './rating-star-icon';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';

/**
 * Lets a person who can manage jobs choose the Job's rating Criteria: a ghost
 * icon button beside the Table/Board toggle (next to the Highlighted questions
 * picker) opens a popover with one checkbox per catalog Criterion
 * (`RATING_CRITERIA` from `@repo/shared`, in catalog order), up to
 * `RATING_CRITERIA_LIMIT`. Unlike the Highlighted questions there is no form
 * to read: the catalog is fixed, so the button always shows.
 *
 * It works like `HighlightedQuestionsPicker`: every tick sends the whole new
 * list to the `saveRatingCriteria` action; `useOptimistic` shows the tick
 * while the action runs, and when the transition ends the boxes show
 * `savedKeys` again (refreshed by the action's revalidation after a success,
 * unchanged after a failure, so a failed save unticks itself and a toast says
 * why). Next.js sends Server Actions one at a time per client, so quick ticks
 * reach the API in order.
 *
 * `savedKeys` is shown as stored; a key outside the catalog (it cannot be
 * saved today) is not ticked, doesn't count and is left out by the next save.
 */
export function RatingCriteriaPicker({
  companySlug,
  jobSlug,
  savedKeys,
}: {
  companySlug: string;
  jobSlug: string;
  savedKeys: string[];
}) {
  const saved = RATING_CRITERIA.filter((criterion) => savedKeys.includes(criterion.key)).map(
    (criterion) => criterion.key as string,
  );
  const [keys, setKeys] = useOptimistic(saved);
  const [announcement, setAnnouncement] = useState('');
  const limitId = useId();
  const atLimit = keys.length >= RATING_CRITERIA_LIMIT;

  function toggle(key: string, checked: boolean) {
    const chosen = new Set(keys);
    if (checked) {
      if (atLimit) return;
      chosen.add(key);
    } else {
      chosen.delete(key);
    }
    // Catalog order, so the stored list doesn't depend on the order of the ticks.
    const next = RATING_CRITERIA.filter((criterion) => chosen.has(criterion.key)).map((criterion) => criterion.key);
    const label = RATING_CRITERIA.find((criterion) => criterion.key === key)?.label ?? 'the criterion';

    startTransition(async () => {
      setKeys(next);
      let result: SaveRatingCriteriaResult;
      try {
        result = await saveRatingCriteria(companySlug, jobSlug, next);
      } catch {
        // The request itself failed (offline, server down). The box goes back when the transition ends.
        result = { formError: 'Check your connection and try again.' };
      }
      if (result.keys) {
        setAnnouncement(checked ? `Rating on “${label}”.` : `Stopped rating on “${label}”.`);
      } else {
        setAnnouncement('');
        toast.add({
          type: 'error',
          title: "Couldn't change the rating criteria",
          description: result.formError,
        });
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Choose rating criteria" />}
        className="text-muted-foreground"
      >
        <RatingStarIcon className="size-4 fill-none text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Rating criteria</PopoverTitle>
          <PopoverDescription>
            Members can score each criterion you choose from 1 to 5, as well as giving an overall rating. Everyone
            rating this job sees the same criteria.
          </PopoverDescription>
        </PopoverHeader>
        <fieldset aria-describedby={limitId} className="-mx-1 flex min-w-0 flex-col gap-1 px-1">
          <legend className="sr-only">Criteria</legend>
          {RATING_CRITERIA.map((criterion) => {
            const checked = keys.includes(criterion.key);
            return (
              // The Checkbox is a span, so the Label's `peer-disabled` never matches; dim the row from its data-disabled.
              <Label
                key={criterion.key}
                className="min-h-11 shrink-0 py-1 leading-snug font-normal has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 sm:min-h-8"
              >
                <Checkbox
                  checked={checked}
                  disabled={!checked && atLimit}
                  onCheckedChange={(next) => toggle(criterion.key, next)}
                />
                <span className="min-w-0 wrap-break-words">{criterion.label}</span>
              </Label>
            );
          })}
        </fieldset>
        <p id={limitId} className="text-muted-foreground">
          {atLimit
            ? `You can choose up to ${RATING_CRITERIA_LIMIT} criteria. Untick one to choose another.`
            : `Choose up to ${RATING_CRITERIA_LIMIT}.`}
        </p>
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </PopoverContent>
    </Popover>
  );
}
