import type { SignInInput, SignUpInput } from '@repo/shared';

/** Validated by StandardSchemaValidationPipe via `@Body({ schema })`. */
export { signInSchema, signUpSchema } from '@repo/shared';
export type SignUpDto = SignUpInput;
export type SignInDto = SignInInput;
