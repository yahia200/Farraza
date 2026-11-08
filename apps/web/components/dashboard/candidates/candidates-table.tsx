'use client';

import { useId, useMemo } from 'react';
import { matchSortAvailability } from '@repo/shared';
import { useTable } from '@tanstack/react-table';
import { ArrowDownWideNarrowIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { Toggle } from '@/components/ui/toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HighlightedQuestion, JobStage } from '@/lib/dal';
import { candidateColumns, MATCH_SCORE_COLUMN_ID } from './columns';
import { candidatesTableFeatures, type CandidateRow, type CandidatesTableMeta } from './data-table-features';

/** The table's default order, and what a tie under "Sort by score" falls back to: newest first. */
const DEFAULT_SORTING = [{ id: 'submittedAt', desc: true }];

/**
 * A job's candidates: a stage filter and a "Sort by score" toggle above the shared <DataTable>. A
 * Select rather than the jobs list's ToggleGroup: six stages plus "All" would wrap.
 * The Job's Highlighted questions add a column each, after Candidate.
 *
 * "Sort by score" (embedding-match ticket 10) sorts the rows the page already holds, through a
 * hidden column (columns.tsx). The board never uses it. NOTE for candidate-list pagination
 * (`docs/feature-backlog.md`): once the list is paged, a client-side sort only orders one page, so
 * this moves to the server as an ORDER BY on the stored score (highest first, unscored last, ties in
 * the default order), and `matchSortAvailability` has to be answered by the API, which knows about
 * the unloaded pages.
 */
export function CandidatesTable({
  data,
  stages,
  highlightedQuestions,
  requirementCount,
  meta,
}: {
  data: CandidateRow[];
  stages: JobStage[];
  highlightedQuestions: HighlightedQuestion[];
  /** How many Requirements the Job has; without any, nothing is scored and the sort is off. */
  requirementCount: number;
  meta: CandidatesTableMeta;
}) {
  // Rebuilt only when the Highlighted questions change: TanStack Table expects
  // the same `columns` array between renders (table-core skills/core/SKILL.md).
  const columns = useMemo(() => candidateColumns(highlightedQuestions), [highlightedQuestions]);
  const table = useTable({
    features: candidatesTableFeatures,
    columns,
    data,
    meta,
    initialState: {
      sorting: DEFAULT_SORTING,
      // The score is a sort key only, never shown (spec story 5).
      columnVisibility: { [MATCH_SCORE_COLUMN_ID]: false },
    },
  });

  // On while the score is the first sort key. Clicking another header replaces it, so the toggle
  // lets go by itself; it also reads off while unavailable, whatever the sorting state holds.
  const availability = matchSortAvailability(requirementCount, data);
  const reasonId = useId();
  const sortByScore = availability.enabled && table.state.sorting[0]?.id === MATCH_SCORE_COLUMN_ID;

  const stageColumn = table.getColumn('stage');
  const position = stageColumn?.getFilterValue() as number | undefined;
  const selected = position === undefined ? 'all' : String(position);

  // Base UI's Select shows an item's label only when it knows the items (`items`).
  const items = [
    { value: 'all', label: `All stages (${data.length})` },
    ...[...stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        value: String(stage.position),
        label: `${stage.name} (${data.filter((row) => row.stage.position === stage.position).length})`,
      })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Select
          items={items}
          value={selected}
          onValueChange={(value) => stageColumn?.setFilterValue(value && value !== 'all' ? Number(value) : undefined)}
        >
          <SelectTrigger aria-label="Filter by stage" className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} className="">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle
          variant="outline"
          pressed={sortByScore}
          disabled={!availability.enabled}
          aria-describedby={availability.enabled ? undefined : reasonId}
          onPressedChange={(pressed) =>
            // Ties (and unscored rows among themselves) fall through to the newest-first order.
            table.setSorting(
              pressed ? [{ id: MATCH_SCORE_COLUMN_ID, desc: false }, ...DEFAULT_SORTING] : DEFAULT_SORTING,
            )
          }
          className="gap-2"
        >
          <ArrowDownWideNarrowIcon />
          Sort by score
        </Toggle>
        {!availability.enabled && (
          <span id={reasonId} className="text-sm text-muted-foreground">
            {availability.reason}
          </span>
        )}
      </div>
      <DataTable
        table={table}
        emptyMessage={selected === 'all' ? 'No one has applied yet.' : 'No candidates in this stage.'}
      />
    </div>
  );
}
