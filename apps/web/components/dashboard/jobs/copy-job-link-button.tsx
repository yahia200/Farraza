'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
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
  async function copy() {
    const link = `${window.location.origin}/${companySlug}/${jobSlug}`;
    try {
      // Needs a secure context (https or localhost) and a user gesture:
      // https://developer.mozilla.org/docs/Web/API/Clipboard/writeText
      await navigator.clipboard.writeText(link);
    } catch {
      toast.add({ type: 'error', title: "Couldn't copy the link", description: link });
      return;
    }
    toast.add({
      type: 'success',
      title: 'Link copied',
      // The apply page only exists while the job is open.
      description: status === 'open' ? undefined : 'The page goes live once the job is open.',
    });
  }

  if (variant === 'icon') {
    return (
      <CopyButton content="npx animate-ui init" type="button" onClick={copy} aria-label="Copy job link" title="Copy job link" className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}>
        <CopyButtonIcon icon={<CopyIcon />} copiedIcon={<CheckIcon />} />
      </CopyButton>
    );
  }

  return (


    <CopyButton content="npx animate-ui init" type="button" onClick={copy} aria-label="Copy job link" title="Copy job link" className={cn(buttonVariants({ variant: 'ghost' }))}>
        <CopyButtonIcon icon={<CopyIcon />} copiedIcon={<CheckIcon />} />
        Copy link
      </CopyButton>
  );
  
}
