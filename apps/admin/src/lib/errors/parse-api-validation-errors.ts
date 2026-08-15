/**
 * Utility for parsing API validation error responses into form-friendly field error maps.
 *
 * The API returns a standardized validation error envelope (since T-003/T-005):
 *
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "messageKey": "validationError.validation.failed",
 *     "details": [
 *       { "field": "name", "messageKey": "zodError.accommodation.name.min", "code": "TOO_SMALL" }
 *     ],
 *     "summary": { "totalErrors": 1, "fieldCount": 1 },
 *     "userFriendlyMessage": "Please fix the validation error below"
 *   }
 * }
 * ```
 *
 * `parseApiValidationErrors` extracts the `details` array and translates each
 * `messageKey` via the provided `t` function, returning a plain
 * `Record<string, string>` suitable for wiring into React Hook Form's
 * `setError` or any field-error display pattern.
 *
 * @module parse-api-validation-errors
 */

import { resolveValidationMessage } from '@repo/i18n';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schema for the standardized API validation error envelope
// ---------------------------------------------------------------------------

/**
 * Schema for a single field-level validation detail returned by the API.
 *
 * Mirrors `TransformedValidationError` (`apps/api/src/utils/zod-error-types.ts`).
 * `params` and `userFriendlyMessage` are optional because older/handcrafted
 * error bodies omit them, but the route factory always sends both.
 */
export const ApiValidationDetailSchema = z.object({
    /** Dot-notation field path (e.g. "name", "address.city") */
    field: z.string(),
    /** i18n translation key (e.g. "zodError.accommodation.name.min") */
    messageKey: z.string(),
    /** Zod error code (e.g. "TOO_SMALL") */
    code: z.string(),
    /** Interpolation params extracted from the Zod issue (min, max, expected, …) */
    params: z.record(z.string(), z.unknown()).optional(),
    /** English, human-readable message built by the API from the Zod issue */
    userFriendlyMessage: z.string().optional()
});

/**
 * Schema for the validation error summary block.
 */
export const ApiValidationSummarySchema = z
    .object({
        totalErrors: z.number(),
        fieldCount: z.number()
    })
    .nullable();

/**
 * Schema for the `error` object inside a validation error API response.
 */
export const ApiValidationErrorBodySchema = z.object({
    code: z.string(),
    messageKey: z.string(),
    details: z.array(ApiValidationDetailSchema).default([]),
    summary: ApiValidationSummarySchema.default(null),
    userFriendlyMessage: z.string().optional()
});

/**
 * Schema for the full API validation error response envelope.
 *
 * Accepts both the full response (`{ success, error }`) and bare error objects
 * so callers can pass whatever shape they catch from `fetchApi`.
 */
export const ApiValidationErrorSchema = z.object({
    success: z.boolean().optional(),
    error: ApiValidationErrorBodySchema
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

/** Single field-level validation detail from the API */
export type ApiValidationDetail = z.infer<typeof ApiValidationDetailSchema>;

/** Validated API validation error envelope */
export type ApiValidationError = z.infer<typeof ApiValidationErrorSchema>;

// ---------------------------------------------------------------------------
// parseApiValidationErrors
// ---------------------------------------------------------------------------

/**
 * Input for `parseApiValidationErrors`.
 */
export interface ParseApiValidationErrorsInput {
    /**
     * The raw value caught from a failed API call. Expected to conform to
     * `ApiValidationErrorSchema`, but the function degrades gracefully when
     * it does not.
     */
    readonly error: unknown;
    /**
     * Translation function, normally the `t` from `useTranslations()`.
     * Receives an i18n key plus optional interpolation params.
     *
     * @param key - i18n key such as `"validation.accommodation.name.min"`
     * @param params - interpolation params such as `{ min: 2 }`
     */
    readonly t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * Resolve one API detail into the string the editor actually reads.
 *
 * The API reports keys in the `zodError.*` / `validationError.*` namespaces,
 * while the catalogue stores them under `validation.*`. Calling `t()` on the
 * reported key therefore ALWAYS misses — that was H-27, and it turned every
 * admin validation error into `[MISSING: zodError.…]`. `resolveValidationMessage`
 * is the single place that performs that rewrite, so this path must go
 * through it, exactly like the client-side `validateFormWithZod` does.
 *
 * Fallback order, so nothing ever renders empty or as a bare key:
 * 1. the localized string (with the API's `params` interpolated),
 * 2. the API's English `userFriendlyMessage`,
 * 3. the raw key.
 *
 * @param detail - One entry of the API's `error.details` array
 * @param t - Translation function from `useTranslations()`
 * @returns Message ready to render
 */
function resolveDetailMessage(
    detail: ApiValidationDetail,
    t: (key: string, params?: Record<string, unknown>) => string
): string {
    const resolved = resolveValidationMessage({
        key: detail.messageKey,
        t,
        params: detail.params
    });

    // `resolveValidationMessage` echoes the key back on a dictionary miss.
    if (resolved && resolved !== detail.messageKey) {
        return resolved;
    }

    return detail.userFriendlyMessage || detail.messageKey;
}

/**
 * Parse a standardized API validation error response and return a
 * `Record<string, string>` mapping each field path to its translated
 * error message.
 *
 * Returns an empty object when:
 * - `error` does not match `ApiValidationErrorSchema`
 * - `details` is empty or absent
 *
 * @example
 * ```typescript
 * import { parseApiValidationErrors } from '@/lib/errors/parse-api-validation-errors';
 *
 * const fieldErrors = parseApiValidationErrors({ error: caughtError, t });
 * for (const [field, message] of Object.entries(fieldErrors)) {
 *   form.setError(field, { message });
 * }
 * ```
 */
export function parseApiValidationErrors({
    error,
    t
}: ParseApiValidationErrorsInput): Record<string, string> {
    const parsed = ApiValidationErrorSchema.safeParse(error);

    if (!parsed.success) {
        return {};
    }

    const { details } = parsed.data.error;

    if (details.length === 0) {
        return {};
    }

    const fieldErrors: Record<string, string> = {};

    for (const detail of details) {
        // Last detail for a field wins (consistent with Zod behaviour where
        // only one error per field is surfaced in most cases).
        fieldErrors[detail.field] = resolveDetailMessage(detail, t);
    }

    return fieldErrors;
}
