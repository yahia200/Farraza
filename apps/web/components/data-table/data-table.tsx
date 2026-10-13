'use client';

import type { ReactNode } from 'react';
import type { Column, ReactTable, RowData, TableFeatures } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * The reusable part of shadcn's data-table guide
 * (https://ui.shadcn.com/docs/components/base/data-table): renders any
 * TanStack Table v9 instance with shadcn's <Table>. Each feature keeps its own
 * useTable() call and features (sorting, filtering, ...), and passes the table in.
 */

/**
 * Column extras every data table understands. Declare them in your features
 * with `columnMeta: {} as DataTableColumnMeta` and set them on a column's `meta`.
 */
export interface DataTableColumnMeta {
  /** Classes for the column's header and cells, e.g. `w-px whitespace-nowrap` to fit the content. */
  className?: string;
}

const metaOf = (column: { columnDef: { meta?: unknown } }) =>
  column.columnDef.meta as DataTableColumnMeta | undefined;

/** Only tables that register rowSortingFeature give columns these methods. */
type SortableColumn = { getIsSorted?: () => false | 'asc' | 'desc'; toggleSorting?: (desc?: boolean) => void };
const sortStateOf = (column: unknown) => (column as SortableColumn).getIsSorted?.() ?? false;

export function DataTable<TFeatures extends TableFeatures, TData extends RowData>({
  table,
  emptyMessage = 'No results.',
}: {
  table: ReactTable<TFeatures, TData, unknown>;
  emptyMessage?: ReactNode;
}) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = sortStateOf(header.column);
                return (
                  <TableHead
                    key={header.id}
                    className={metaOf(header.column)?.className}
                    // Tells screen readers which column the table is sorted by.
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={metaOf(cell.column)?.className}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * A sortable column header, as in the guide's "Sorting" section. Generic over
 * the features, row and value types: v9's Column<Features, Row, Value> needs all three.
 */
export function DataTableSortButton<TFeatures extends TableFeatures, TData extends RowData, TValue>({
  column,
  children,
}: {
  column: Column<TFeatures, TData, TValue>;
  children: ReactNode;
}) {
  const sorted = sortStateOf(column);
  const Icon = sorted === 'asc' ? ArrowUpIcon : sorted === 'desc' ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => (column as SortableColumn).toggleSorting?.(sorted === 'asc')}
    >
      {children}
      <Icon data-icon="inline-end" />
    </Button>
  );
}
