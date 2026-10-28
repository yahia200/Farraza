import { RATING_CRITERIA, RATING_MAX, type RatingSummary } from '@repo/shared';
import { StarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RatingView } from '@/lib/dal';
import { formatDate } from '@/lib/format';
import { AverageRatingLabel, formatAverageRating } from './average-rating-label';
import { RatingControl } from './rating-control';

/**
 * The sheet's "Ratings" section: the viewer's own Rating to give or change (`RatingControl`), the
 * Average rating, the average per Criterion, and every Member's Rating with their name and the
 * date. A Server Component; only the control is a client component.
 *
 * `jobCriteria` is the Job's Criteria now (the detail payload doesn't carry them). A Criterion in
 * a Rating or in the summary that the Job no longer uses is still shown, marked "no longer used",
 * and is not offered for a new score. A Rating whose author has left has `userId === null`: it is
 * never the viewer's own.
 */
export function CandidateRatings({
  companySlug,
  jobSlug,
  applicationId,
  currentUserId,
  jobCriteria,
  ratings,
  summary,
}: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  currentUserId: string;
  jobCriteria: readonly string[];
  ratings: RatingView[];
  summary: RatingSummary;
}) {
  const current = RATING_CRITERIA.filter((criterion) => jobCriteria.includes(criterion.key));
  const mine = ratings.find((rating) => rating.userId !== null && rating.userId === currentUserId) ?? null;
  // Per-Criterion averages: the Job's Criteria, then dropped ones that still have scores.
  const averages = RATING_CRITERIA.flatMap((criterion) => {
    const average = summary.criteria[criterion.key];
    const used = jobCriteria.includes(criterion.key);
    return used || average ? [{ ...criterion, average, used }] : [];
  });

  return (
    <section aria-labelledby="candidate-ratings" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 id="candidate-ratings" className="text-sm font-medium">
          Ratings
        </h3>
        {summary.average !== null && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            Average
            <AverageRatingLabel
              rating={{ average: summary.average, count: summary.count }}
              className="text-foreground"
            />
          </span>
        )}
      </div>

      <RatingControl
        companySlug={companySlug}
        jobSlug={jobSlug}
        applicationId={applicationId}
        criteria={current.map(({ key, label }) => ({ key, label }))}
        saved={mine && { overall: mine.overall, criteria: mine.criteria }}
      />

      {ratings.length === 0 ? (
        <p className="text-muted-foreground italic">No ratings yet.</p>
      ) : (
        <>
          {summary.count > 0 && averages.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-muted-foreground">Average by criterion</h4>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                {averages.map(({ key, label, average, used }) => (
                  <div key={key} className="col-span-2 grid grid-cols-subgrid items-center">
                    <dt className="flex min-w-0 flex-wrap items-center gap-x-2">
                      <span className="break-words">{label}</span>
                      {!used && <Badge variant="outline">no longer used</Badge>}
                    </dt>
                    <dd className="text-right whitespace-nowrap">
                      {average ? (
                        <>
                          <span aria-hidden="true">
                            {formatAverageRating(average.average)}{' '}
                            <span className="text-muted-foreground">({average.count})</span>
                          </span>
                          <span className="sr-only">
                            Average {formatAverageRating(average.average)} from {average.count}{' '}
                            {average.count === 1 ? 'rating' : 'ratings'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-muted-foreground">
                            —
                          </span>
                          <span className="sr-only">Not scored yet</span>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {ratings.map((rating) => (
              <RatingRow
                // userId is null for a Member who has left, and there can be several of those.
                key={rating.userId ?? `${rating.name}-${rating.updatedAt}`}
                rating={rating}
                isMine={rating === mine}
                jobCriteria={jobCriteria}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RatingRow({
  rating,
  isMine,
  jobCriteria,
}: {
  rating: RatingView;
  isMine: boolean;
  jobCriteria: readonly string[];
}) {
  const scored = RATING_CRITERIA.flatMap((criterion) => {
    const score = rating.criteria[criterion.key];
    return score === undefined ? [] : [{ ...criterion, score, used: jobCriteria.includes(criterion.key) }];
  });

  return (
    <li className="flex flex-col gap-1.5 rounded-2xl bg-muted/50 p-3">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium break-words">{rating.name}</span>
        {isMine && <span className="text-xs text-muted-foreground">(you)</span>}
        <span className="text-xs text-muted-foreground">{formatDate(rating.updatedAt)}</span>
      </p>
      <p className="flex items-center gap-1">
        <StarIcon aria-hidden="true" className="size-3.5 fill-current text-amber-500" />
        <span aria-hidden="true">
          {rating.overall} <span className="text-muted-foreground">overall</span>
        </span>
        <span className="sr-only">Overall rating {rating.overall} out of {RATING_MAX}</span>
      </p>
      {scored.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {scored.map(({ key, label, score, used }) => (
            <div key={key} className="flex flex-wrap items-center gap-x-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">
                {score}
                <span className="sr-only"> out of {RATING_MAX}</span>
              </dd>
              {!used && <Badge variant="outline">no longer used</Badge>}
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
