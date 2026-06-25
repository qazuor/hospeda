/**
 * @file ProfileEditForm.helpers.ts
 * @description Shared types + small helpers for the profile edit form
 * subcomponents (SPEC-113 polish).
 */

import { resolveValidationMessage } from '@repo/i18n/web';
import type { ProfileEditInput } from '@repo/schemas';

/**
 * Field-level error messages keyed by the schema field name. We extend
 * the inferred `ProfileEditInput` keys with the extra fields the polish
 * round added so the subcomponents can index into the errors object
 * without casting.
 */
export type ProfileEditFieldErrors = Partial<Record<keyof ProfileEditInput, string>>;

/**
 * Minimal shape of a Zod issue this helper reads. `message` carries an i18n
 * KEY (e.g. `'zodError.user.profile.displayName.min'`) rather than literal
 * text — the schema in `@repo/schemas` sets those keys. `minimum`/`maximum`
 * are present on too_small / too_big issues and feed the `{{min}}` / `{{max}}`
 * interpolation params.
 */
type ZodIssueLike = {
    readonly path: PropertyKey[];
    readonly message: string;
    readonly minimum?: number | bigint;
    readonly maximum?: number | bigint;
};

/**
 * Resolve field-level Zod issues into a flat record of LOCALIZED messages so
 * each subcomponent can look up `fieldErrors.<fieldName>` directly.
 *
 * The schema stores i18n keys (`zodError.*`) in each issue's `message`; left
 * raw, the form would display the literal key (BETA-39). We route every key
 * through `resolveValidationMessage` (which maps `zodError.*` → `validation.*`
 * and translates), forwarding `min`/`max` interpolation params extracted from
 * the issue.
 *
 * Zod issues carry a path like `['firstName']`; we keep the first segment
 * (top-level field) and ignore deeper nesting because the profile-edit schema
 * is flat.
 *
 * @param issues - Issues array from a Zod safeParse failure.
 * @param t - Translation function (key + optional interpolation params).
 * @returns Map of field-name → localized error message for that field.
 */
export function parseZodErrors(
    issues: ZodIssueLike[],
    t: (key: string, params?: Record<string, unknown>) => string
): ProfileEditFieldErrors {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of issues) {
        const key = String(issue.path[0] ?? '');
        if (!key || errors[key]) continue;
        const params: Record<string, unknown> = {};
        if (issue.minimum !== undefined) params.min = Number(issue.minimum);
        if (issue.maximum !== undefined) params.max = Number(issue.maximum);
        errors[key] = resolveValidationMessage({ key: issue.message, t, params });
    }
    return errors as ProfileEditFieldErrors;
}
