'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { Controller, useForm, type FieldErrors, type Path } from 'react-hook-form';
import { CircleCheckIcon } from 'lucide-react';
import type { FieldError, PublicFormField } from '@repo/shared';
import type { QuestionnaireItemDefinition } from '@shadcn/react/questionnaire';
import { submitApplication } from '@/app/actions/applications';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { Spinner } from '@/components/ui/spinner';
import {
  applyResolver,
  compactAnswers,
  emptyValues,
  isLockedOption,
  type AnswerInput,
  type ApplyValues,
} from './apply-values';
import { QuestionStep } from './question-step';

/** The applicant's details, asked first, one per step. */
const CONTACT_STEPS = [
  { name: 'name', title: "What's your full name?", empty: 'Enter your full name.', type: 'text', autoComplete: 'name' },
  {
    name: 'email',
    title: "What's your email address?",
    description: "We'll use it to contact you about this job.",
    empty: 'Enter your email address.',
    type: 'email',
    autoComplete: 'email',
  },
  {
    name: 'phone',
    title: "What's your phone number?",
    // Numbers without a country code are read as Egyptian (DEFAULT_PHONE_COUNTRY in @repo/shared).
    description: 'For example 0100 123 4567, or +20 100 123 4567 from outside Egypt.',
    empty: 'Enter your phone number.',
    type: 'tel',
    autoComplete: 'tel',
  },
] as const;

type ContactName = (typeof CONTACT_STEPS)[number]['name'];
const CONTACT_NAMES: readonly string[] = CONTACT_STEPS.map((step) => step.name);

/** A step's name is a contact field or a question key; this is where its value lives in the form. */
const pathFor = (step: string) =>
  (CONTACT_NAMES.includes(step) ? step : `answers.${step}`) as Path<ApplyValues>;

const hasError = (errors: FieldErrors<ApplyValues>, step: string) =>
  Boolean(CONTACT_NAMES.includes(step) ? errors[step as ContactName] : errors.answers?.[step]);

/** A callback ref defined once, so React calls it only when the element mounts. */
const focusOnMount = (element: HTMLElement | null) => element?.focus();

/**
 * The public application form, one question per screen (shadcn Questionnaire:
 * https://ui.shadcn.com/docs/components/base/questionnaire, API:
 * https://ui.shadcn.com/docs/react/questionnaire).
 *
 * React Hook Form owns the answers and validates them with the API's own rules
 * (apply-values.ts). The questionnaire is controlled (`item`/`onItemChange`):
 * moving forward first checks the current step, and errors from the server
 * send the applicant back to the step that needs fixing.
 */
