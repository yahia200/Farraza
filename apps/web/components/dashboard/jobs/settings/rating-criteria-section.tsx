'use client';

import { RATING_CRITERIA, RATING_CRITERIA_LIMIT } from '@repo/shared';
import { startTransition, useId, useOptimistic, useState } from 'react';
import { saveRatingCriteria, type SaveRatingCriteriaResult } from '@/app/actions/jobs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';

/**
 * The Job's rating Criteria, chosen on the Settings tab: one checkbox per catalog Criterion
 * (`RATING_CRITERIA` from `@repo/shared`, in catalog order), up to `RATING_CRITERIA_LIMIT`. It was a
 * popover on the candidates page (`RatingCriteriaPicker`); the behaviour is the same, only the
 * container changed: the list is always visible instead of opening from an icon button.
 *
 * Every tick sends the whole new list to the `saveRatingCriteria` action; `useOptimistic` shows the
 * tick while the action runs, and when the transition ends the boxes show `savedKeys` again
 * (refreshed by the action's revalidation after a success, unchanged after a failure, so a failed
 * save unticks itself and a toast says why). Next.js sends Server Actions one at a time per client,
 * so quick ticks reach the API in order.
 *
 * `savedKeys` is shown as stored; a key outside the catalog is not ticked, doesn't count and is left
 * out by the next save. Only people who can manage jobs are given this section (the page decides).
 */
export function RatingCriteriaSection({
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
  const headingId = useId();
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
    <section aria-labelledby={headingId} className="flex max-w-3xl flex-col gap-3">
      <div className="space-y-1">
        <h2 id={headingId} className="font-heading text-base font-semibold">
          Rating criteria
        </h2>
        <p className="text-sm text-muted-foreground">
          Members can score each criterion you choose from 1 to 5, as well as giving an overall rating. Everyone
          rating this job sees the same criteria.
        </p>
      </div>
      <fieldset
        aria-describedby={limitId}
        className="grid min-w-0 gap-x-6 gap-y-1 rounded-2xl border bg-card p-3 sm:grid-cols-2"
      >
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
      <p id={limitId} className="text-sm text-muted-foreground">
        {atLimit
          ? `You can choose up to ${RATING_CRITERIA_LIMIT} criteria. Untick one to choose another.`
          : `Choose up to ${RATING_CRITERIA_LIMIT}.`}
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
