'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { compareRoles } from '@repo/shared';
import { DataTableSortButton } from '@/components/data-table/data-table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { initials } from '../initials';
import type { MemberRow, MembersTableFeatures } from './data-table-features';
import { MemberActions } from './member-actions';
import { ROLE_LABELS } from './role-labels';

/** v9 column helper: typed by the registered features and the row type. */
const columnHelper = createColumnHelper<MembersTableFeatures, MemberRow>();

export const memberColumns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: ({ column }) => <DataTableSortButton column={column}>Member</DataTableSortButton>,
    sortFn: 'text',
    cell: ({ row, table }) => {
      const member = row.original;
      const isYou = member.userId === table.options.meta?.currentUserId;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="grid leading-tight">
            <span className="font-medium">
              {member.name}
              {isYou && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <span className="text-xs text-muted-foreground">{member.email}</span>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor('role', {
    header: ({ column }) => <DataTableSortButton column={column}>Role</DataTableSortButton>,
    // A custom sort: by rank (owners first), using the same rules as the API.
    sortFn: (rowA, rowB) => compareRoles(rowA.original.role, rowB.original.role),
    cell: ({ row }) => (
      <Badge variant={row.original.role === 'owner' ? 'default' : 'secondary'}>
        {ROLE_LABELS[row.original.role]}
      </Badge>
    ),
  }),
  columnHelper.accessor('joinedAt', {
    header: ({ column }) => <DataTableSortButton column={column}>Joined</DataTableSortButton>,
    // ISO dates sort correctly as text.
    sortFn: 'text',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.joinedLabel}</span>,
  }),
  columnHelper.display({
    id: 'actions',
    // Shrink to the ⋯ button: in an auto-layout table, w-px makes the column as narrow as its content.
    meta: { className: 'w-px whitespace-nowrap' },
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) =>
      table.options.meta ? <MemberActions member={row.original} meta={table.options.meta} /> : null,
  }),
]);
