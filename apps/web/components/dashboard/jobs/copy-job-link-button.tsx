'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { JobStatus } from '@/lib/dal';
import {
  CopyButton,
  CopyButtonIcon,
} from '@animate-ui/react/primitives/buttons/copy';
import { cn } from '@/lib/utils';


/**
 * Copies a job's public apply link (`/{companySlug}/{jobSlug}`) to the clipboard.
 * The origin is read at click time from `window.location`: the apply page is
 * served by this same web app, so no extra env var is needed.
 *
 * `variant="icon"` is the compact table version, `variant="label"` the one
 * with text for the job header.
 */
export function CopyJobLinkButton({
  companySlug,
  jobSlug,
  status,
  variant,
}: {
  companySlug: string;
  jobSlug: string;
  status: JobStatus;
  variant: 'icon' | 'label';
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    // The CopyButton primitive writes its own `content` to the clipboard right after this handler,
    // unless the click is default-prevented (dist/primitives/buttons/copy/index.js in
    // @animate-ui/react). The link is only known here, so this write is the only one: without this
    // call the clipboard ends up with the primitive's `content`, not the link.
    event.preventDefault();
    const link = `${window.location.origin}/${companySlug}/${jobSlug}`;
    try {
      // Needs a secure context (https or localhost) and a user gesture:
      // https://developer.mozilla.org/docs/Web/API/Clipboard/writeText
      await navigator.clipboard.writeText(link);
    } catch {
      toast.add({ type: 'error', title: "Couldn't copy the link", description: link });
      return;
    }
    // The primitive only swaps its icon on its own write, so the icon follows `copied` here, for
    // as long as the primitive itself would show it (its `delay` default).
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 3000);
    toast.add({
      type: 'success',
      title: 'Link copied',
      // The apply page only exists while the job is open.
      description: status === 'open' ? undefined : 'The page goes live once the job is open.',
    });
  }

  if (variant === 'icon') {
    return (
      <CopyButton content="" copied={copied} type="button" onClick={copy} aria-label="Copy job link" title="Copy job link" className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}>
        <CopyButtonIcon icon={<CopyIcon />} copiedIcon={<CheckIcon />} />
      </CopyButton>
    );
  }

  return (


    <CopyButton content="" copied={copied} type="button" onClick={copy} aria-label="Copy job link" title="Copy job link" className={cn(buttonVariants({ variant: 'ghost' }))}>
        <CopyButtonIcon icon={<CopyIcon />} copiedIcon={<CheckIcon />} />
        Copy link
      </CopyButton>
  );
  
}
