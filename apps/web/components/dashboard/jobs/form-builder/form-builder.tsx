"use client";

import { useMemo, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArchiveRestoreIcon, PlusIcon } from "lucide-react";
import {
  cvModeSchema,
  formFieldsSchema,
  MAX_FIELDS,
  type CvMode,
  type FieldError,
  type FormFields,
} from "@repo/shared";
import { publishForm, saveFormDraft } from "@/app/actions/forms";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { CvCard } from "./cv-card";
import { BUILDER_TYPES, FIELD_TYPES, newField, type BuilderFieldType } from "./field-types";
import { PRESETS, type Preset } from "./presets";
import { QuestionCard, type BuilderValues } from "./question-card";
import { useFormBackup } from "./use-form-backup";

/** The builder validates with the same shared schemas the API uses (packages/shared/src/form-fields.ts, cv-mode.ts). */
const builderSchema = z.object({
  fields: formFieldsSchema,
  cvMode: cvModeSchema,
});

export interface FormStatus {
  /** Latest published version number, if any. */
  publishedVersion: number | null;
  /** Whether the server has a draft with unpublished changes. */
  hasDraft: boolean;
}

/**
 * The application form builder. One React Hook Form for the CV setting and the whole question
 * list (useFieldArray), validated by zodResolver(builderSchema), with
 * explicit "Save draft" and "Publish" and a local backup of unsaved changes.
 */
