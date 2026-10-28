'use client';

import Link from 'next/link';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTableSortButton } from '@/components/data-table/data-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { HighlightedQuestion } from '@/lib/dal';
import { ApplicationStatusBadge } from './application-status-badge';
import { ContactActions } from './contact-actions';
import type { CandidateRow, CandidatesTableFeatures } from './data-table-features';
import { HighlightAnswer } from './highlight-answer';

const columnHelper = createColumnHelper<CandidatesTableFeatures, CandidateRow>();

const candidateColumn = columnHelper.accessor((row) => row.candidate.name, {
  id: 'candidate',
  header: ({ column }) => <DataTableSortButton column={column}>Candidate</DataTableSortButton>,
  sortFn: 'text',
  cell: ({ row, table }) => (
    <div className="flex min-w-0 flex-col">
      {/* Opens the detail sheet: its state lives in the URL (?application=<id>). */}
      <Link
        href={`${table.options.meta?.basePath}?application=${row.original.id}`}
        scroll={false}
        className="truncate font-medium underline-offset-4 hover:underline"
      >
        {row.original.candidate.name}
      </Link>
      <span className="truncate text-xs text-muted-foreground">{row.original.candidate.email}</span>
    </div>
  ),
});

const contactColumn = columnHelper.display({
  id: 'contact',
  header: 'Contact',
  cell: ({ row }) => (
    <ContactActions
      name={row.original.candidate.name}
      email={row.original.candidate.email}
      phone={row.original.candidate.phone}
    />
  ),
  meta: { className: 'w-px' },
});

const stageColumn =columnHelper.accessor((row) => row.stage.position, {
  id: 'stage',
  header: ({ column }) => <DataTableSortButton column={column}>Stage</DataTableSortButton>,
  // Sorted and filtered by pipeline position, shown by name.
  sortFn: 'basic',
  filterFn: 'equals',
  cell: ({ row }) => row.original.stage.name,
  meta: { className: 'w-px whitespace-nowrap' },
});

const statusColumn = columnHelper.accessor('status', {
  header: 'Status',
  enableSorting: false,
  cell: ({ row }) => <ApplicationStatusBadge status={row.original.status} />,
  meta: { className: 'w-px whitespace-nowrap' },
});

const appliedColumn = columnHelper.accessor('submittedAt', {
  header: ({ column }) => <DataTableSortButton column={column}>Applied</DataTableSortButton>,
  // ISO dates sort correctly as text.
  sortFn: 'text',
  cell: ({ row }) => <span className="text-muted-foreground">{row.original.appliedLabel}</span>,
  meta: { className: 'w-px whitespace-nowrap' },
});

/** How wide a Highlighted question's header and answers may get before they are cut with "…". */
const HIGHLIGHT_WIDTH = 'max-w-48';

/**
 * One display-only column for a Highlighted question: the Question's latest
 * text as the header (cut to one line, the full text in a tooltip and in the
 * DOM), and each Application's answer cut to one line, "—" when there is none.
 * The full answer is in the sheet. Not sortable and not filterable (spec, Out
 * of Scope).
 */
function highlightColumn({ key, label }: HighlightedQuestion) {
  return columnHelper.accessor((row) => row.highlights[key] ?? null, {
    // Question keys are UUIDs, so this can't clash with the built-in ids.
    id: `highlight-${key}`,
    enableSorting: false,
    enableColumnFilter: false,
    header: () => (
      <Tooltip>
        {/*
          A span, not Base UI's default <button>: the header does nothing when
          pressed. tabIndex={0} lets keyboard users focus it, which opens the
          tooltip (Base UI opens it on focus as well as hover), so a cut-off
          Question can be read in full. Base UI disables tooltips on touch;
          screen readers read the full text from the span.
        */}
        <TooltipTrigger
          render={<span tabIndex={0} />}
          className={`block ${HIGHLIGHT_WIDTH} truncate rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30`}
        >
          {label}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    ),
    cell: ({ row }) => (
      <HighlightAnswer
        answer={row.original.highlights[key] ?? null}
        className={`block ${HIGHLIGHT_WIDTH} truncate`}
      />
    ),
  });
}

/**
 * The table's columns: Candidate, then one per Highlighted question (in form
 * order, as the API sends them), then Stage, Status, Applied and the Contact actions. The set
 * varies per Job, so it is built from `highlightedQuestions`; the caller
 * memoizes it, because TanStack Table expects `columns` to stay the same
 * array between renders (table-core 9.2.8 `skills/core/SKILL.md`, "Essential
 * constraints").
 */
export function candidateColumns(highlightedQuestions: HighlightedQuestion[]) {
  return columnHelper.columns([
    candidateColumn,
    ...highlightedQuestions.map(highlightColumn),
    stageColumn,
    statusColumn,
    appliedColumn,
    contactColumn,
  ]);
}
