'use client';

import { useState } from 'react';
import { Controller, type Path, type UseFormReturn } from 'react-hook-form';
import { attachmentHint, checkAttachmentFile, fileAccept, type PublicFormField } from '@repo/shared';
import {
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import type { AnswerInput, ApplyValues } from './apply-values';
import { UploadControl } from './upload-control';

type FileField = Extract<PublicFormField, { type: 'file' }>;

/**
 * A file question (an Attachment) as a questionnaire step. Same shape as the CV step: the title,
 * help text and the question's own limits (`field.config`) are shown here, and `UploadControl` does
 * the picking, checking against those limits, and sending. The answer is the file's id.
 */
export function AttachmentStep({
  form,
  field,
  companySlug,
  jobSlug,
  onAnswer,
  onBusyChange,
}: {
  form: UseFormReturn<ApplyValues>;
  field: FileField;
  companySlug: string;
  jobSlug: string;
  /** Sets the value and re-checks the step if it currently shows an error. */
  onAnswer: (path: Path<ApplyValues>, value: AnswerInput) => void;
  /** True while this question's file is being sent, so the form can hold back Next, Skip and Send. */
  onBusyChange: (busy: boolean) => void;
}) {
  const [sending, setSending] = useState(false);
  const path = `answers.${field.key}` as const;
  const label = field.required ? field.label : `${field.label} (optional)`;

  return (
    <Controller
      name={path}
      control={form.control}
      render={({ field: input, fieldState }) => (
        <QuestionnaireItem name={field.key} required={field.required} invalid={fieldState.invalid}>
          <QuestionnaireTitle>{label}</QuestionnaireTitle>
          {field.helpText && <QuestionnaireDescription>{field.helpText}</QuestionnaireDescription>}
          <QuestionnaireDescription>{attachmentHint(field.config)}.</QuestionnaireDescription>

          <UploadControl
            companySlug={companySlug}
            jobSlug={jobSlug}
            target={{ purpose: 'answer', fieldKey: field.key }}
            accept={fileAccept(field.config.kinds)}
            check={(file) => checkAttachmentFile(field.config, file)}
            value={typeof input.value === 'string' ? input.value : null}
            onChange={(fileId) => onAnswer(path, fileId)}
            onBusyChange={(busy) => {
              setSending(busy);
              onBusyChange(busy);
            }}
          />

          <QuestionnaireError>
            {fieldState.error?.message ??
              (sending
                ? 'Wait for your file to finish uploading.'
                : field.required
                  ? 'Upload a file to continue.'
                  : 'Upload a file, or skip this question.')}
          </QuestionnaireError>
        </QuestionnaireItem>
      )}
    />
  );
}
