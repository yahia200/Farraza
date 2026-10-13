'use client';

import { useTable } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { memberColumns } from './columns';
import { membersTableFeatures, type MemberRow, type MembersTableMeta } from './data-table-features';

/** The members table: its own TanStack Table instance, rendered by the shared <DataTable>. */
export function MembersTable({ data, meta }: { data: MemberRow[]; meta: MembersTableMeta }) {
  const table = useTable({
    features: membersTableFeatures,
    columns: memberColumns,
    data,
    meta,
    // Uncontrolled sorting: the table keeps it in its own store.
    // Default: owners first, then by name.
    initialState: { sorting: [{ id: 'role', desc: false }, { id: 'name', desc: false }] },
  });

  return <DataTable table={table} emptyMessage="No members." />;
}
