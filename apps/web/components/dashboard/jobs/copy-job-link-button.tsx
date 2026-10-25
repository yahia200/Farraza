'use client';

import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type { JobStatus } from '@/lib/dal';

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
      <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy job link" title="Copy job link">
        <CopyIcon />
      </Button>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={copy}>
      <CopyIcon data-icon="inline-start" />
      Copy link
    </Button>
  );
}
