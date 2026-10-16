import type { AnswerValue, FormField } from '@repo/shared';

/**
 * An answer as text for the candidate view, using the question the candidate
 * actually saw (the form version stored with the application). Option ids are
 * turned back into their labels; answers stay readable if the job's current
 * form has since changed.
 */
export function formatAnswer(field: FormField, value: AnswerValue | undefined): string | string[] | null {
  if (value === undefined) {
    return null;
  }
  switch (field.type) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : null;
    case 'yes_no':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'single_select':
      return field.config.options.find((option) => option.id === value)?.label ?? 'Unknown option';
    case 'multi_select':
      return Array.isArray(value)
        ? value.map((id) => field.config.options.find((option) => option.id === id)?.label ?? 'Unknown option')
        : null;
    case 'file':
      // The answer is a file id, which text can't show: the sheet renders the file itself
      // (candidate-file.tsx) and never asks for this.
      return null;
  }
}
