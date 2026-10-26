import type { InputHTMLAttributes } from 'react';
import type { PublicFormField } from '@repo/shared';

/**
 * What the apply page's Number, Date and URL questions share, so `question-step.tsx`,
 * `group-step.tsx` and `apply-values.ts` agree. All three keep the box's text in the form (`''`
 * when blank); the native number and date inputs report `''` for text they can't parse.
 */

type TypedField = Extract<PublicFormField, { type: 'number' | 'date' | 'url' }>;

/** Whether the question is a Number, Date or URL question. */
export function isTypedField<F extends { type: string }>(field: F): field is Extract<F, TypedField> {
  return field.type === 'number' || field.type === 'date' || field.type === 'url';
}

/** Whether the answer is the text of one box (blank is `''`): text questions and the typed three. */
export function isTextBox(field: { type: string }): boolean {
  return field.type === 'short_text' || field.type === 'long_text' || isTypedField(field);
}

/** Input types whose Enter key is cancelled inside an Entry card (it would go to the next step or submit). */
export const ENTER_CANCELLED_INPUT_TYPES = ['text', 'number', 'date', 'url'];

type TypedInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'step' | 'min' | 'max' | 'autoComplete' | 'placeholder'
> & { type: 'number' | 'date' | 'url' };

/** The native input's `type` and limits for a Number, Date or URL question. */
export function typedInputProps(field: TypedField): TypedInputProps {
  switch (field.type) {
    case 'number':
      return {
        type: 'number',
        inputMode: field.config.integerOnly ? 'numeric' : 'decimal',
        step: field.config.integerOnly ? 1 : 'any',
      };
    case 'date':
      return { type: 'date', min: field.config.min ?? undefined, max: field.config.max ?? undefined };
    case 'url':
      return { type: 'url', inputMode: 'url', autoComplete: 'url', placeholder: 'https://' };
  }
}
