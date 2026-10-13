'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateJobSchema, type UpdateJobInput } from '@repo/shared';
import { updateJob } from '@/app/actions/jobs';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

/**
 * Title and description. Same form pattern as the company settings form;
 * read-only (native <fieldset disabled>) for people who can't manage jobs.
 */
export function JobDetailsForm({
  companySlug,
  job,
  canEdit,
}: {
  companySlug: string;
  job: { slug: string; title: string; description: string | null };
  canEdit: boolean;
}) {
  const [formError, setFormError] = useState<string>();
  const form = useForm<UpdateJobInput>({
    resolver: zodResolver(updateJobSchema),
    defaultValues: { title: job.title, description: job.description ?? '' },
  });

  async function onSubmit(values: UpdateJobInput) {
    setFormError(undefined);
    const result = await updateJob(companySlug, job.slug, values);
    if (result.saved) {
      // The saved values become the new baseline, so "Save" disables again.
      form.reset(values);
      toast.add({ type: 'success', title: 'Job saved' });
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-2xl">
      <FieldSet disabled={!canEdit}>
        <FieldGroup>
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
                <FieldLabel htmlFor="job-title">Job title</FieldLabel>
                <Input {...field} value={field.value ?? ''} id="job-title" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="job-description">Description</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  id="job-description"
                  rows={10}
                  aria-describedby="job-description-help"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription id="job-description-help">
                  Plain text, shown to candidates on the job&apos;s public page.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          {canEdit && (
            <Button type="submit" className="self-start" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
              Save changes
            </Button>
          )}
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
