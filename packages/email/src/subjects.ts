/**
 * Subject lines of the auth emails sent through `@repo/email`.
 *
 * They live next to their templates so the production sender
 * (`apps/api/src/lib/auth.ts`) and the admin email preview read the same
 * string (HOS-2519 D6). Owner-approved copy: do not edit casually.
 *
 * @module subjects
 */

/** Subject of the password reset email ({@link ResetPasswordTemplate}). */
export const RESET_PASSWORD_EMAIL_SUBJECT = 'Restablece tu contraseña de Hospeda';

/** Subject of the account verification email ({@link VerifyEmailTemplate}). */
export const VERIFY_EMAIL_SUBJECT = 'Verifica tu cuenta de Hospeda';
