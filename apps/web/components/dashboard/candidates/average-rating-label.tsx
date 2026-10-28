import type { CardRating } from '@/lib/dal';
import { cn } from '@/lib/utils';
import { RatingStarIcon } from './rating-star-icon';

/**
 * An Average rating to one decimal. `toFixed` rather than `Intl.NumberFormat`: it never
 * depends on the locale, so the server render and the browser agree.
 */
export function formatAverageRating(average: number): string {
  return average.toFixed(1);
}

/**
 * An Application's Average rating and how many Members gave one, as the table and the board card
 * show it: a star, "4.2 (3)". With no Ratings it reads "No ratings" (the card does not render it
 * then; see CandidateCard). The visible text is hidden from screen readers in favor of a spelled-out
 * sentence, because "4.2 (3)" alone does not say what the numbers are.
 */
export function AverageRatingLabel({ rating, className }: { rating: CardRating; className?: string }) {
  if (rating.average === null) {
    return <span className={cn('text-muted-foreground', className)}>No ratings</span>;
  }
  const average = formatAverageRating(rating.average);
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}>
      <RatingStarIcon />
      <span aria-hidden="true">
        {average} <span className="text-muted-foreground">({rating.count})</span>
      </span>
      <span className="sr-only">
        Average rating {average} from {rating.count} {rating.count === 1 ? 'rating' : 'ratings'}
      </span>
    </span>
  );
}
