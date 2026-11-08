import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';
import type { DataTableColumnMeta } from '@/components/data-table/data-table';
import type { ApplicationSummary } from '@/lib/dal';

/** One table row: an application plus its date already formatted on the server. */
export interface CandidateRow extends ApplicationSummary {
  appliedLabel: string;
}

export interface CandidatesTableMeta {
  /** The candidates page; a row links to it with ?application=<id> to open the sheet. */
  basePath: string;
}

/**
 * TanStack Table v9 setup for a job's candidates: sorting, plus column
 * filtering for the stage filter. Same pattern as the jobs list
 * (components/dashboard/jobs/data-table-features.ts). Column visibility is
 * here for one reason: the hidden `matchScore` column that "Sort by score"
 * sorts by (see columns.tsx), whose number must never be displayed.
 */
export const candidatesTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  // `basic` compares numbers: stages sort by their pipeline position.
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  filterFns: { equals: filterFn_equals },
  tableMeta: {} as CandidatesTableMeta,
  columnMeta: {} as DataTableColumnMeta,
});

export type CandidatesTableFeatures = typeof candidatesTableFeatures;
