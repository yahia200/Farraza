'use client';

import { useState, useTransition } from 'react';
import { closeJob, openJob } from '@/app/actions/jobs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import type { JobStatus } from '@/lib/dal';

/**
 * Open / Reopen / Close for a job. Opening needs a published application form
 * (the API answers 409 otherwise), so the button is disabled with the reason
 * shown until there is one.
 */
export function JobStatusActions({
  companySlug,
  jobSlug,
  status,
  hasPublishedForm,
}: {
  companySlug: string;
  jobSlug: string;
  status: JobStatus;
  hasPublishedForm: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);

  function run(action: typeof openJob, success: string) {
    startTransition(async () => {
      const result = await action(companySlug, jobSlug);
      setConfirmClose(false);
      if (result.ok) {
        toast.add({ type: 'success', title: success });
      } else {
        toast.add({ type: 'error', title: "Couldn't change the job's status", description: result.formError });
      }
    });
  }

  if (status === 'open') {
    return (
      <>
        <Button variant="ghost" onClick={() => setConfirmClose(true)}>
          Close job
        </Button>
        <AlertDialog open={confirmClose} onOpenChange={(open) => !pending && setConfirmClose(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close this job?</AlertDialogTitle>
              <AlertDialogDescription>
                Its public page stops taking applications. Candidates you already have stay in the pipeline, and you
                can reopen it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              {/* AlertDialogAction is a plain Button: the dialog stays open while closing. */}
              <AlertDialogAction onClick={() => run(closeJob, 'Job closed')} disabled={pending} variant="destructive">
                {pending && <Spinner data-icon="inline-start" />}
                Close job
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => run(openJob, status === 'closed' ? 'Job reopened' : 'Job opened')}
        disabled={pending || !hasPublishedForm}
        aria-describedby={hasPublishedForm ? undefined : 'open-job-requirement'}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {status === 'closed' ? 'Reopen job' : 'Open job'}
      </Button>
      {!hasPublishedForm && (
        <p id="open-job-requirement" className="text-xs text-muted-foreground">
          Publish the application form first.
        </p>
      )}
    </div>
  );
}
