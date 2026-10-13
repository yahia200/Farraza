'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companySettingsFormSchema, type CompanySettingsFormInput } from '@repo/shared';
import { updateCompanySettings } from '@/app/actions/companies';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import type { MyCompany } from '@/lib/dal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BrandingFields } from './branding-fields';

/**
 * Company settings, saved through PATCH /api/companies/:slug.
 * Same form pattern as the auth forms: https://ui.shadcn.com/docs/forms/react-hook-form
 */
export function CompanySettingsForm({ company }: { company: MyCompany }) {
  // Mirrors CompanyPolicy.update in the API, which enforces it anyway (403).
  const canEdit = company.role === 'owner' || company.role === 'admin';
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const form = useForm<CompanySettingsFormInput>({
    resolver: zodResolver(companySettingsFormSchema),
    defaultValues: {
      name: company.name,
      logoUrl: company.logoUrl ?? '',
      brandColor: company.brandColor ?? '',
    },
  });
  // For the logo preview's initials. useWatch, not form.watch(): https://react-hook-form.com/docs/usewatch
  const name = useWatch({ control: form.control, name: 'name' });

  async function onSubmit(values: CompanySettingsFormInput) {
    setFormError(undefined);
    setSaved(false);
    const result = await updateCompanySettings(company.slug, values);
    if (result.saved) {
      setSaved(true);
      // The saved values become the new baseline, so the form is no longer "dirty".
      form.reset(values);
      return;
    }
    setFormError(applyActionFailure(form, result));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldSet disabled={!canEdit}>
        <FieldGroup>
          {!canEdit && (
            <Alert>
              <AlertDescription>Only owners and admins can change these settings.</AlertDescription>
            </Alert>
          )}
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {saved && (
            <Alert>
              <AlertDescription>Settings saved.</AlertDescription>
            </Alert>
          )}

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="company-name">Company name</FieldLabel>
                <Input {...field} id="company-name" autoComplete="organization" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <BrandingFields control={form.control} companyName={name || company.name} />

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