export function ApplyForm({
  companySlug,
  jobSlug,
  companyName,
  jobTitle,
  fields,
  source,
}: {
  companySlug: string;
  jobSlug: string;
  companyName: string;
  jobTitle: string;
  fields: PublicFormField[];
  /** utm_source from the link; sent only if it's usable (see the Server Action). */
  source?: string;
}) {
  // Unique ids even if two apply pages stay mounted (Next keeps recent pages alive).
  const idPrefix = useId();
  const resolver = useMemo(() => applyResolver(fields), [fields]);
  const form = useForm<ApplyValues>({ resolver, defaultValues: emptyValues(fields) });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);

  // Multiple-choice options locked at their question's limit, as a string of ids.
  // Updated in answer() (every change goes through it) rather than by watching all
  // answers here: a watch re-renders the whole questionnaire on every keystroke,
  // which made it re-register its steps in a loop. A string state only re-renders
  // when the locks actually change.
  const [lockedOptions, setLockedOptions] = useState('');

  // Step order and what the questionnaire needs to know about each step
  // (server rendering, progress, and letter shortcuts for the choices). It must
  // agree with what the steps render, including which choices are disabled.
  const steps = useMemo<QuestionnaireItemDefinition[]>(
    () => [
      ...CONTACT_STEPS.map((step) => ({ name: step.name, required: true })),
      ...fields.map((field) => ({
        name: field.key,
        required: field.required,
        choices:
          field.type === 'single_select' || field.type === 'multi_select'
            ? field.config.options.map((option) =>
                // Only add `disabled` when true: with @shadcn/react 0.3.1, listing
                // `disabled: false` on every option made the page loop on load
                // ("Maximum update depth exceeded"), seen in the browser.
                lockedOptions.split(',').includes(option.id) ? { value: option.id, disabled: true } : { value: option.id },
              )
            : field.type === 'yes_no'
              ? [{ value: 'true' }, { value: 'false' }]
              : undefined,
      })),
    ],
    [fields, lockedOptions],
  );
  const order = useMemo(() => steps.map((step) => step.name), [steps]);
  const [item, setItem] = useState(order[0]!);

  /** Moving forward checks the current step with our rules; moving back is always allowed. */
  async function changeStep(next: string) {
    if (order.indexOf(next) > order.indexOf(item) && !(await form.trigger(pathFor(item)))) {
      return;
    }
    setItem(next);
  }

  /** Every answer goes through here, so a step showing an error re-checks as it's fixed. */
  function answer(path: Path<ApplyValues>, value: AnswerInput) {
    form.setValue(path, value, { shouldDirty: true });
    const answers = form.getValues('answers');
    setLockedOptions(
      fields
        .flatMap((field) =>
          field.type === 'multi_select'
            ? field.config.options.filter((option) => isLockedOption(field, answers[field.key], option.id))
            : [],
        )
        .map((option) => option.id)
        .join(','),
    );
    if (form.getFieldState(path).invalid) {
      void form.trigger(path);
    }
  }

  /** Opens the first step that has an error (handleSubmit's onInvalid). */
  function showFirstError(errors: FieldErrors<ApplyValues>) {
    const first = order.find((step) => hasError(errors, step));
    if (first) {
      setItem(first);
    }
  }

  /** Puts the server's errors on their steps; anything else is shown by the buttons. */
  function applyServerErrors(errors: FieldError[]) {
    for (const { path, message } of errors) {
      if (order.includes(path)) {
        form.setError(pathFor(path), { type: 'server', message });
      } else {
        // For example a question that was removed while they were filling the form in.
        setFormError(message);
      }
    }
    const first = order.find((step) => errors.some((error) => error.path === step));
    if (first) {
      setItem(first);
    }
  }

  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        setFormError(undefined);
        const result = await submitApplication(companySlug, jobSlug, {
          name: values.name,
          email: values.email,
          phone: values.phone,
          answers: compactAnswers(values.answers),
          website: values.website,
          source,
        });
        if (result.ok) {
          setSent(true);
          return;
        }
        if (result.fieldErrors) {
          applyServerErrors(result.fieldErrors);
        }
        if (result.formError) {
          setFormError(result.formError);
        }
      }),
    showFirstError,
  );

  if (sent) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheckIcon />
          </EmptyMedia>
          {/* Focused when it appears, so it's in view and screen readers announce it. */}
          <EmptyTitle ref={focusOnMount} tabIndex={-1} className="outline-none">
            Application sent
          </EmptyTitle>
          <EmptyDescription>
            Thanks, {companyName} received your application for {jobTitle}. They&apos;ll contact you by email.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Questionnaire
      items={steps}
      item={item}
      onItemChange={(next) => void changeStep(next)}
      shortcuts="letters"
      onSubmit={(event) => void onSubmit(event)}
      // If someone submits before the JavaScript has loaded, the browser's
      // default GET would put their name, email and phone in the URL.
      method="post"
    >
      <QuestionnaireProgress />

      {CONTACT_STEPS.map((step) => (
        <Controller
          key={step.name}
          name={step.name}
          control={form.control}
          render={({ field, fieldState }) => (
            <QuestionnaireItem name={step.name} required invalid={fieldState.invalid}>
              <QuestionnaireTitle>{step.title}</QuestionnaireTitle>
              {'description' in step && <QuestionnaireDescription>{step.description}</QuestionnaireDescription>}
              <QuestionnaireInput
                ref={field.ref}
                type={step.type}
                autoComplete={step.autoComplete}
                aria-label={step.title}
                value={field.value}
                onChange={(event) => answer(step.name, event.target.value)}
                onBlur={field.onBlur}
              />
              {/* The questionnaire's own "required" message talks about choosing, so text
                  steps bring their own; our rules' messages take over once they run. */}
              <QuestionnaireError>{fieldState.error?.message ?? step.empty}</QuestionnaireError>
            </QuestionnaireItem>
          )}
        />
      ))}

      {fields.map((field) => (
        <QuestionStep key={field.key} form={form} field={field} onAnswer={answer} />
      ))}

      {/* Honeypot. People never see it, so it stays empty; bots that fill in every
          input give themselves away, and the API quietly drops their application.
          Off-screen rather than type="hidden" (which bots skip), hidden from screen
          readers and the Tab key, and named so autofill is unlikely to touch it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] size-px overflow-hidden">
        <Controller
          name="website"
          control={form.control}
          render={({ field }) => (
            <>
              <label htmlFor={`${idPrefix}-hp`}>Leave this field empty</label>
              <input
                id={`${idPrefix}-hp`}
                name="khatwateen-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={field.value}
                onChange={field.onChange}
              />
            </>
          )}
        />
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireSkip />
        <QuestionnaireNext />
        <QuestionnaireSubmit disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Send application
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}
