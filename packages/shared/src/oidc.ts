/*
 * "Sign in with Google" refusals the API and the web app both name.
 */

/**
 * `errorCode` of the API's 403 for a first Google sign-in whose email matches
 * an account that hasn't verified it (apps/api/src/auth/account-linker.ts).
 * The web OIDC callback (apps/web/lib/oidc.ts) matches on it.
 */
export const PASSWORD_SIGN_IN_REQUIRED = 'password_sign_in_required';

/**
 * What to tell the user for that refusal: the API's 403 `message`, and the
 * sign-in page's alert (apps/web/components/auth/google-sign-in-error.tsx).
 */
export const PASSWORD_SIGN_IN_REQUIRED_MESSAGE =
  'An account with this email already exists. Sign in with your password, then connect Google from your account.';
