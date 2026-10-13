'use client';

import { useTable } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { JobStatus } from '@/lib/dal';
import { jobColumns } from './columns';
import { jobsTableFeatures, type JobRow, type JobsTableMeta } from './data-table-features';
import { JOB_STATUS_LABELS } from './job-status-badge';

const FILTERS: readonly (JobStatus | 'all')[] = ['all', 'open', 'draft', 'closed'];

/** The jobs list: a status filter above the shared <DataTable>. */
export function JobsTable({ data, meta }: { data: JobRow[]; meta: JobsTableMeta }) {
  const table = useTable({
    features: jobsTableFeatures,
    columns: jobColumns,
    data,
    meta,
    initialState: { sorting: [{ id: 'createdAt', desc: true }] },
  });

  const statusColumn = table.getColumn('status');
  const active = (statusColumn?.getFilterValue() as JobStatus | undefined) ?? 'all';

  return (
    <div className="flex flex-col gap-3">
      {/*
        Single-choice filter. Base UI's ToggleGroup value is an array even
        without `multiple` (@base-ui/react toggle-group/ToggleGroup.d.ts);
        clearing it (clicking the active item) means "all".
      */}
      <ToggleGroup
        aria-label="Filter by status"
        variant="outline"
        size="sm"
        value={[active]}
        onValueChange={(value) => {
          const next = value[0] as JobStatus | 'all' | undefined;
          statusColumn?.setFilterValue(next && next !== 'all' ? next : undefined);
        }}
      >
        {FILTERS.map((filter) => (
          <ToggleGroupItem key={filter} value={filter}>
            {filter === 'all' ? 'All' : JOB_STATUS_LABELS[filter]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <DataTable
        table={table}
        emptyMessage={active === 'all' ? 'No jobs yet.' : `No ${JOB_STATUS_LABELS[active].toLowerCase()} jobs.`}
      />
    </div>
  );
}
