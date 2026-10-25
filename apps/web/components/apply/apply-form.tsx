"use client";

import { useId, useMemo, useState, useTransition } from "react";
import {
  Controller,
  useForm,
  type FieldErrors,
  type Path,
} from "react-hook-form";
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react";
import type { CvMode, FieldError, PublicFormField } from "@repo/shared";
import type { QuestionnaireItemDefinition } from "@shadcn/react/questionnaire";
import { submitApplication } from "@/app/actions/applications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/questionnaire";
import { Spinner } from "@/components/ui/spinner";
import {
  applyResolver,
  compactAnswers,
  emptyValues,
  isLockedOption,
  type AnswerInput,
  type ApplyValues,
} from "./apply-values";
import { AttachmentStep } from "./attachment-step";
import { CvStep } from "./cv-step";
import { GroupStep } from "./group-step";
import { QuestionStep } from "./question-step";
import type { PublicJob } from "@/lib/public-jobs";
import { initials } from "@/components/dashboard/initials";

/** The applicant's details, asked first, one per step. */
const CONTACT_STEPS = [
  {
    name: "name",
    title: "What's your full name?",
    empty: "Enter your full name.",
    type: "text",
    autoComplete: "name",
  },
  {
    name: "email",
    title: "What's your email address?",
    description: "We'll use it to contact you about this job.",
    empty: "Enter your email address.",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "phone",
    title: "What's your phone number?",
    // Numbers without a country code are read as Egyptian (DEFAULT_PHONE_COUNTRY in @repo/shared).
    description:
      "For example 0100 123 4567, or +20 100 123 4567 from outside Egypt.",
    empty: "Enter your phone number.",
    type: "tel",
    autoComplete: "tel",
  },
] as const;

type ContactName = (typeof CONTACT_STEPS)[number]["name"];
const CONTACT_NAMES: readonly string[] = CONTACT_STEPS.map((step) => step.name);

/**
 * The CV step, first when the job asks for a CV. Named like the API's request property, so a
 * server error with the path `cvFileId` finds its step.
 */
const CV_STEP = "cvFileId";

/** A step's name is the CV, a contact field or a question key; this is where its value lives in the form. */
const pathFor = (step: string) =>
  (step === CV_STEP || CONTACT_NAMES.includes(step)
    ? step
    : `answers.${step}`) as Path<ApplyValues>;

