import { z } from 'zod';

/*
 * Request bodies for the API's /auth endpoints, also used by the web forms.
 * `strictObject` rejects unknown keys (the API's old `forbidNonWhitelisted`).
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const signUpSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2, { error: 'Name must be at least 2 characters.' })
    .max(100, { error: 'Name must be 100 characters or fewer.' }),
  email: z.email({ error: 'Enter a valid email address.' }),
  // Not trimmed: spaces can be a deliberate part of a password.
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    })
    .max(PASSWORD_MAX_LENGTH, {
      error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.strictObject({
  email: z.email({ error: 'Enter a valid email address.' }),
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** "Forgot your password?": just the address a reset link is sent to. */
export const forgotPasswordSchema = z.strictObject({
  email: z.email({ error: 'Enter a valid email address.' }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** The reset link's token, and the new password under the sign-up rules. */
export const resetPasswordSchema = z.strictObject({
  token: z.string().min(1, { error: 'This reset link is missing its token.' }),
  // Not trimmed: spaces can be a deliberate part of a password.
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    })
    .max(PASSWORD_MAX_LENGTH, {
      error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** The token a verification link carries, POSTed back by the page it opens. */
export const verifyEmailSchema = z.strictObject({
  token: z.string().min(1, { error: 'This verification link is missing its token.' }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
