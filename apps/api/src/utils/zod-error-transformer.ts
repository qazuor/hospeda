/**
 * Zod Error Transformer
 * Transforms Zod validation errors into a client-friendly format
 */

import type { ZodError, ZodIssue } from 'zod';

/**
 * Extended ZodIssue with properties specific to size constraint errors (too_small / too_big).
 * Zod attaches these at runtime but they are not part of the public ZodIssue union type.
 */
type ZodSizeIssue = ZodIssue & {
    /** Minimum value for too_small errors */
    minimum?: number;
    /** Maximum value for too_big errors */
    maximum?: number;
    /** Whether the boundary is inclusive */
    inclusive?: boolean;
    /** Origin type: 'string' | 'number' | 'array' | 'date' */
    origin?: string;
    /** Direct type discriminant (older Zod versions) */
    type?: string;
};

/**
 * Extended ZodIssue with properties for type mismatch errors (invalid_type).
 */
type ZodTypeIssue = ZodIssue & {
    /** Expected type name */
    expected?: string;
    /** Received type name */
    received?: string;
};

/**
 * Extended ZodIssue with format information for invalid_format errors (Zod v4).
 */
type ZodFormatIssue = ZodIssue & {
    /** Format that failed validation, e.g. 'email' | 'url' | 'uuid' */
    format?: string;
};

/**
 * Extended ZodIssue with validation information for invalid_string errors.
 */
type ZodStringValidationIssue = ZodIssue & {
    /** Validation type that failed, e.g. 'email' | 'url' | 'uuid' | 'regex' */
    validation?: string;
};

/**
 * Extended ZodIssue with allowed values for invalid_value errors.
 */
