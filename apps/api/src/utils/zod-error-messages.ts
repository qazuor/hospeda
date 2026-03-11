/**
 * Zod Error Transformer — Message Generators
 *
 * Provides pure functions that convert Zod issue details into human-readable
 * English messages and actionable suggestions. No i18n — the output is used
 * for the `userFriendlyMessage` and `suggestion` fields of the standardized
 * error response before it is serialized to JSON.
 *
 * @module zod-error-messages
 */

import type { ZodIssue } from 'zod';
import type { ValidationErrorSummary } from './zod-error-types';

// ---------------------------------------------------------------------------
// Internal extended ZodIssue types (Zod attaches these at runtime)
// ---------------------------------------------------------------------------

type ZodFormatIssue = ZodIssue & {
    format?: string;
};

type ZodStringValidationIssue = ZodIssue & {
    validation?: string;
};

type ZodValueIssue = ZodIssue & {
    values?: unknown[];
};

// ---------------------------------------------------------------------------
// generateUserFriendlyMessage
// ---------------------------------------------------------------------------

/**
 * Generates a user-friendly error message based on Zod error details.
 * All messages are in English and suitable for display without further
 * translation (though the `messageKey` field exists for i18n consumers).
 *
 * @param error     - The original ZodIssue
 * @param fieldName - Formatted field name (e.g. "First name")
 * @param params    - Extracted params from {@link extractErrorParams}
 * @param inferredType - Inferred type from the Zod issue (string | number | array)
 */
export const generateUserFriendlyMessage = (
    error: ZodIssue,
    fieldName: string,
    params: Record<string, unknown>,
    inferredType?: string
): string => {
    const { code } = error;

    switch (code as string) {
        case 'too_small': {
            const min = params.min;
            const type = inferredType;

            if (min !== undefined && type === 'string') {
                return `${fieldName} must be at least ${min} characters long`;
            }
            if (min !== undefined && type === 'number') {
                return `${fieldName} must be at least ${min}`;
            }
            if (min !== undefined && type === 'array') {
                return `${fieldName} must contain at least ${min} item(s)`;
            }
            return `${fieldName} is too small`;
        }

        case 'too_big': {
            const max = params.max;
            const type = inferredType;

            if (max !== undefined && type === 'string') {
                return `${fieldName} cannot exceed ${max} characters`;
            }
            if (max !== undefined && type === 'number') {
                return `${fieldName} cannot be greater than ${max}`;
            }
            if (max !== undefined && type === 'array') {
                return `${fieldName} cannot contain more than ${max} item(s)`;
            }
            return `${fieldName} is too big`;
        }

        case 'invalid_type': {
            const expected = params.expected || 'unknown';
            const received = params.received || 'unknown';

            if (expected === 'string') {
                return `${fieldName} must be text (received ${received})`;
            }
            if (expected === 'number') {
                return `${fieldName} must be a number (received ${received})`;
            }
            if (expected === 'boolean') {
                return `${fieldName} must be true or false (received ${received})`;
            }
            if (expected === 'array') {
                return `${fieldName} must be a list (received ${received})`;
            }
            if (expected === 'object') {
                return `${fieldName} must be an object (received ${received})`;
            }
            return `${fieldName} has the wrong type. Expected ${expected}, received ${received}`;
        }

        case 'invalid_format': {
            const format = (error as ZodFormatIssue).format;
            if (format === 'email') {
                return `${fieldName} must be a valid email address`;
            }
            if (format === 'url') {
                return `${fieldName} must be a valid web address (URL)`;
            }
            if (format === 'uuid') {
                return `${fieldName} must be a valid UUID format`;
            }
            return `${fieldName} format is invalid`;
        }

        case 'invalid_string': {
            const validation = (error as ZodStringValidationIssue).validation;
            if (validation) {
                if (validation === 'email') {
                    return `${fieldName} must be a valid email address`;
                }
                if (validation === 'url') {
                    return `${fieldName} must be a valid web address (URL)`;
                }
                if (validation === 'uuid') {
                    return `${fieldName} must be a valid UUID format`;
                }
                if (validation === 'regex') {
                    return `${fieldName} format is invalid`;
                }
            }
            return `${fieldName} format is invalid`;
        }

        case 'invalid_enum_value': {
            const options = params.options;
            const optionsText = Array.isArray(options) ? options.join(', ') : 'valid options';
            return `${fieldName} must be one of: ${optionsText}`;
        }

        case 'invalid_value': {
            const values = (error as ZodValueIssue).values;
            const optionsText = Array.isArray(values) ? values.join(', ') : 'valid options';
            return `${fieldName} must be one of: ${optionsText}`;
        }

        case 'unrecognized_keys': {
            const keys = params.keys;
            const keysText = Array.isArray(keys) ? keys.join(', ') : 'unknown keys';
            return `Unexpected field(s): ${keysText}`;
        }

        case 'invalid_union': {
            const branchCount = params.branchCount;
            if (typeof branchCount === 'number' && branchCount > 0) {
                return `${fieldName} did not match any of the ${branchCount} allowed formats`;
            }
            return `${fieldName} did not match any of the allowed formats`;
        }

        case 'invalid_key':
            return `${fieldName} contains an invalid key`;

        case 'invalid_element': {
            const index = params.index;
            if (typeof index === 'number') {
                return `${fieldName} contains an invalid element at index ${index}`;
            }
            return `${fieldName} contains an invalid element`;
        }

        case 'custom':
            // Use the original message for custom validations as they're usually already user-friendly
            return error.message;

        default:
            return `${fieldName} is invalid`;
    }
};

