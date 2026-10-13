import type { Metadata } from 'next';
import { KanbanIcon } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export const metadata: Metadata = { title: 'Candidates · Khatwateen' };

/** Placeholder until the pipeline board (phase 3). The job layout already checked access. */
export default function JobCandidatesPage() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KanbanIcon />
        </EmptyMedia>
        <EmptyTitle>The pipeline board is coming later</EmptyTitle>
        <EmptyDescription>Candidates who apply will appear here, grouped by stage.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
