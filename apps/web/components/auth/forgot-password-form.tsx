'use client';

import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheckIcon } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@repo/shared';
import { forgotPassword } from '@/app/actions/password-reset';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * "Forgot your password?". After sending, it always says "check your email":
 * the API answers the same for every address, so neither the page nor anyone
 * using it learns whether an account exists.
 * Same pattern as SignInForm: https://ui.shadcn.com/docs/forms/react-hook-form
 */
export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  // Next.js keeps this page mounted but hidden (Activity) after you leave it.
  // Start over whenever it's hidden, so coming back shows the form, not an old
  // "check your email" (02-guides/preserving-ui-state.md; as in AddCompanyWizard).
  useLayoutEffect(() => {
    return () => {
      setSentTo(undefined);
      setFormError(undefined);
      form.reset();
    };
  }, [form]);

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(undefined);
    const failure = await forgotPassword(values);
    if (failure) {
      setFormError(applyActionFailure(form, failure));
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            If {sentTo} belongs to an account, we&apos;ve sent it a link to choose a new password. The link works
            once, for an hour.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setSentTo(undefined);
            form.reset();
          }}
        >
          Use another address
        </Button>
      </div>
    );
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
              <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
              <Input
                {...field}
                id="forgot-password-email"
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Send me a link
        </Button>
      </FieldGroup>
    </form>
  );
}
