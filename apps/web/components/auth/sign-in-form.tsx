'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@repo/shared';
import { signIn } from '@/app/actions/auth';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * React Hook Form validates in the browser with the shared Zod schema; the
 * Server Action validates again and talks to the API.
 * Pattern: https://ui.shadcn.com/docs/forms/react-hook-form
 */
export function SignInForm() {
  const [formError, setFormError] = useState<string>();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInInput) {
    setFormError(undefined);
    // Only returns on failure; success redirects to /dashboard.
    const failure = await signIn(values);
    if (failure) {
      setFormError(applyActionFailure(form, failure));
    }
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
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
              <Input
                {...field}
                id="sign-in-email"
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              {/* Label row with the reset link, as in shadcn's login-01 block (https://ui.shadcn.com/blocks/login). */}
              <div className="flex items-center">
                <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                <Link
                  href="/forgot-password"
                  className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                {...field}
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
