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

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schema for the standardized API validation error envelope
// ---------------------------------------------------------------------------

/**
 * Schema for a single field-level validation detail returned by the API.
 */
export const ApiValidationDetailSchema = z.object({
    /** Dot-notation field path (e.g. "name", "address.city") */
    field: z.string(),
    /** i18n translation key (e.g. "zodError.accommodation.name.min") */
    messageKey: z.string(),
    /** Zod error code (e.g. "TOO_SMALL") */
    code: z.string()
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
     * Translation function. Receives an i18n key and returns the translated
     * string. Falls back to the raw key when the function is unavailable.
     *
     * @param key - i18n key such as `"zodError.accommodation.name.min"`
     */
    readonly t: (key: string) => string;
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
        // Translate the messageKey; fall back to the raw key so the UI never
        // shows an empty string.
        const message = t(detail.messageKey) || detail.messageKey;

        // Last detail for a field wins (consistent with Zod behaviour where
        // only one error per field is surfaced in most cases).
        fieldErrors[detail.field] = message;
    }

    return fieldErrors;
}
