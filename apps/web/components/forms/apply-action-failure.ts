import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import type { ActionFailure } from '@/lib/action-failure';

/**
 * Puts a Server Action's errors into React Hook Form, so they render in the
 * same <FieldError> slots as client-side ones. Returns the form-level message.
 * API: https://react-hook-form.com/docs/useform/seterror
 */
export function applyActionFailure<T extends FieldValues>(
  form: UseFormReturn<T>,
  failure: ActionFailure<string>,
): string | undefined {
  for (const [name, messages] of Object.entries(failure.fieldErrors ?? {})) {
    if (messages?.length) {
      form.setError(name as Path<T>, { type: 'server', message: messages[0] });
    }
  }
  return failure.formError;
}
