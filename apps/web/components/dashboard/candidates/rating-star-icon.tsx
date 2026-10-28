import { StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The filled star every candidate rating shows (average, per-member overall, criteria button). */
export function RatingStarIcon({ className }: { className?: string }) {
  return <StarIcon aria-hidden="true" className={cn('size-3.5 fill-current text-brand-accent', className)} />;
}
