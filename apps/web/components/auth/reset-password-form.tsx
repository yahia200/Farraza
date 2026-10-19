'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema, type ResetPasswordInput } from '@repo/shared';
import { resetPassword } from '@/app/actions/password-reset';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * Chooses a new password with the token from the reset link. The token rides
 * along as a form value nobody edits; success signs in and redirects to the
 * dashboard (the Server Action). A refused password leaves the link usable.
 * Same pattern as SignUpForm: https://ui.shadcn.com/docs/forms/react-hook-form
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [formError, setFormError] = useState<string>();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(undefined);
    // Only returns on failure; success redirects to /dashboard.
    const failure = await resetPassword(values);
    if (failure) {
      setFormError(applyActionFailure(form, failure));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>
              {formError}{' '}
              <Link href="/forgot-password" className="underline underline-offset-4">
                Ask for a new link
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="reset-password-password">New password</FieldLabel>
              <Input
                {...field}
                id="reset-password-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Set password and sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