type ZodValueIssue = ZodIssue & {
    /** List of valid values */
    values?: unknown[];
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
 * This type is only used within extractErrorParams / transformZodError.
 */
interface ParamsWithInternal extends Record<string, unknown> {
    _inferredType?: string;
}

export interface TransformedValidationError {
    field: string;
    message: string;
    translatedMessage: string;
    userFriendlyMessage: string;
    code: string;
    params?: Record<string, unknown>;
    suggestion?: string;
}

export interface ValidationErrorSummary {
    totalErrors: number;
    fieldCount: number;
    errorsByField: Record<string, number>;
    mostCommonError: string;
}

export interface ValidationErrorResponse {
    code: string;
    message: string;
    translatedMessage: string;
    userFriendlyMessage: string;
    details: TransformedValidationError[];
    summary: ValidationErrorSummary;
}

/**
 * Maps Zod error codes to our standardized error codes
 */
const ZOD_ERROR_CODE_MAP: Record<string, string> = {
    // String validation errors
    too_small: 'TOO_SMALL',
    too_big: 'TOO_BIG',
    invalid_type: 'INVALID_TYPE',
    invalid_string: 'INVALID_STRING',
    invalid_format: 'INVALID_FORMAT',
    invalid_email: 'INVALID_EMAIL',
    invalid_url: 'INVALID_URL',
    invalid_uuid: 'INVALID_UUID',
    invalid_cuid: 'INVALID_CUID',
    invalid_cuid2: 'INVALID_CUID2',
    invalid_ulid: 'INVALID_ULID',
    invalid_datetime: 'INVALID_DATETIME',
    invalid_date: 'INVALID_DATE',
    invalid_time: 'INVALID_TIME',
    invalid_enum_value: 'INVALID_ENUM_VALUE',
    invalid_value: 'INVALID_VALUE',
    unrecognized_keys: 'UNRECOGNIZED_KEYS',
    invalid_arguments: 'INVALID_ARGUMENTS',
    invalid_return_type: 'INVALID_RETURN_TYPE',
    custom: 'CUSTOM_VALIDATION_ERROR',
    invalid_intersection_types: 'INVALID_INTERSECTION_TYPES',
    not_multiple_of: 'NOT_MULTIPLE_OF',
    not_finite: 'NOT_FINITE'
};

/**
 * Maps Zod error codes to translation keys
 */
const ZOD_ERROR_MESSAGE_MAP: Record<string, string> = {
    // String validation errors
    too_small: 'validationError.field.tooSmall',
    too_big: 'validationError.field.tooBig',
    invalid_type: 'validationError.field.invalidType',
    invalid_string: 'validationError.field.invalidString',
    invalid_format: 'validationError.field.invalidFormat',
    invalid_email: 'validationError.field.invalidEmail',
    invalid_url: 'validationError.field.invalidUrl',
    invalid_uuid: 'validationError.field.invalidUuid',
    invalid_cuid: 'validationError.field.invalidCuid',
    invalid_cuid2: 'validationError.field.invalidCuid2',
    invalid_ulid: 'validationError.field.invalidUlid',
    invalid_datetime: 'validationError.field.invalidDatetime',
    invalid_date: 'validationError.field.invalidDate',
    invalid_time: 'validationError.field.invalidTime',
    invalid_enum_value: 'validationError.field.invalidEnumValue',
    invalid_value: 'validationError.field.invalidValue',
    unrecognized_keys: 'validationError.field.unrecognizedKeys',
    invalid_arguments: 'validationError.field.invalidArguments',
    invalid_return_type: 'validationError.field.invalidReturnType',
    custom: 'validationError.field.customError',
    invalid_intersection_types: 'validationError.field.invalidIntersectionTypes',
    not_multiple_of: 'validationError.field.notMultipleOf',
    not_finite: 'validationError.field.notFinite'
};

/**
 * Extracts parameters from Zod error for better error context
 */
const extractErrorParams = (error: ZodIssue): ParamsWithInternal => {
    const params: ParamsWithInternal = {};

    // Extract type - use for internal logic but don't include in params output
    let inferredType: string | undefined;

    if (error.code === 'too_small' || error.code === 'too_big') {
        const sizeIssue = error as ZodSizeIssue;
        // Use type or origin property if available (Zod attaches them at runtime)
        if (sizeIssue.type !== undefined) {
            inferredType = sizeIssue.type;
        } else if (sizeIssue.origin !== undefined) {
            inferredType = sizeIssue.origin;
        } else {
            inferredType = 'string'; // fallback
        }
    }

    // Store inferred type for use in message generation (not in public params)
    params._inferredType = inferredType;

    // For 'too_small' errors, Zod provides: minimum, type, inclusive
    if (error.code === 'too_small') {
        const sizeIssue = error as ZodSizeIssue;
        if (sizeIssue.minimum !== undefined) params.min = sizeIssue.minimum;
        if (sizeIssue.inclusive !== undefined) params.inclusive = sizeIssue.inclusive;
    }

    // For 'too_big' errors, Zod provides: maximum, type, inclusive
    if (error.code === 'too_big') {
        const sizeIssue = error as ZodSizeIssue;
        if (sizeIssue.maximum !== undefined) params.max = sizeIssue.maximum;
        if (sizeIssue.inclusive !== undefined) params.inclusive = sizeIssue.inclusive;
    }

    // For 'invalid_type' errors, Zod provides: expected, received
    if (error.code === 'invalid_type') {
        const typeIssue = error as ZodTypeIssue;
        if (typeIssue.expected !== undefined) params.expected = typeIssue.expected;
        if (typeIssue.received !== undefined) params.received = typeIssue.received;

        // FALLBACK: Parse received from message if not in properties
        if (!params.received && error.message.includes('received ')) {
            const receivedMatch = error.message.match(/received (\w+)/);
            if (receivedMatch) {
                params.received = receivedMatch[1];
            }
        }
    }

    // For miscellaneous extra properties that Zod may attach
    const miscIssue = error as ZodMiscIssue;
    if (miscIssue.exact !== undefined) params.exact = miscIssue.exact;
    if (miscIssue.options !== undefined) params.options = miscIssue.options;
    if (miscIssue.keys !== undefined) params.keys = miscIssue.keys;

    return params; // Return params WITH _inferredType (cleaning happens in transformZodError)
};

/**
 * Generates user-friendly error messages based on Zod error details
 */
const generateUserFriendlyMessage = (
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
            // Handle invalid_format errors (like email validation, Zod v4)
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

        case 'invalid_date':
            return `${fieldName} must be a valid date`;

        case 'invalid_email':
            return `${fieldName} must be a valid email address`;

        case 'invalid_url':
            return `${fieldName} must be a valid web address`;

        case 'invalid_uuid':
            return `${fieldName} must be a valid ID format`;

        case 'custom':
            // Use the original message for custom validations as they're usually already user-friendly
            return error.message;

        default:
            return `${fieldName} is invalid`;
    }
};