// ---------------------------------------------------------------------------
// generateSuggestion
// ---------------------------------------------------------------------------

/**
 * Generates an actionable suggestion to help the user fix the validation error.
 * Returns `undefined` when no specific suggestion is available for the code.
 *
 * @param error        - The original ZodIssue
 * @param _fieldName   - Formatted field name (unused, kept for API symmetry)
 * @param params       - Extracted params from {@link extractErrorParams}
 * @param inferredType - Inferred type from the Zod issue
 */
export const generateSuggestion = (
    error: ZodIssue,
    _fieldName: string,
    params: Record<string, unknown>,
    inferredType?: string
): string | undefined => {
    const { code } = error;

    switch (code as string) {
        case 'too_small': {
            const min = params.min;
            const type = inferredType;

            if (min !== undefined && type === 'string') {
                return `Try adding more characters. Minimum required: ${min}`;
            }
            if (min !== undefined && type === 'number') {
                return `Use a number ${min} or higher`;
            }
            if (min !== undefined && type === 'array') {
                return `Add at least ${min} item(s) to the list`;
            }
            break;
        }

        case 'too_big': {
            const max = params.max;
            const type = inferredType;

            if (max !== undefined && type === 'string') {
                return `Remove some characters. Maximum allowed: ${max}`;
            }
            if (max !== undefined && type === 'number') {
                return `Use a number ${max} or lower`;
            }
            if (max !== undefined && type === 'array') {
                return `Remove some items. Maximum allowed: ${max}`;
            }
            break;
        }

        case 'invalid_type': {
            const expected = params.expected || 'unknown';

            if (expected === 'string') {
                return "Use quotes around the value if it's text";
            }
            if (expected === 'number') {
                return 'Remove quotes if this should be a number';
            }
            if (expected === 'boolean') {
                return 'Use true or false (without quotes)';
            }
            if (expected === 'array') {
                return 'Use square brackets [ ] to create a list';
            }
            break;
        }

        case 'invalid_format': {
            const format = (error as ZodFormatIssue).format;

            if (format === 'email') {
                return 'Use format: name@domain.com';
            }
            if (format === 'url') {
                return 'Use format: https://example.com';
            }
            if (format === 'uuid') {
                return 'Use format: 12345678-1234-1234-1234-123456789012';
            }
            break;
        }

        case 'invalid_string': {
            const validation = (error as ZodStringValidationIssue).validation;
            if (validation) {
                if (validation === 'email') {
                    return 'Use format: name@domain.com';
                }
                if (validation === 'url') {
                    return 'Use format: https://example.com';
                }
                if (validation === 'uuid') {
                    return 'Use format: 12345678-1234-1234-1234-123456789012';
                }
            }
            break;
        }

        case 'invalid_enum_value': {
            const options = params.options;
            if (Array.isArray(options)) {
                const limitedOptions =
                    options.slice(0, 3).join(', ') + (options.length > 3 ? '...' : '');
                return `Try one of these: ${limitedOptions}`;
            }
            break;
        }

        case 'invalid_value': {
            const values = (error as ZodValueIssue).values;
            if (Array.isArray(values)) {
                const limitedOptions =
                    values.slice(0, 3).join(', ') + (values.length > 3 ? '...' : '');
                return `Try one of these: ${limitedOptions}`;
            }
            break;
        }

        case 'unrecognized_keys': {
            return 'Remove the unexpected fields or check the API documentation';
        }

        case 'invalid_union':
            return 'Check the API documentation for the accepted formats and provide a valid value';

        case 'invalid_key':
            return 'Use only the keys defined in the schema for this object';

        case 'invalid_element':
            return 'Ensure each element in the list matches the expected type or format';
    }

    return undefined;
};

// ---------------------------------------------------------------------------
// generateOverallMessage
// ---------------------------------------------------------------------------

/**
 * Generates an overall user-friendly summary message based on error counts.
 * Returns a special message when there are zero errors (edge case guard).
 *
 * @param summary - Aggregated error statistics
 */
export const generateOverallMessage = (summary: ValidationErrorSummary): string => {
    const { totalErrors, fieldCount } = summary;

    if (totalErrors === 0) {
        return 'No validation errors found';
    }

    if (totalErrors === 1) {
        return 'Please fix the validation error below';
    }

    if (fieldCount === 1) {
        return `Please fix the ${totalErrors} validation errors for this field`;
    }

    if (totalErrors <= 5) {
        return `Please fix the ${totalErrors} validation errors in ${fieldCount} fields`;
    }

    return `Please fix the validation errors (${totalErrors} errors across ${fieldCount} fields)`;
};
