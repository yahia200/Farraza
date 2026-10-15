'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent } from '@/components/ui/sheet';

/**
 * The candidate detail panel (shadcn Sheet on Base UI Dialog). Whether it's
 * open comes from the URL (?application=<id>), so a candidate can be linked
 * to and the server renders their details (CandidateDetail).
 *
 * Closing: the sheet animates out first, and only then is ?application
 * removed (`onOpenChangeComplete`, @base-ui/react dialog/root/DialogRoot.d.ts).
 * Removing it first would empty the panel while it's still sliding away.
 */
export function CandidateSheet({
  open,
  closeHref,
  children,
}: {
  open: boolean;
  closeHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Opening again (from the URL) shows the sheet again. Adjusting state when a
  // prop changes, during render: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (open !== wasOpen) {
    setWasOpen(open);
    setDismissed(false);
  }

  return (
    <Sheet
      open={open && !dismissed}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen && open) router.push(closeHref, { scroll: false });
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg data-[side=right]:sm:max-w-lg">{children}</SheetContent>
    </Sheet>
  );
}
