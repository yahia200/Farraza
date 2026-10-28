'use client';

import { CircleDotIcon, ListIcon, LockIcon, PencilIcon, type LucideIcon } from 'lucide-react';
import { useTable } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { JobStatus } from '@/lib/dal';
import { jobColumns } from './columns';
import { jobsTableFeatures, type JobRow, type JobsTableMeta } from './data-table-features';
import { JOB_STATUS_LABELS } from './job-status-badge';

const FILTERS: readonly (JobStatus | 'all')[] = ['all', 'open', 'draft', 'closed'];

/** Icons beside the labels, like the theme and CV selectors. */
const FILTER_ICONS: Record<JobStatus | 'all', LucideIcon> = {
  all: ListIcon,
  open: CircleDotIcon,
  draft: PencilIcon,
  closed: LockIcon,
};

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
        spacing={0}
        value={[active]}
        onValueChange={(value) => {
          const next = value[0] as JobStatus | 'all' | undefined;
          statusColumn?.setFilterValue(next && next !== 'all' ? next : undefined);
        }}
      >
        {FILTERS.map((filter) => {
          const Icon = FILTER_ICONS[filter];
          return (
            <ToggleGroupItem key={filter} value={filter} className="gap-2">
              <Icon />
              {filter === 'all' ? 'All' : JOB_STATUS_LABELS[filter]}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <DataTable
        table={table}
        emptyMessage={active === 'all' ? 'No jobs yet.' : `No ${JOB_STATUS_LABELS[active].toLowerCase()} jobs.`}
      />
    </div>
  );
}
