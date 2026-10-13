import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';
import type { DataTableColumnMeta } from '@/components/data-table/data-table';
import type { CompanyJob } from '@/lib/dal';

/** One table row: a job plus its creation date already formatted on the server. */
export interface JobRow extends CompanyJob {
  createdLabel: string;
}

export interface JobsTableMeta {
  companySlug: string;
}

/**
 * TanStack Table v9 setup for the jobs list: sorting, plus column filtering
 * for the status filter (https://ui.shadcn.com/docs/components/base/data-table, "Filtering").
 */
export const jobsTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { text: sortFn_text },
  filterFns: { equalsString: filterFn_equalsString },
  tableMeta: {} as JobsTableMeta,
  columnMeta: {} as DataTableColumnMeta,
});

export type JobsTableFeatures = typeof jobsTableFeatures;
