/**
 * Zod Error Transformer — Types and Lookup Maps
 *
 * Defines the public TypeScript interfaces for the validated error response
 * and the lookup maps that convert Zod error codes to our standardized codes
 * and i18n translation keys.
 *
 * @module zod-error-types
 */

// ---------------------------------------------------------------------------
// Public TypeScript interfaces
// ---------------------------------------------------------------------------

export interface TransformedValidationError {
    /** The field path (dot-notation) where the error occurred, e.g. "user.email" */
    field: string;
    /**
     * The i18n translation key for this error, e.g. "validationError.field.tooSmall".
     * If the schema provides a custom "zodError.*" key it is used as-is.
     * Consumers should resolve this key against the i18n catalogue for a localised message.
     */
    messageKey: string;
    /**
     * The raw Zod error message as produced by Zod's internal formatter.
     * Useful for debugging and server-side logging but NOT intended for end-users.
     */
    zodMessage: string;
    /** A user-friendly, English message derived from the Zod error details. */
    userFriendlyMessage: string;
    /** The standardised error code, e.g. "TOO_SMALL" | "INVALID_TYPE". */
    code: string;
    /** Optional parameters extracted from the Zod issue (min, max, expected, etc.). */
    params?: Record<string, unknown>;
    /** Optional actionable suggestion for the end-user on how to fix the error. */
    suggestion?: string;
}

export interface ValidationErrorSummary {
    totalErrors: number;
    fieldCount: number;
    errorsByField: Record<string, number>;
    mostCommonError: string;
}

export interface ValidationErrorResponse {
    /** The top-level error code, always "VALIDATION_ERROR". */
    code: string;
    /**
     * The i18n key for the overall validation failure message,
     * e.g. "validationError.validation.failed".
     */
    messageKey: string;
    /**
     * Raw overall message from Zod, useful for server-side logging.
     * NOT intended for display to end-users.
     */
    zodMessage: string;
    /** A user-friendly summary message, e.g. "Please fix 3 validation errors in 2 fields". */
    userFriendlyMessage: string;
    /** Per-field validation error details. */
    details: TransformedValidationError[];
    /** Aggregated statistics about the validation errors. */
    summary: ValidationErrorSummary;
}

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

/**
 * Maps Zod error codes to our standardized error codes
 */
export const ZOD_ERROR_CODE_MAP: Record<string, string> = {
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
    not_finite: 'NOT_FINITE',
    // Zod v4 new error codes
    invalid_union: 'INVALID_UNION',
    invalid_key: 'INVALID_KEY',
    invalid_element: 'INVALID_ELEMENT'
};

/**
 * Maps Zod error codes to i18n translation keys
 */
export const ZOD_ERROR_MESSAGE_MAP: Record<string, string> = {
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
    not_finite: 'validationError.field.notFinite',
    // Zod v4 new error codes
    invalid_union: 'validationError.field.invalidUnion',
    invalid_key: 'validationError.field.invalidKey',
    invalid_element: 'validationError.field.invalidElement'
};
