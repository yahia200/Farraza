import { createSortedRowModel, rowSortingFeature, sortFn_text, tableFeatures } from '@tanstack/react-table';
import type { MemberRole } from '@repo/shared';
import type { DataTableColumnMeta } from '@/components/data-table/data-table';
import type { CompanyMember } from '@/lib/dal';

/**
 * TanStack Table v9 setup for the members table, following shadcn's data-table
 * guide (https://ui.shadcn.com/docs/components/base/data-table). In v9 the
 * features, row models and sort functions are registered once, statically,
 * with tableFeatures() (see its JSDoc in @tanstack/table-core).
 */

/** One table row: a member plus the join date already formatted on the server. */
export interface MemberRow extends CompanyMember {
  joinedLabel: string;
}

/** Who is looking at the table, so cells can offer only the allowed actions. */
export interface MembersTableMeta {
  companySlug: string;
  currentUserId: string;
  currentRole: MemberRole;
}

export const membersTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
  // Type-only slot: types `table.options.meta` without global declaration merging.
  tableMeta: {} as MembersTableMeta,
  // Per-column extras the shared DataTable understands (className).
  columnMeta: {} as DataTableColumnMeta,
});

export type MembersTableFeatures = typeof membersTableFeatures;
