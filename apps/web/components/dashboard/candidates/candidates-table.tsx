'use client';

import { useTable } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JobStage } from '@/lib/dal';
import { candidateColumns } from './columns';
import { candidatesTableFeatures, type CandidateRow, type CandidatesTableMeta } from './data-table-features';

/**
 * A job's candidates: a stage filter above the shared <DataTable>. A Select
 * rather than the jobs list's ToggleGroup: six stages plus "All" would wrap.
 */
export function CandidatesTable({
  data,
  stages,
  meta,
}: {
  data: CandidateRow[];
  stages: JobStage[];
  meta: CandidatesTableMeta;
}) {
  const table = useTable({
    features: candidatesTableFeatures,
    columns: candidateColumns,
    data,
    meta,
    initialState: { sorting: [{ id: 'submittedAt', desc: true }] },
  });

  const stageColumn = table.getColumn('stage');
  const position = stageColumn?.getFilterValue() as number | undefined;
  const selected = position === undefined ? 'all' : String(position);

  // Base UI's Select shows an item's label only when it knows the items (`items`).
  const items = [
    { value: 'all', label: `All stages (${data.length})` },
    ...[...stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        value: String(stage.position),
        label: `${stage.name} (${data.filter((row) => row.stage.position === stage.position).length})`,
      })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Select
        items={items}
        value={selected}
        onValueChange={(value) => stageColumn?.setFilterValue(value && value !== 'all' ? Number(value) : undefined)}
      >
        <SelectTrigger aria-label="Filter by stage" className="w-fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} className="">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DataTable
        table={table}
        emptyMessage={selected === 'all' ? 'No one has applied yet.' : 'No candidates in this stage.'}
      />
    </div>
  );
}
