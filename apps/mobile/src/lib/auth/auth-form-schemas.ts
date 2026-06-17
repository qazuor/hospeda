/**
 * @file auth-form-schemas.ts
 * @description Zod schemas for sign-in and sign-up form validation.
 *
 * These schemas validate user input BEFORE calling Better Auth.
 * Error messages are i18n key references — callers must resolve
 * them via `getTranslation(key, locale)` before displaying.
 *
 * Password strength is enforced via `StrongPasswordSchema` from
 * `@repo/schemas` (root import only — Metro cannot deep-import).
 *
 * @module auth-form-schemas
 */

import { StrongPasswordRegex } from '@repo/schemas';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sign-in schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for the sign-in form.
 *
 * Validates:
 * - `email`: valid RFC-5322 email address
 * - `password`: non-empty string (strength checked by the API on submit)
 *
 * Error messages are i18n keys for `getTranslation(key, locale)`.
 */
export const signInFormSchema = z.object({
    email: z
        .string({ message: 'auth-ui.signIn.errors.emailRequired' })
        .min(1, { message: 'auth-ui.signIn.errors.emailRequired' })
        .email({ message: 'auth-ui.signIn.errors.invalidEmail' }),
    password: z
        .string({ message: 'auth-ui.signIn.errors.passwordRequired' })
        .min(1, { message: 'auth-ui.signIn.errors.passwordRequired' })
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

// ---------------------------------------------------------------------------
// Sign-up schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for the sign-up form.
 *
 * Validates:
 * - `firstName`: non-empty name (sent as `name` to Better Auth)
 * - `email`: valid RFC-5322 email address
 * - `password`: must satisfy `StrongPasswordRegex` (8+ chars, upper, lower, digit, special)
 * - `confirmPassword`: must match `password`
 *
 * Error messages are i18n keys for `getTranslation(key, locale)`.
 */
export const signUpFormSchema = z
    .object({
        firstName: z
            .string({ message: 'auth-ui.signUp.errors.firstNameRequired' })
            .min(1, { message: 'auth-ui.signUp.errors.firstNameRequired' }),
        email: z
            .string({ message: 'auth-ui.signUp.errors.emailRequired' })
            .min(1, { message: 'auth-ui.signUp.errors.emailRequired' })
            .email({ message: 'auth-ui.signUp.errors.invalidEmail' }),
        password: z
            .string({ message: 'auth-ui.signUp.errors.passwordRequired' })
            .min(1, { message: 'auth-ui.signUp.errors.passwordRequired' })
            .min(8, { message: 'auth-ui.signUp.errors.passwordTooShort' })
            .regex(StrongPasswordRegex, { message: 'auth-ui.signUp.errors.weakPassword' }),
        confirmPassword: z
            .string({ message: 'auth-ui.signUp.errors.passwordRequired' })
            .min(1, { message: 'auth-ui.signUp.errors.passwordRequired' })
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'auth-ui.signUp.errors.passwordsDoNotMatch',
        path: ['confirmPassword']
    });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;

// ---------------------------------------------------------------------------
// Error key extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the first field-level Zod error key for a given field name.
 *
 * Returns the i18n key string stored in the Zod issue message, or `undefined`
 * if the field has no issues.
 *
 * @param issues - Zod issue array from `safeParse().error.issues`
 * @param field  - The field path to look up (e.g. `'email'`)
 * @returns The first error key for the field, or `undefined`.
 *
 * @example
 * ```ts
 * const result = signInFormSchema.safeParse(values);
 * if (!result.success) {
 *   const emailError = getFieldError(result.error.issues, 'email');
 *   // 'auth-ui.signIn.errors.invalidEmail'
 * }
 * ```
 */
export function getFieldError(
    issues: ReadonlyArray<z.ZodIssue>,
    field: string
): string | undefined {
    const issue = issues.find((i) => i.path[0] === field);
    return issue?.message;
}
