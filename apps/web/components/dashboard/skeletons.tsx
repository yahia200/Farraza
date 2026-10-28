import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Loading shapes shared by the dashboard pages (web.md, "Loading states").
 * Fixed sizes only: no Math.random() or request data in anything prerendered.
 * Each piece mirrors the real element's size so the swap doesn't shift the page.
 */

/** Marks a group of skeletons busy and tells a screen reader what is loading. */
export function SkeletonGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** `PageTitle`: a 20px heading line and a 14px description line. */
export function PageTitleSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

/** `PageTitle` with a primary button on the right, like Jobs and Members. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
      <PageTitleSkeleton />
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

const CELL_WIDTHS = ['w-40', 'w-20', 'w-24', 'w-16', 'w-28'];

/** A data table: header cells, then `rows` rows of cells with varied widths. */
export function TableSkeleton({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border" aria-hidden="true">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, c) => (
              <TableHead key={c}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <TableCell key={c}>
                  <Skeleton className={`h-4 ${CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The company Overview: three link cards, each an icon + title and a two-line description. */
export function CardGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}>
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/** A label above an input (or a taller textarea), repeated, then the Save button. */
export function FormSkeleton({
  fields = 2,
  textareaRows,
  className = 'max-w-xl',
}: {
  fields?: number;
  /** When set, the last field is a textarea about this tall (1 row is about 1.5rem). */
  textareaRows?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-6 ${className}`} aria-hidden="true">
      {Array.from({ length: fields }, (_, i) => {
        const textarea = textareaRows !== undefined && i === fields - 1;
        return (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="w-full rounded-lg" style={{ height: textarea ? `${textareaRows * 1.5 + 1}rem` : '2rem' }} />
          </div>
        );
      })}
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

/** The job header: back link, title with status badge, and the action buttons. */
export function JobHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4" aria-hidden="true">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-10" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/** Job Overview: the details form beside the dates and pipeline stages. */
export function JobOverviewSkeleton() {
  return (
    <SkeletonGroup label="Loading job" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <FormSkeleton fields={2} textareaRows={10} className="max-w-2xl" />
      <div className="space-y-6" aria-hidden="true">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="flex flex-wrap gap-1.5">
            {['w-16', 'w-20', 'w-24', 'w-14', 'w-16'].map((width, i) => (
              <Skeleton key={i} className={`h-5 rounded-full ${width}`} />
            ))}
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Application form builder: the CV setting, then a few collapsed question cards. */
export function FormBuilderSkeleton({ questions = 3 }: { questions?: number }) {
  return (
    <SkeletonGroup label="Loading the application form" className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border p-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3.5 w-56 max-w-full" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      {Array.from({ length: questions }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4" aria-hidden="true">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="size-8 shrink-0" />
          <Skeleton className="size-8 shrink-0" />
        </div>
      ))}
      <Skeleton className="h-8 w-36" />
    </SkeletonGroup>
  );
}

/** The candidates page: view toggle and the two picker buttons, then the table. */
export function CandidatesSkeleton() {
  return (
    <SkeletonGroup label="Loading candidates" className="flex flex-col gap-4">
      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
      </div>
      <TableSkeleton columns={4} rows={6} />
    </SkeletonGroup>
  );
}
