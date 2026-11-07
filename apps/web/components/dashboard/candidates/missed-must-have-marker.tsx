import { SearchXIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The marker for an Application whose CV text missed a must-have Requirement (keyword match). It is
 * deliberately unlike the Screening-rule `FlagMarker`: a different icon (a magnifier with a cross, not
 * a flag), different words ("Missing must-have", not "Flagged") and a rose rather than an amber
 * colour, so a reviewer can tell a CV miss from an answer flag at a glance. The words carry the
 * meaning, not the colour alone.
 *
 * It is plain text with no control inside, so unlike `FlagMarker` it may sit inside a link (the
 * board card puts it in its own row anyway). The sheet lists which Requirements were missed.
 * Render it only when `missedMustHave` is true; an unreadable or failed CV never has it.
 */
export function MissedMustHaveMarker({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-md border border-rose-600/40 bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-900 dark:border-rose-400/40 dark:bg-rose-950 dark:text-rose-200',
        className,
      )}
    >
      <SearchXIcon className="size-3" aria-hidden="true" />
      Missing must-have
    </span>
  );
}
