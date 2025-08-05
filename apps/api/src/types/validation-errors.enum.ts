/**
 * Validation error codes enum
 * Used for consistent error handling across the validation system
 */
export enum ValidationErrorCode {
    /** Invalid Content-Type header */
    INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
    /** Request body too large */
    REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
    /** Missing required header */
    MISSING_REQUIRED_HEADER = 'MISSING_REQUIRED_HEADER',
    /** Invalid request format */
    INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
    /** Data sanitization failed */
    SANITIZATION_FAILED = 'SANITIZATION_FAILED',
    /** Zod validation failed */
    ZOD_VALIDATION_FAILED = 'ZOD_VALIDATION_FAILED',
    /** Invalid Authorization header format */
    INVALID_AUTHORIZATION_FORMAT = 'INVALID_AUTHORIZATION_FORMAT',
    /** Request timeout */
    REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
    /** Invalid Accept header */
    INVALID_ACCEPT_HEADER = 'INVALID_ACCEPT_HEADER'
}
