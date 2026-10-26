'use client';

import Link from 'next/link';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTableSortButton } from '@/components/data-table/data-table';
import type { JobRow, JobsTableFeatures } from './data-table-features';
import { CopyJobLinkButton } from './copy-job-link-button';
import { JobStatusBadge } from './job-status-badge';

const columnHelper = createColumnHelper<JobsTableFeatures, JobRow>();

export const jobColumns = columnHelper.columns([
  columnHelper.accessor('title', {
    header: ({ column }) => <DataTableSortButton column={column}>Job</DataTableSortButton>,
    sortFn: 'text',
    cell: ({ row, table }) => (
      <Link
        href={`/dashboard/${table.options.meta?.companySlug}/jobs/${row.original.slug}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.original.title}
      </Link>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    // Exact match, used by the status filter above the table.
    filterFn: 'equalsString',
    enableSorting: false,
    cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
    meta: { className: 'w-px whitespace-nowrap' },
  }),
  columnHelper.accessor('createdAt', {
    header: ({ column }) => <DataTableSortButton column={column}>Created</DataTableSortButton>,
    // ISO dates sort correctly as text.
    sortFn: 'text',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdLabel}</span>,
    meta: { className: 'w-px whitespace-nowrap' },
  }),
  columnHelper.display({
    id: 'link',
    header: () => <span className="sr-only">Copy link</span>,
    cell: ({ row, table }) => (
      <CopyJobLinkButton
        companySlug={table.options.meta?.companySlug ?? ''}
        jobSlug={row.original.slug}
        status={row.original.status}
        variant="icon"
      />
    ),
    meta: { className: 'w-px' },
  }),
]);
