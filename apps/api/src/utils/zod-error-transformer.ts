/**
 * Zod Error Transformer
 *
 * Entry point for the Zod error transformation pipeline. Re-exports all public
 * types from {@link ./zod-error-types} so that existing callers do not need to
 * update their import paths.
 *
 * The transformation is split across three files:
 * - `zod-error-types.ts`    — public interfaces + lookup maps
 * - `zod-error-messages.ts` — generateUserFriendlyMessage / generateSuggestion / generateOverallMessage
 * - `zod-error-transformer.ts` (this file) — transformZodError + extractErrorParams + formatters
 *
 * @module zod-error-transformer
 */

import type { ZodError, ZodIssue } from 'zod';
import {
    generateOverallMessage,
    generateSuggestion,
    generateUserFriendlyMessage
} from './zod-error-messages';
import {
    type TransformedValidationError,
    type ValidationErrorResponse,
    type ValidationErrorSummary,
    ZOD_ERROR_CODE_MAP,
    ZOD_ERROR_MESSAGE_MAP
} from './zod-error-types';

// Re-export types for backward compatibility
export type { TransformedValidationError, ValidationErrorResponse, ValidationErrorSummary };

// ---------------------------------------------------------------------------
// Internal extended ZodIssue types (Zod attaches these at runtime)
// ---------------------------------------------------------------------------

/**
 * Extended ZodIssue with properties specific to size constraint errors (too_small / too_big).
 */
type ZodSizeIssue = ZodIssue & {
    minimum?: number;
    maximum?: number;
    inclusive?: boolean;
    origin?: string;
    type?: string;
};

/**
 * Extended ZodIssue with properties for type mismatch errors (invalid_type).
 */
type ZodTypeIssue = ZodIssue & {
    expected?: string;
    received?: string;
};

/**
 * Extended ZodIssue for invalid_union errors (Zod v4).
 */
type ZodUnionIssue = ZodIssue & {
    unionErrors?: Array<{ issues: ZodIssue[] }>;
};

/**
 * Extended ZodIssue for invalid_key errors (Zod v4).
 */
type ZodKeyIssue = ZodIssue & {
    key?: string;
};

/**
 * Extended ZodIssue for invalid_element errors (Zod v4).
 */
type ZodElementIssue = ZodIssue & {
    key?: number;
};

/**
 * Extended ZodIssue with miscellaneous extra properties that Zod may attach.
 */
type ZodMiscIssue = ZodIssue & {
    exact?: unknown;
    options?: unknown[];
    keys?: string[];
};

/**
 * Internal params object that may carry an internal _inferredType marker.
 */
interface ParamsWithInternal extends Record<string, unknown> {
    _inferredType?: string;
}

// ---------------------------------------------------------------------------
// extractErrorParams
// ---------------------------------------------------------------------------

/**
 * Extracts parameters from a Zod issue for richer error context.
 *
 * The returned object contains a private `_inferredType` field that is used
 * by message generators but stripped before being exposed in the public API.
 *
 * @param error - The original ZodIssue to extract params from
 */
const extractErrorParams = (error: ZodIssue): ParamsWithInternal => {
    const params: ParamsWithInternal = {};

    let inferredType: string | undefined;

    if (error.code === 'too_small' || error.code === 'too_big') {
        const sizeIssue = error as ZodSizeIssue;
        if (sizeIssue.type !== undefined) {
            inferredType = sizeIssue.type;
        } else if (sizeIssue.origin !== undefined) {
            inferredType = sizeIssue.origin;
        } else {
            inferredType = 'string';
        }
    }

    params._inferredType = inferredType;

    if (error.code === 'too_small') {
        const sizeIssue = error as ZodSizeIssue;
        if (sizeIssue.minimum !== undefined) params.min = sizeIssue.minimum;
        if (sizeIssue.inclusive !== undefined) params.inclusive = sizeIssue.inclusive;
    }

    if (error.code === 'too_big') {
        const sizeIssue = error as ZodSizeIssue;
        if (sizeIssue.maximum !== undefined) params.max = sizeIssue.maximum;
        if (sizeIssue.inclusive !== undefined) params.inclusive = sizeIssue.inclusive;
    }

    if (error.code === 'invalid_type') {
        const typeIssue = error as ZodTypeIssue;
        if (typeIssue.expected !== undefined) params.expected = typeIssue.expected;
        if (typeIssue.received !== undefined) params.received = typeIssue.received;

        if (!params.received && error.message.includes('received ')) {
            const receivedMatch = error.message.match(/received (\w+)/);
            if (receivedMatch) {
                params.received = receivedMatch[1];
            }
        }
    }

    if (error.code === 'invalid_union') {
        const unionIssue = error as ZodUnionIssue;
        if (unionIssue.unionErrors !== undefined) {
            params.branchCount = unionIssue.unionErrors.length;
        }
    }

    if (error.code === 'invalid_key') {
        const keyIssue = error as ZodKeyIssue;
        if (keyIssue.key !== undefined) params.key = keyIssue.key;
    }

    if (error.code === 'invalid_element') {
        const elementIssue = error as ZodElementIssue;
        if (elementIssue.key !== undefined) params.index = elementIssue.key;
    }

    const miscIssue = error as ZodMiscIssue;
    if (miscIssue.exact !== undefined) params.exact = miscIssue.exact;
    if (miscIssue.options !== undefined) params.options = miscIssue.options;
    if (miscIssue.keys !== undefined) params.keys = miscIssue.keys;

    return params;
};

