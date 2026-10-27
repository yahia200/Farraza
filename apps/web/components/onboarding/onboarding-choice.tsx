'use client';

import { useActionState, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, CircleAlertIcon, CopyIcon } from 'lucide-react';
import { createCompanySchema, type CreateCompanyInput } from '@repo/shared';
import { checkMembership, createCompany } from '@/app/actions/companies';
import { applyActionFailure } from '@/components/forms/apply-action-failure';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';

type Path = 'owner' | 'employee';

/**
 * The whole onboarding step on one page: pick a path, then either name the
 * company or get told how to be added to one.
 * Choice cards: https://ui.shadcn.com/docs/components/base/field (Choice Card)
 */
export function OnboardingChoice({ email }: { email: string }) {
  const [path, setPath] = useState<Path>();

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend variant="label" id="path-legend">
          How will you use Farraza?
        </FieldLegend>
        {/*
          aria-labelledby names the group, as in Base UI's radio docs (docs/react/components/radio.md).
          Uncontrolled (no `value`): nothing is selected at first, and Base UI treats
          `value={undefined}` as uncontrolled, so we only listen for changes.
        */}
        <RadioGroup aria-labelledby="path-legend" onValueChange={(value) => setPath(value as Path)}>
          <FieldLabel htmlFor="path-owner">
            <Field orientation="horizontal">
              <RadioGroupItem value="owner" id="path-owner" />
              <FieldContent>
                <FieldTitle>I&apos;m setting up my company</FieldTitle>
                <FieldDescription>Create a workspace and invite your team later.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="path-employee">
            <Field orientation="horizontal">
              <RadioGroupItem value="employee" id="path-employee" />
              <FieldContent>
                <FieldTitle>I&apos;m joining my team</FieldTitle>
                <FieldDescription>Your company already uses Farraza.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
        </RadioGroup>
      </FieldSet>

      {path === 'owner' && <CreateCompanyForm />}
      {path === 'employee' && <JoinInstructions email={email} />}
    </FieldGroup>
  );
}

/** Same pattern as the auth forms: https://ui.shadcn.com/docs/forms/react-hook-form */
function CreateCompanyForm() {
  const [formError, setFormError] = useState<string>();
  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: CreateCompanyInput) {
    setFormError(undefined);
    // Only returns on failure; success redirects to the new company's dashboard.
    const failure = await createCompany(values);
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
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="onboarding-company-name">Company name</FieldLabel>
              <Input
                {...field}
                id="onboarding-company-name"
                autoComplete="organization"
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Create company
        </Button>
      </FieldGroup>
    </form>
  );
}

/**
 * There are no invitations yet: an admin adds people by the email they signed
 * up with (POST /api/companies/:slug/members).
 */
function JoinInstructions({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  // useActionState gives the pending flag and the action's returned message:
  // node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
  const [result, checkAction, checking] = useActionState(() => checkMembership(), undefined);

  async function copyEmail() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="your-email">Ask an admin at your company to add you with this email</FieldLabel>
        <div className="flex gap-2">
          <Input id="your-email" value={email} readOnly />
          <Button type="button" variant="ghost" size="icon" onClick={copyEmail} aria-label="Copy email">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <FieldDescription>Once they&apos;ve added you, check again to continue.</FieldDescription>
      </Field>

      {result?.message && (
        <Alert variant={'warning'}>
            <CircleAlertIcon data-icon="inline-start" />
          <AlertTitle>
            {result.message}</AlertTitle>
        </Alert>
      )}

      <form action={checkAction}>
        <Button type="submit" variant="outline" className="w-full" disabled={checking}>
          {checking && <Spinner data-icon="inline-start" />}
          Check again
        </Button>
      </form>
    </FieldGroup>
  );
}
