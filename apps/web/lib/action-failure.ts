import type { FieldError } from '@repo/shared';

/**
 * What a failed Server Action hands back to its form; success redirects
 * instead. `F` is the form's field names. Safe to import from Client Components.
 */
export interface ActionFailure<F extends string> {
  fieldErrors?: Partial<Record<F, string[]>>;
  formError?: string;
}

/**
 * Puts the API's per-field validation errors (400 `errors[]`, see
 * apps/api/src/common/validation-errors.ts) on the form's fields. Errors for
 * anything else, such as unknown keys, become the form-level message.
 */
export function fromValidationErrors<F extends string>(
  errors: readonly FieldError[] | undefined,
  fields: readonly F[],
): ActionFailure<F> | undefined {
  if (!errors?.length) {
    return undefined;
  }
  const failure: ActionFailure<F> = {};
  for (const { path, message } of errors) {
    const field = path.split('.')[0] as F;
    if (fields.includes(field)) {
      failure.fieldErrors ??= {};
      (failure.fieldErrors[field] ??= []).push(message);
    } else {
      failure.formError = message;
    }
  }
  return failure;
}
