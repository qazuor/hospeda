/**
 * @file ProfileEditForm.helpers.ts
 * @description Shared types + small helpers for the profile edit form
 * subcomponents (SPEC-113 polish).
 */

import type { ProfileEditInput } from '@repo/schemas';

/**
 * Field-level error messages keyed by the schema field name. We extend
 * the inferred `ProfileEditInput` keys with the extra fields the polish
 * round added so the subcomponents can index into the errors object
 * without casting.
 */
export type ProfileEditFieldErrors = Partial<Record<keyof ProfileEditInput, string>>;

/**
 * Resolve field-level Zod error messages into a flat string record so
 * each subcomponent can lookup `fieldErrors.<fieldName>` directly.
 *
 * Zod issues carry a path like `['firstName']`; we keep the first
 * segment (top-level field) and ignore deeper nesting because the
 * profile-edit schema is flat.
 *
 * @param issues - Issues array from a Zod safeParse failure.
 * @returns Map of field-name → first error message for that field.
 */
export function parseZodErrors(
    issues: { path: PropertyKey[]; message: string }[]
): ProfileEditFieldErrors {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !errors[key]) errors[key] = issue.message;
    }
    return errors as ProfileEditFieldErrors;
}
