import { formatHighlight, type Highlight } from '@repo/shared';
import { cn } from '@/lib/utils';

/**
 * An Application's answer to a Highlighted question, as the table and the
 * board card show it. The API sends the raw answer (cut at 200 characters if
 * it is text) and `formatHighlight` turns it into the sheet's wording;
 * `className` clamps it to the room it has. No answer shows "—", read out as
 * "No answer".
 */
export function HighlightAnswer({ answer, className }: { answer: Highlight | null; className?: string }) {
  if (answer === null) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No answer</span>
      </span>
    );
  }
  return <span className={className}>{formatHighlight(answer)}</span>;
}