// ---------------------------------------------------------------------------
// formatFieldName
// ---------------------------------------------------------------------------

/**
 * Capitalizes the first letter of a field name for user-friendly display.
 * Converts camelCase to spaced words: "firstName" → "First name".
 * Handles nested dot-notation paths: "user.profile.name" → "Name".
 *
 * @param fieldPath - Dot-notation field path
 */
const formatFieldName = (fieldPath: string): string => {
    if (!fieldPath) return 'Field';

    const parts = fieldPath.split('.');
    const lastPart = parts[parts.length - 1] || 'Field';

    const formatted = lastPart
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());

    return formatted;
};

// ---------------------------------------------------------------------------
// createErrorSummary
// ---------------------------------------------------------------------------

/**
 * Creates an aggregated summary of the validation error details.
 *
 * @param details - Array of transformed per-field errors
 */
const createErrorSummary = (details: TransformedValidationError[]): ValidationErrorSummary => {
    const errorsByField: Record<string, number> = {};
    const errorCodes: Record<string, number> = {};

    for (const detail of details) {
        const fieldKey = detail.field || 'unknown';
        errorsByField[fieldKey] = (errorsByField[fieldKey] || 0) + 1;
        errorCodes[detail.code] = (errorCodes[detail.code] || 0) + 1;
    }

    const mostCommonError =
        Object.entries(errorCodes).sort(([, a], [, b]) => b - a)[0]?.[0] || 'UNKNOWN';

    return {
        totalErrors: details.length,
        fieldCount: Object.keys(errorsByField).length,
        errorsByField,
        mostCommonError
    };
};

// ---------------------------------------------------------------------------
// transformZodError
// ---------------------------------------------------------------------------

/**
 * Transforms a ZodError into our enhanced standardized format.
 *
 * The result contains:
 * - `details`: per-field error objects with i18n keys, user-friendly messages,
 *   extracted params, and suggestions
 * - `summary`: aggregated statistics
 * - `userFriendlyMessage`: overall summary message
 *
 * @param error - The ZodError instance thrown by Zod's `parse` / `parseAsync`
 */
export const transformZodError = (error: ZodError): ValidationErrorResponse => {
    const details: TransformedValidationError[] = error.issues.map(
        (err: ZodIssue, _index: number) => {
            const zodCode = err.code;
            const fieldPath = err.path.join('.');
            const fieldName = formatFieldName(fieldPath);

            const standardizedCode = ZOD_ERROR_CODE_MAP[zodCode] || 'UNKNOWN_VALIDATION_ERROR';
            const translationKey =
                ZOD_ERROR_MESSAGE_MAP[zodCode] || 'validationError.field.unknown';

            const paramsWithInternal = extractErrorParams(err);
            const { _inferredType: inferredType, ...params } = paramsWithInternal;

            const userFriendlyMessage = generateUserFriendlyMessage(
                err,
                fieldName,
                params,
                inferredType
            );
            const suggestion = generateSuggestion(err, fieldName, params, inferredType);

            return {
                field: fieldPath,
                messageKey: err.message.startsWith('zodError.') ? err.message : translationKey,
                zodMessage: err.message,
                userFriendlyMessage,
                code: standardizedCode,
                params: Object.keys(params).length > 0 ? params : undefined,
                suggestion
            };
        }
    );

    const summary = createErrorSummary(details);
    const overallMessage = generateOverallMessage(summary);

    return {
        code: 'VALIDATION_ERROR',
        messageKey: 'validationError.validation.failed',
        zodMessage: 'Validation failed',
        userFriendlyMessage: overallMessage,
        details,
        summary
    };
};
