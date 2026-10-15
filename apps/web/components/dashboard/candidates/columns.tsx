'use client';

import Link from 'next/link';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTableSortButton } from '@/components/data-table/data-table';
import { ApplicationStatusBadge } from './application-status-badge';
import type { CandidateRow, CandidatesTableFeatures } from './data-table-features';

const columnHelper = createColumnHelper<CandidatesTableFeatures, CandidateRow>();

export const candidateColumns = columnHelper.columns([
  columnHelper.accessor((row) => row.candidate.name, {
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
  }),
  columnHelper.accessor((row) => row.stage.position, {
    id: 'stage',
    header: ({ column }) => <DataTableSortButton column={column}>Stage</DataTableSortButton>,
    // Sorted and filtered by pipeline position, shown by name.
    sortFn: 'basic',
    filterFn: 'equals',
    cell: ({ row }) => row.original.stage.name,
    meta: { className: 'w-px whitespace-nowrap' },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <ApplicationStatusBadge status={row.original.status} />,
    meta: { className: 'w-px whitespace-nowrap' },
  }),
  columnHelper.accessor('submittedAt', {
    header: ({ column }) => <DataTableSortButton column={column}>Applied</DataTableSortButton>,
    // ISO dates sort correctly as text.
    sortFn: 'text',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.appliedLabel}</span>,
    meta: { className: 'w-px whitespace-nowrap' },
  }),
]);
