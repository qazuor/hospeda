/**
 * Zod Error Transformer
 * Transforms Zod validation errors into a client-friendly format
 */

import type { ZodError, ZodIssue } from 'zod';

export interface TransformedValidationError {
    field: string;
    message: string;
    translatedMessage: string;
    code: string;
    params?: Record<string, unknown>;
}

export interface ValidationErrorResponse {
    code: string;
    message: string;
    translatedMessage: string;
    details: TransformedValidationError[];
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
const extractErrorParams = (error: ZodIssue): Record<string, unknown> => {
    const params: Record<string, unknown> = {};

    if ('minimum' in error && error.minimum !== undefined) params.min = error.minimum;
    if ('maximum' in error && error.maximum !== undefined) params.max = error.maximum;
    if ('inclusive' in error && error.inclusive !== undefined) params.inclusive = error.inclusive;
    if ('exact' in error && error.exact !== undefined) params.exact = error.exact;
    if ('received' in error && error.received !== undefined) params.received = error.received;
    if ('expected' in error && error.expected !== undefined) params.expected = error.expected;
    if ('options' in error && error.options !== undefined) params.options = error.options;
    if ('keys' in error && error.keys !== undefined) params.keys = error.keys;

    return params;
};

/**
 * Transforms a ZodError into our standardized format
 */
export const transformZodError = (error: ZodError): ValidationErrorResponse => {
    // biome-ignore lint/suspicious/noExplicitAny: ZodError types are complex and this is the correct way to access errors
    const details: TransformedValidationError[] = (error as any).issues.map((err: ZodIssue) => {
        const zodCode = err.code;

        const standardizedCode = ZOD_ERROR_CODE_MAP[zodCode] || 'UNKNOWN_VALIDATION_ERROR';
        const translationKey = ZOD_ERROR_MESSAGE_MAP[zodCode] || 'validationError.field.unknown';
        const params = extractErrorParams(err);

        return {
            field: err.path.join('.'),
            message: translationKey,
            translatedMessage: err.message,
            code: standardizedCode,
            params: Object.keys(params).length > 0 ? params : undefined
        };
    });

    return {
        code: 'VALIDATION_ERROR',
        message: 'validationError.validation.failed',
        translatedMessage: 'Validation failed',
        details
    };
};
