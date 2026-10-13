'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  companyBrandingFormSchema,
  createCompanySchema,
  type CompanyBrandingFormInput,
  type CreateCompanyInput,
} from '@repo/shared';
import { addCompany, updateCompanySettings } from '@/app/actions/companies';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BrandingFields } from './branding-fields';

interface CreatedCompany {
  slug: string;
  name: string;
}

/**
 * "Add company" in two steps. Step 1 creates the company; step 2 sets its
 * logo and color, or is skipped (they can be set later in Settings).
 * Each step follows the form pattern in https://ui.shadcn.com/docs/forms/react-hook-form
 */
export function AddCompanyWizard() {
  const [company, setCompany] = useState<CreatedCompany>();

  // Next.js keeps this page mounted but hidden (Activity) after you leave it,
  // state included. Start over at step 1 whenever it's hidden, so coming back
  // never shows step 2 for a company you already finished. The cleanup runs
  // as the page is hidden, so there's no flash of step 1 before navigating
  // (02-guides/preserving-ui-state.md, "Expandable UI").
  useLayoutEffect(() => {
    return () => setCompany(undefined);
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardDescription>Step {company ? 2 : 1} of 2</CardDescription>
        <CardTitle>{company ? `Brand ${company.name}` : 'Add a company'}</CardTitle>
        <CardDescription>
          {company
            ? 'Shown to candidates on your job pages. You can change these later in Settings.'
            : 'You will be its owner.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {company ? <BrandingStep company={company} /> : <NameStep onCreated={setCompany} />}
      </CardContent>
    </Card>
  );
}

function NameStep({ onCreated }: { onCreated: (company: CreatedCompany) => void }) {
  const [formError, setFormError] = useState<string>();
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: CreateCompanyInput) {
    setFormError(undefined);
    const result = await addCompany(values);
    if (result.slug) {
      onCreated({ slug: result.slug, name: values.name });
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-company-name">Company name</FieldLabel>
              <Input
                {...field}
                id="new-company-name"
                autoComplete="organization"
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" className="self-end" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Continue
        </Button>
      </FieldGroup>
    </form>
  );
}

function BrandingStep({ company }: { company: CreatedCompany }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const form = useForm<CompanyBrandingFormInput>({
    resolver: zodResolver(companyBrandingFormSchema),
    defaultValues: { logoUrl: '', brandColor: '' },
  });
  const dashboard = `/dashboard/${company.slug}`;

  async function onSubmit(values: CompanyBrandingFormInput) {
    setFormError(undefined);
    // The settings action expects the whole form; the name is what step 1 saved.
    const result = await updateCompanySettings(company.slug, { name: company.name, ...values });
    if (result.saved) {
      router.push(dashboard);
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <BrandingFields control={form.control} companyName={company.name} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push(dashboard)}>
            Skip for now
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
            Finish
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