const hasError = (errors: FieldErrors<ApplyValues>, step: string) =>
  Boolean(
    step === CV_STEP
      ? errors.cvFileId
      : CONTACT_NAMES.includes(step)
        ? errors[step as ContactName]
        : errors.answers?.[step],
  );

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
  company,
  jobSlug,
  jobTitle,
  jobDescription,
  cvMode,
  fields,
  source,
}: {
  company: PublicJob["company"];
  jobSlug: string;
  jobTitle: string;
  jobDescription?: string | null;
  /** Whether the form asks for a CV: off hides the step, required stops the applicant without one. */
  cvMode: CvMode;
  fields: PublicFormField[];
  /** utm_source from the link; sent only if it's usable (see the Server Action). */
  source?: string;
}) {
  // Unique ids even if two apply pages stay mounted (Next keeps recent pages alive).
  const idPrefix = useId();
  const resolver = useMemo(() => applyResolver(fields, cvMode), [fields, cvMode]);
  const form = useForm<ApplyValues>({
    resolver,
    defaultValues: emptyValues(fields),
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [started, setStarted] = useState(false);
  // The steps (the CV and file questions) whose file is being sent. While any is, the form can't be
  // left, skipped or submitted. A list rather than a flag, so each upload control only reports its own.
  const [uploadingSteps, setUploadingSteps] = useState<string[]>([]);
  const uploading = uploadingSteps.length > 0;
  function setStepUploading(step: string, busy: boolean) {
    setUploadingSteps((current) =>
      busy
        ? current.includes(step)
          ? current
          : [...current, step]
        : current.filter((name) => name !== step),
    );
  }

  // Multiple-choice options locked at their question's limit, as a string of ids.
  // Updated in answer() (every change goes through it) rather than by watching all
  // answers here: a watch re-renders the whole questionnaire on every keystroke,
  // which made it re-register its steps in a loop. A string state only re-renders
  // when the locks actually change.
  const [lockedOptions, setLockedOptions] = useState("");

  // Step order and what the questionnaire needs to know about each step
  // (server rendering, progress, and letter shortcuts for the choices). It must
  // agree with what the steps render, including which choices are disabled.
  const steps = useMemo<QuestionnaireItemDefinition[]>(
    () => [
      ...(cvMode === "off"
        ? []
        : [{ name: CV_STEP, required: cvMode === "required" }]),
      ...CONTACT_STEPS.map((step) => ({ name: step.name, required: true })),
      ...fields.map((field) => ({
        name: field.key,
        required: field.required,
        choices:
          field.type === "single_select" || field.type === "multi_select"
            ? field.config.options.map((option) =>
                // Only add `disabled` when true: with @shadcn/react 0.3.1, listing
                // `disabled: false` on every option made the page loop on load
                // ("Maximum update depth exceeded"), seen in the browser.
                lockedOptions.split(",").includes(option.id)
                  ? { value: option.id, disabled: true }
                  : { value: option.id },
              )
            : field.type === "yes_no"
              ? [{ value: "true" }, { value: "false" }]
              : undefined,
      })),
    ],
    [cvMode, fields, lockedOptions],
  );
  const order = useMemo(() => steps.map((step) => step.name), [steps]);
  const [item, setItem] = useState(order[0]!);

  /** Moving forward checks the current step with our rules; moving back is always allowed. */
  async function changeStep(next: string) {
    if (uploading) {
      return;
    }
    if (
      order.indexOf(next) > order.indexOf(item) &&
      !(await form.trigger(pathFor(item)))
    ) {
      return;
    }
    setItem(next);
  }

  /** Every answer goes through here, so a step showing an error re-checks as it's fixed. */
  function answer(path: Path<ApplyValues>, value: AnswerInput) {
    form.setValue(path, value, { shouldDirty: true });
    const answers = form.getValues("answers");
    setLockedOptions(
      fields
        .flatMap((field) =>
          field.type === "multi_select"
            ? field.config.options.filter((option) =>
                isLockedOption(field, answers[field.key], option.id),
              )
            : [],
        )
        .map((option) => option.id)
        .join(","),
    );
    if (form.getFieldState(path).invalid) {
      void form.trigger(path);
    }
  }

  /**
   * The step an error path belongs to: the path itself, except inside a repeating group, whose
   * errors are `<group key>.<card>.<question key>` and belong to the group's one step.
   */
  function stepOf(path: string) {
    const head = path.split(".")[0]!;
    return fields.some(
      (field) => field.key === head && field.type === "repeating_group",
    )
      ? head
      : path;
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
      const step = stepOf(path);
      if (path === CV_STEP) {
        // The API refused this file id, so the upload no longer counts: the step asks for it again.
        form.setValue("cvFileId", null);
      } else if (fields.some((field) => field.key === path && field.type === "file")) {
        form.setValue(`answers.${path}`, null);
      }
      if (order.includes(step)) {
        // A group's path goes on past the step (`<group>.<card>.<question>`), down to the input.
        form.setError(`${pathFor(step)}${path.slice(step.length)}` as Path<ApplyValues>, {
          type: "server",
          message,
        });
      } else {
        // For example a question that was removed while they were filling the form in.
        setFormError(message);
      }
    }
    const first = order.find((step) =>
      errors.some((error) => stepOf(error.path) === step),
    );
    if (first) {
      setItem(first);
    }
  }

  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        setFormError(undefined);
        const result = await submitApplication(company.slug, jobSlug, {
          name: values.name,
          email: values.email,
          phone: values.phone,
          cvFileId: cvMode === "off" ? undefined : (values.cvFileId ?? undefined),
          answers: compactAnswers(values.answers, fields),
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
      <Card>
        {cardHeader()}
        <CardContent>
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleCheckIcon />
              </EmptyMedia>
              {/* Focused when it appears, so it's in view and screen readers announce it. */}
              <EmptyTitle
                ref={focusOnMount}
                tabIndex={-1}
                className="outline-none"
              >
                Application sent
              </EmptyTitle>
              <EmptyDescription>
                Thanks, {company.name} received your application for {jobTitle}.
                They&apos;ll contact you by email.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  function cardHeader() {
    return (
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-xl text-primary">
          <Avatar className="size-8 rounded-xl">
            {company.logoUrl && <AvatarImage src={company.logoUrl} alt="" />}
            <AvatarFallback
              className="rounded-[inherit] bg-primary text-sm text-primary-foreground"
              style={
                company.brandColor
                  ? { backgroundColor: company.brandColor, color: "white" }
                  : undefined
              }
            >
              {initials(company.name)}
            </AvatarFallback>
          </Avatar>
          {company.name}
        </CardDescription>
        <CardTitle className="text-2xl">{jobTitle}</CardTitle>
        {jobDescription && (
          <CardDescription className="whitespace-pre-line">
            {jobDescription}
          </CardDescription>
        )}
      </CardHeader>
    );
  }

  if (!started) {
    return (
      <Card>
        {cardHeader()}
        <CardFooter>
          <Button type="button" onClick={() => setStarted(true)}>
            Apply now
            <ArrowRightIcon />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      {cardHeader()}
      <CardContent className="pt-(--card-spacing)">
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

          {cvMode !== "off" && (
            <Controller
              name="cvFileId"
              control={form.control}
              render={({ field, fieldState }) => (
                <CvStep
                  companySlug={company.slug}
                  jobSlug={jobSlug}
                  required={cvMode === "required"}
                  value={field.value}
                  error={fieldState.error?.message}
                  onChange={(fileId) => answer("cvFileId", fileId)}
                  onBusyChange={(busy) => setStepUploading(CV_STEP, busy)}
                />
              )}
            />
          )}

          {CONTACT_STEPS.map((step) => (
            <Controller
              key={step.name}
              name={step.name}
              control={form.control}
              render={({ field, fieldState }) => (
                <QuestionnaireItem
                  name={step.name}
                  required
                  invalid={fieldState.invalid}
                >
                  <QuestionnaireTitle>{step.title}</QuestionnaireTitle>
                  {"description" in step && (
                    <QuestionnaireDescription>
                      {step.description}
                    </QuestionnaireDescription>
                  )}
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
                  <QuestionnaireError>
                    {fieldState.error?.message ?? step.empty}
                  </QuestionnaireError>
                </QuestionnaireItem>
              )}
            />
          ))}

          {fields.map((field) =>
            field.type === "file" ? (
              <AttachmentStep
                key={field.key}
                form={form}
                field={field}
                companySlug={company.slug}
                jobSlug={jobSlug}
                onAnswer={answer}
                onBusyChange={(busy) => setStepUploading(field.key, busy)}
              />
            ) : field.type === "repeating_group" ? (
              <GroupStep
                key={field.key}
                form={form}
                field={field}
                onAnswer={answer}
              />
            ) : (
              <QuestionStep
                key={field.key}
                form={form}
                field={field}
                onAnswer={answer}
              />
            ),
          )}

          {/* Honeypot. People never see it, so it stays empty; bots that fill in every
          input give themselves away, and the API quietly drops their application.
          Off-screen rather than type="hidden" (which bots skip), hidden from screen
          readers and the Tab key, and named so autofill is unlikely to touch it. */}
          <div
            aria-hidden="true"
            className="absolute left-[-10000px] size-px overflow-hidden"
          >
            <Controller
              name="website"
              control={form.control}
              render={({ field }) => (
                <>
                  <label htmlFor={`${idPrefix}-hp`}>
                    Leave this field empty
                  </label>
                  <input
                    id={`${idPrefix}-hp`}
                    name="farraza-hp"
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
            <QuestionnaireSkip disabled={uploading} />
            <QuestionnaireNext disabled={uploading} />
            <QuestionnaireSubmit disabled={pending || uploading}>
              {pending && <Spinner data-icon="inline-start" />}
              Send application
            </QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </CardContent>
    </Card>
  );
}
