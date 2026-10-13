'use client';

import { Controller, useWatch, type Control, type Path } from 'react-hook-form';
import type { CompanyBrandingFormInput } from '@repo/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { initials } from './initials';

/**
 * The logo link and brand color inputs, with live previews. Used by the
 * Settings page and by step 2 of "Add company", so both stay identical.
 * Generic over the form's values because RHF's Control<T> is invariant: a
 * form with more fields (Settings has `name`) still fits.
 */
export function BrandingFields<T extends CompanyBrandingFormInput>({
  control,
  companyName,
}: {
  control: Control<T>;
  /** For the logo preview's initials. */
  companyName: string;
}) {
  const logoName = 'logoUrl' as Path<T>;
  const colorName = 'brandColor' as Path<T>;
  // useWatch, not form.watch(): safe for React Compiler (https://react-hook-form.com/docs/usewatch).
  const [logoUrl, brandColor] = useWatch({ control, name: [logoName, colorName] }) as [string, string];

  return (
    <>
      <Controller
        name={logoName}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="company-logo">Logo link</FieldLabel>
            <div className="flex items-center gap-3">
              {/* Preview: the Avatar falls back to initials until the image loads, or if it can't. */}
              <Avatar className="size-8">
                {logoUrl && !fieldState.invalid && <AvatarImage src={logoUrl} alt="" />}
                <AvatarFallback className="text-xs">{initials(companyName)}</AvatarFallback>
              </Avatar>
              <Input
                {...field}
                value={field.value as string}
                id="company-logo"
                aria-describedby="company-logo-description"
                type="url"
                placeholder="https://example.com/logo.png"
                aria-invalid={fieldState.invalid}
              />
            </div>
            <FieldDescription id="company-logo-description">
              A link to an image on https://. Leave empty for no logo.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={colorName}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="company-color">Brand color</FieldLabel>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-full border bg-muted"
                style={brandColor && !fieldState.invalid ? { backgroundColor: brandColor } : undefined}
              />
              <Input
                {...field}
                value={field.value as string}
                id="company-color"
                aria-describedby="company-color-description"
                placeholder="#1a73e8"
                aria-invalid={fieldState.invalid}
              />
            </div>
            <FieldDescription id="company-color-description">
              Used on your public job pages. Leave empty for the default.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </>
  );
}
