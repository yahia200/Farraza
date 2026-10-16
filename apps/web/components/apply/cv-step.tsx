'use client';

import { useState } from 'react';
import { CV_ACCEPT_HINT, CV_CONTENT_TYPES, checkCvFile } from '@repo/shared';
import {
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import { UploadControl } from './upload-control';

/** What the file chooser offers: extensions as well as types, as some systems report no type for .docx. */
const ACCEPT = ['.pdf', '.docx', ...CV_CONTENT_TYPES].join(',');

const CV_TARGET = { purpose: 'cv' } as const;

/**
 * The CV, the first step of the apply form when the job asks for one (ADR-0002). The title, hint
 * and messages are the CV's; picking, checking and sending the file is `UploadControl`, which
 * the Attachment steps share. Its rules are fixed (`checkCvFile`), not a question's settings.
 */
export function CvStep({
  companySlug,
  jobSlug,
  required,
  value,
  error,
  onChange,
  onBusyChange,
}: {
  companySlug: string;
  jobSlug: string;
  required: boolean;
  /** The uploaded file's id, or null. */
  value: string | null;
  /** The form's message for this step, if any. */
  error?: string;
  onChange: (fileId: string | null) => void;
  /** True while a file is being sent, so the form can hold back Next, Skip and Send. */
  onBusyChange: (busy: boolean) => void;
}) {
  const [sending, setSending] = useState(false);
  const label = required ? 'Upload your CV' : 'Upload your CV (optional)';

  return (
    <QuestionnaireItem name="cvFileId" required={required} invalid={Boolean(error)}>
      <QuestionnaireTitle>{label}</QuestionnaireTitle>
      <QuestionnaireDescription>{CV_ACCEPT_HINT}.</QuestionnaireDescription>

      <UploadControl
        companySlug={companySlug}
        jobSlug={jobSlug}
        target={CV_TARGET}
        accept={ACCEPT}
        check={checkCvFile}
        value={value}
        onChange={onChange}
        onBusyChange={(busy) => {
          setSending(busy);
          onBusyChange(busy);
        }}
      />

      <QuestionnaireError>
        {error ??
          (sending
            ? 'Wait for your CV to finish uploading.'
            : required
              ? 'Upload your CV to continue.'
              : 'Upload your CV, or skip this step.')}
      </QuestionnaireError>
    </QuestionnaireItem>
  );
}
