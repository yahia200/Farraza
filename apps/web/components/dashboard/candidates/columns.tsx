'use client';

import Link from 'next/link';
import { compareHighlightSort, highlightSortValue, type HighlightSortValue } from '@repo/shared';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTableSortButton } from '@/components/data-table/data-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { HighlightedQuestion } from '@/lib/dal';
import { AverageRatingLabel } from './average-rating-label';
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

const ratingColumn = columnHelper.accessor(
  // `undefined`, not `null`, for "no ratings": `sortUndefined` only looks for `undefined`
  // (table-core 9.2.8, createSortedRowModel.js), so these rows stay last in both directions.
  (row) => row.rating.average ?? undefined,
  {
    id: 'rating',
    header: ({ column }) => <DataTableSortButton column={column}>Rating</DataTableSortButton>,
    sortFn: 'basic',
    sortUndefined: 'last',
    enableColumnFilter: false,
    cell: ({ row }) => <AverageRatingLabel rating={row.original.rating} />,
    meta: { className: 'w-px whitespace-nowrap' },
  },
);

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
 * One column for a Highlighted question: the Question's latest text as the
 * header (cut to one line, the full text in a tooltip and in the DOM), and each
 * Application's answer cut to one line, "—" when there is none. The full answer
 * is in the sheet. Sortable, not filterable. The cell shows the raw answer
 * through `formatHighlight`; the sort reads `highlightSortValue`, which is
 * `undefined` for no answer or an answer of another kind than the column holds
 * (the Question's type changed between form versions), so those rows stay last
 * in both directions, like the Rating column.
 */
function highlightColumn({ key, label, kind }: HighlightedQuestion) {
  return columnHelper.accessor((row) => highlightSortValue(row.highlights[key] ?? null, kind), {
    // Question keys are UUIDs, so this can't clash with the built-in ids.
    id: `highlight-${key}`,
    enableColumnFilter: false,
    sortUndefined: 'last',
    sortFn: (rowA, rowB, columnId) =>
      compareHighlightSort(rowA.getValue<HighlightSortValue>(columnId), rowB.getValue<HighlightSortValue>(columnId)),
    header: ({ column }) => (
      <DataTableSortButton column={column}>
        <Tooltip>
          {/*
            A span, not Base UI's default <button>: the sort button around it is the
            button, and a button can't contain one. The tooltip opens on hover only
            (a span in a button takes no focus of its own); keyboard and screen
            reader users get the full text from the span, which is only visually
            cut. Base UI disables tooltips on touch.
          */}
          <TooltipTrigger render={<span />} className={`block ${HIGHLIGHT_WIDTH} truncate`}>
            {label}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </DataTableSortButton>
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
 * order, as the API sends them), then Rating, Stage, Applied and the Contact actions. The set
 * varies per Job, so it is built from `highlightedQuestions`; the caller
 * memoizes it, because TanStack Table expects `columns` to stay the same
 * array between renders (table-core 9.2.8 `skills/core/SKILL.md`, "Essential
 * constraints").
 */
export function candidateColumns(highlightedQuestions: HighlightedQuestion[]) {
  return columnHelper.columns([
    candidateColumn,
    ...highlightedQuestions.map(highlightColumn),
    ratingColumn,
    stageColumn,
    appliedColumn,
    contactColumn,
  ]);
}
