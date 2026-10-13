'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from 'lucide-react';
import { createJobSchema, type CreateJobInput } from '@repo/shared';
import { createJob } from '@/app/actions/jobs';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

/** "New job": same Dialog + form pattern as "Add member". Creates a draft and opens it. */
export function NewJobDialog({ companySlug }: { companySlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const form = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { title: '', description: '' },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setFormError(undefined);
    }
  }

  async function onSubmit(values: CreateJobInput) {
    setFormError(undefined);
    const result = await createJob(companySlug, values);
    if (result.slug) {
      // Close and reset before leaving: Next.js keeps this page mounted (Activity),
      // so "back" would otherwise reopen the dialog with the old values
      // (02-guides/preserving-ui-state.md, "Resetting form state on submit").
      onOpenChange(false);
      router.push(`/dashboard/${companySlug}/jobs/${result.slug}`);
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New job
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>New job</DialogTitle>
            <DialogDescription>It starts as a draft. You can open it once its application form is ready.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-job-title">Job title</FieldLabel>
                  <Input {...field} id="new-job-title" autoFocus aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-job-description">Description</FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    id="new-job-description"
                    rows={5}
                    aria-describedby="new-job-description-help"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription id="new-job-description-help">Optional. Plain text; you can edit it later.</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
              Create job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
