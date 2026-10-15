import Link from 'next/link';
import type { PipelineCard } from '@/lib/dal';
import { formatDate } from '@/lib/format';
import { ApplicationStatusBadge } from './application-status-badge';
import { candidatesHref } from './candidates-href';

/**
 * One application on the board. The whole card is a link that opens the
 * detail sheet (?application=<id>), as the table's name link does. Used by
 * both the desktop columns and the mobile stage tabs.
 */
export function CandidateCard({ card, basePath }: { card: PipelineCard; basePath: string }) {
  return (
    <Link
      href={candidatesHref(basePath, { view: 'board', application: card.id })}
      scroll={false}
      className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-sm text-card-foreground shadow-xs transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <span className="truncate font-medium">{card.candidate.name}</span>
      <span className="truncate text-xs text-muted-foreground">{card.candidate.email}</span>
      <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {formatDate(card.submittedAt)}
        {/* Every card in an in-progress stage would carry the same badge: only the outcomes are worth showing. */}
        {card.status !== 'active' && <ApplicationStatusBadge status={card.status} />}
      </span>
    </Link>
  );
}
