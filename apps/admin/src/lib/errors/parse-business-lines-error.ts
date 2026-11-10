/**
 * Parser for the business-line validation error body (HOS-1873).
 *
 * The generic validation envelope carries `details` as an ARRAY of
 * `{ field, messageKey, code }`. The business-line 400 is different: the API
 * publishes a single cause as `details: { field, reason }` plus
 * `error.reason: 'BUSINESS_LINES_INVALID'`. `parseApiValidationErrors` keeps
 * that shape out of the array path and delegates it here, so the edit and
 * create forms receive a field error for `businessLines` instead of a generic
 * toast.
 *
 * @module parse-business-lines-error
 */

import { resolveValidationMessage } from '@repo/i18n';
import { BUSINESS_LINES_INVALID_REASON } from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for the business-line error body.
 *
 * Accepts both the full response (`{ success, error }`) and a bare error
 * object, mirroring `ApiValidationErrorSchema`.
 */
export const BusinessLinesErrorSchema = z.object({
    success: z.boolean().optional(),
    error: z.object({
        reason: z.string(),
        details: z.object({
            field: z.string(),
            reason: z.string()
        })
    })
});

/** Input for {@link parseBusinessLinesError}. */
export interface ParseBusinessLinesErrorInput {
    /** The raw value caught from a failed API call. */
    readonly error: unknown;
    /** Translation function, normally the `t` from `useTranslations()`. */
    readonly t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * Maps a `BUSINESS_LINES_INVALID` error body to a form-friendly field error.
 *
 * @param input - Raw error and translation function.
 * @returns A one-entry `{ [field]: message }` map, or `{}` when the body is not
 *   a business-line validation error.
 */
export function parseBusinessLinesError({
    error,
    t
}: ParseBusinessLinesErrorInput): Record<string, string> {
    const parsed = BusinessLinesErrorSchema.safeParse(error);

    if (!parsed.success) return {};

    const body = parsed.data.error;
    if (body.reason !== BUSINESS_LINES_INVALID_REASON) return {};

    return {
        [body.details.field]: resolveValidationMessage({
            key: `zodError.venue.businessLines.${body.details.reason}`,
            t
        })
    };
}
