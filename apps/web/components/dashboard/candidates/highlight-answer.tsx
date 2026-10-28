import { cn } from '@/lib/utils';

/**
 * An Application's answer to a Highlighted question, as the table and the
 * board card show it. The text is display-ready from the API (formatted and
 * cut at 200 characters); `className` clamps it to the room it has. No answer
 * shows "—", read out as "No answer" (the sheet's wording).
 */
export function HighlightAnswer({ answer, className }: { answer: string | null; className?: string }) {
  if (answer === null) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No answer</span>
      </span>
    );
  }
  return <span className={className}>{answer}</span>;
}