export function FormBuilder({
  companySlug,
  jobSlug,
  initialFields,
  initialCvMode,
  status,
  canEdit,
}: {
  companySlug: string;
  jobSlug: string;
  initialFields: FormFields;
  initialCvMode: CvMode;
  status: FormStatus;
  canEdit: boolean;
}) {
  const form = useForm<BuilderValues>({
    resolver: zodResolver(builderSchema),
    defaultValues: { fields: initialFields, cvMode: initialCvMode },
  });
  // RHF gives each row its own `id` for React keys; questions use `key`, so the two don't clash.
  const {
    fields: rows,
    append,
    move,
    remove,
    replace,
  } = useFieldArray({ control: form.control, name: "fields" });
  const values = useWatch({ control: form.control, name: "fields" });
  const cvMode = useWatch({ control: form.control, name: "cvMode" });
  const { isDirty } = form.formState;

  const [justAdded, setJustAdded] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [formError, setFormError] = useState<string>();

  // --- Local backup of unsaved changes -------------------------------------
  const { backup, clear } = useFormBackup({
    key: `farraza:form-backup:${companySlug}/${jobSlug}`,
    fields: values,
    cvMode,
    isDirty,
  });
  const [backupHandled, setBackupHandled] = useState(false);
  const backupDiffers = useMemo(
    () =>
      backup !== null &&
      (JSON.stringify(backup.fields) !== JSON.stringify(initialFields) ||
        (backup.cvMode ?? initialCvMode) !== initialCvMode),
    [backup, initialFields, initialCvMode],
  );
  // Only offered before you start editing; editing is locked until you choose.
  const offerRestore = canEdit && !backupHandled && !isDirty && backupDiffers;

  function restoreBackup() {
    if (!backup) return;
    replace(backup.fields);
    // Either call may be the only difference from the saved version; each marks the form dirty.
    form.setValue("cvMode", backup.cvMode ?? initialCvMode, {
      shouldDirty: true,
    });
    setBackupHandled(true);
  }

  function discardBackup() {
    clear();
    setBackupHandled(true);
  }

  // --- Save / publish ------------------------------------------------------
  /** Puts the server's errors (paths relative to the list) onto the inputs. */
  function applyErrors(
    errors: FieldError[] | undefined,
    message: string | undefined,
  ) {
    for (const error of errors ?? []) {
      form.setError(`fields.${error.path}` as "fields", {
        type: "server",
        message: error.message,
      });
    }
    setFormError(message);
  }

  const save = form.handleSubmit((data) =>
    startSaving(async () => {
      setFormError(undefined);
      const result = await saveFormDraft(companySlug, jobSlug, {
        fields: data.fields,
        cvMode: data.cvMode,
      });
      if (result.ok) {
        form.reset(data); // The saved version is the new baseline.
        clear();
        toast.add({
          type: "success",
          title: "Draft saved",
          description: "Publish it when you’re ready for applicants to see it.",
        });
        return;
      }
      applyErrors(result.fieldErrors, result.formError);
    }),
  );

  // Validate first (unsaved changes get saved as part of publishing), then confirm.
  const askToPublish = form.handleSubmit(() => setConfirmPublish(true));

  function publish() {
    startSaving(async () => {
      setFormError(undefined);
      const content = form.getValues();
      const result = await publishForm(
        companySlug,
        jobSlug,
        isDirty ? content : null,
      );
      setConfirmPublish(false);
      if (result.ok) {
        form.reset(content);
        clear();
        toast.add({
          type: "success",
          title: "Form published",
          description: "New applicants will see this version.",
        });
        return;
      }
      applyErrors(result.fieldErrors, result.formError);
    });
  }

  const canPublish = isDirty || status.hasDraft;
  const editable = canEdit && !offerRestore;

  function add(type: BuilderFieldType) {
    const field = newField(type);
    append(field);
    setJustAdded(field.key);
  }

  /** Inserts a copy of a Preset; the menu greys it out while the form has it (see the menu). */
  function addPreset(preset: Preset) {
    const field = preset.build();
    append(field);
    setJustAdded(field.key);
  }

  return (
    <div className="flex flex-col gap-4">
      {offerRestore && backup && (
        <Alert className="bg-warning/10 p-4 text-warning-foreground">
          <ArchiveRestoreIcon data-icon="inline-start" />
          <AlertTitle>
            You have unsaved changes from{" "}
            {new Date(backup.savedAt).toLocaleString()}
          </AlertTitle>
          <AlertDescription>
            They were kept on this device. Restore them, or discard them to edit
            the saved version.
          </AlertDescription>
          <AlertAction className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={discardBackup}>
              Discard
            </Button>
            <Button size="sm" variant="outline" onClick={restoreBackup}>
              Restore
            </Button>
          </AlertAction>
        </Alert>
      )}
      {/* Status and actions */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* The CV step comes before the questions in the apply form, so its card does too. */}
        <CvCard
          control={form.control}
          readOnly={!canEdit}
          disabled={offerRestore}
        />

        <div className="flex flex-wrap items-center bg-card border rounded-2xl justify-between gap-3 h-full p-4">
          <p className="text-sm" aria-live="polite">
            {status.publishedVersion
              ? `Published version ${status.publishedVersion}`
              : "Not published yet"}
            {(isDirty || status.hasDraft) && (
              <span className="text-muted-foreground">
                {" · "}
                {isDirty ? "Unsaved changes" : "Draft has unpublished changes"}
              </span>
            )}
          </p>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={save}
                disabled={!isDirty || saving || offerRestore}
              >
                {saving && !confirmPublish && (
                  <Spinner data-icon="inline-start" />
                )}
                Save draft
              </Button>
              <Button
                variant="secondary"
                onClick={askToPublish}
                disabled={!canPublish || saving || offerRestore}
              >
                Publish
              </Button>
            </div>
          )}
        </div>
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground px-4 -mb-3">
        Every application also asks for the candidate&apos;s name, email and
        phone number.{" "}
      </p>

      {/* The questions */}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="sr-only">Questions</legend>
        {rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No questions yet</EmptyTitle>
              <EmptyDescription>
                {canEdit
                  ? "Add one below, or publish as is to ask only for contact details."
                  : "Applicants are only asked for their contact details."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          rows.map((row, index) => (
            <QuestionCard
              key={row.id}
              form={form}
              index={index}
              count={rows.length}
              onMove={move}
              onRemove={remove}
              // Viewers (e.g. interviewers) can open and read questions; the restore banner locks editing for a moment.
              readOnly={!canEdit}
              disabled={offerRestore}
              // rows (from useFieldArray) already hold the new question on this render;
              // useWatch values catch up a moment later, too late for the initial open state.
              defaultOpen={row.key === justAdded}
            />
          ))
        )}
      </fieldset>

      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="self-start"
                disabled={rows.length >= MAX_FIELDS}
              />
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add question
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Question type
              </DropdownMenuLabel>
              {BUILDER_TYPES.map((type) => {
                const { label, icon: Icon } = FIELD_TYPES[type];
                return (
                  <DropdownMenuItem key={type} onClick={() => add(type)}>
                    <Icon />
                    {label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Presets
              </DropdownMenuLabel>
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <DropdownMenuItem
                    key={preset.presetKey}
                    // A Preset appears once per form (the schema refuses a second one), so it is
                    // greyed out while a question on the form carries its key.
                    disabled={values.some(
                      (field) => field.presetKey === preset.presetKey,
                    )}
                    onClick={() => addPreset(preset)}
                  >
                    <Icon />
                    {preset.menuLabel}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog
        open={confirmPublish}
        onOpenChange={(open) => !saving && setConfirmPublish(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this form?</AlertDialogTitle>
            <AlertDialogDescription>
              New applicants will see it from now on. People who already applied
              keep the answers they gave to the version they saw.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={publish} disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
