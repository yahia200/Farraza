import type { ForgotPasswordInput, ResetPasswordInput } from '@repo/shared';

/** Validated by StandardSchemaValidationPipe via `@Body({ schema })`. */
export { forgotPasswordSchema, resetPasswordSchema } from '@repo/shared';
export type ForgotPasswordDto = ForgotPasswordInput;
export type ResetPasswordDto = ResetPasswordInput;
