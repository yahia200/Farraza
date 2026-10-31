'use client';

import { FlagIcon } from 'lucide-react';
import { flagMarkerLabel, type ScreeningFlag } from '@repo/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * The marker for an Application a flag Screening rule fired on: a flag icon and the word "Flagged"
 * (not colour alone), named for assistive technology with the count. Hover or keyboard focus opens
 * a tooltip with each reason; touch gets no tooltip (Base UI turns tooltips off there), and the
 * candidate sheet lists every reason. Renders nothing without flags.
 *
 * It is a button of its own, so on the board card it must be a sibling of the card's link, never
 * inside it. A click does nothing (the sheet is opened by the link).
 */
export function FlagMarker({ flags, className }: { flags: ScreeningFlag[]; className?: string }) {
  if (flags.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={flagMarkerLabel(flags.length)}
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded-md border border-amber-600/40 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 dark:border-amber-400/40 dark:bg-amber-950 dark:text-amber-200',
          className,
        )}
      >
        <FlagIcon className="size-3" aria-hidden="true" />
        <span aria-hidden="true">Flagged{flags.length > 1 && ` (${flags.length})`}</span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start">
        {flags.map((flag) => (
          <span key={flag.ruleId}>{flag.reason}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
