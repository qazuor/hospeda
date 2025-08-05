import { ValidationErrorCode } from './validation-errors.enum';

/**
 * Validation error messages
 * All messages use the 'zodError.validation' prefix for translation
 */
export const validationMessages = {
    [ValidationErrorCode.INVALID_CONTENT_TYPE]: 'zodError.validation.content_type.invalid',
    [ValidationErrorCode.REQUEST_TOO_LARGE]: 'zodError.validation.request.too_large',
    [ValidationErrorCode.MISSING_REQUIRED_HEADER]: 'zodError.validation.header.missing',
    [ValidationErrorCode.INVALID_REQUEST_FORMAT]: 'zodError.validation.request.invalid_format',
    [ValidationErrorCode.SANITIZATION_FAILED]: 'zodError.validation.sanitization.failed',
    [ValidationErrorCode.ZOD_VALIDATION_FAILED]: 'zodError.validation.zod.failed',
    [ValidationErrorCode.INVALID_AUTHORIZATION_FORMAT]:
        'zodError.validation.authorization.invalid_format',
    [ValidationErrorCode.REQUEST_TIMEOUT]: 'zodError.validation.request.timeout',
    [ValidationErrorCode.INVALID_ACCEPT_HEADER]: 'zodError.validation.accept.invalid'
} as const;

/**
 * Type for validation error details
 */
export interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
    constructor(
        public code: ValidationErrorCode,
        message: string,
        public details?: ValidationErrorDetail[]
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}