/**
 * Generates helpful suggestions for fixing validation errors
 */
const generateSuggestion = (
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
            // Handle invalid_format errors (like email validation, Zod v4)
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

        case 'invalid_email':
            return 'Use format: name@domain.com';

        case 'invalid_url':
            return 'Use format: https://example.com';

        case 'invalid_uuid':
            return 'Use the correct ID format provided by the system';
    }

    return undefined;
};

/**
 * Capitalizes the first letter of a field name for user-friendly display
 */
const formatFieldName = (fieldPath: string): string => {
    if (!fieldPath) return 'Field';

    // Handle nested paths like 'user.profile.name' -> 'Profile name'
    const parts = fieldPath.split('.');
    const lastPart = parts[parts.length - 1] || 'Field';

    // Convert camelCase to spaces: 'firstName' -> 'First name'
    const formatted = lastPart
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (str) => str.toUpperCase());

    return formatted;
};

/**
 * Creates a summary of validation errors for better UX
 */
const createErrorSummary = (details: TransformedValidationError[]): ValidationErrorSummary => {
    const errorsByField: Record<string, number> = {};
    const errorCodes: Record<string, number> = {};

    for (const detail of details) {
        const fieldKey = detail.field || 'unknown';
        errorsByField[fieldKey] = (errorsByField[fieldKey] || 0) + 1;
        errorCodes[detail.code] = (errorCodes[detail.code] || 0) + 1;
    }

    // Find most common error type
    const mostCommonError =
        Object.entries(errorCodes).sort(([, a], [, b]) => b - a)[0]?.[0] || 'UNKNOWN';

    return {
        totalErrors: details.length,
        fieldCount: Object.keys(errorsByField).length,
        errorsByField,
        mostCommonError
    };
};

/**
 * Generates an overall user-friendly message based on error summary
 */
const generateOverallMessage = (summary: ValidationErrorSummary): string => {
    const { totalErrors, fieldCount } = summary;

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

/**
 * Transforms a ZodError into our enhanced standardized format
 */
export const transformZodError = (error: ZodError): ValidationErrorResponse => {
    // ZodError.issues is the public API for accessing validation issues
    const details: TransformedValidationError[] = error.issues.map(
        (err: ZodIssue, _index: number) => {
            const zodCode = err.code;
            const fieldPath = err.path.join('.');
            const fieldName = formatFieldName(fieldPath);

            const standardizedCode = ZOD_ERROR_CODE_MAP[zodCode] || 'UNKNOWN_VALIDATION_ERROR';
            const translationKey =
                ZOD_ERROR_MESSAGE_MAP[zodCode] || 'validationError.field.unknown';

            const paramsWithInternal = extractErrorParams(err);
            // Destructure _inferredType before passing params to public functions
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
                message: err.message.startsWith('zodError.') ? err.message : translationKey,
                translatedMessage: err.message,
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
        message: 'validationError.validation.failed',
        translatedMessage: 'Validation failed',
        userFriendlyMessage: overallMessage,
        details,
        summary
    };
};
/**
 * Helper function to group errors by field for better display
 */
export const groupErrorsByField = (
    errors: TransformedValidationError[]
): Record<string, TransformedValidationError[]> => {
    return errors.reduce(
        (groups, error) => {
            const field = error.field || 'general';
            if (!groups[field]) {
                groups[field] = [];
            }
            groups[field].push(error);
            return groups;
        },
        {} as Record<string, TransformedValidationError[]>
    );
};

/**
 * Helper function to get a simplified error summary for API responses
 */
export const getSimplifiedErrors = (
    errors: TransformedValidationError[]
): Array<{ field: string; message: string; suggestion?: string }> => {
    return errors.map((error) => ({
        field: error.field,
        message: error.userFriendlyMessage,
        suggestion: error.suggestion
    }));
};
