/**
 * Error Handling System
 *
 * Provides comprehensive error handling utilities including:
 * - ApiError class for typed API errors
 * - Type guards for error detection
 * - Error reporting (console in dev, Sentry in prod)
 * - Toast notifications for user feedback
 *
 * @example
 * ```typescript
 * import {
 *   ApiError,
 *   isApiError,
 *   isNetworkError,
 *   reportError,
 *   showErrorToast
 * } from '@/lib/errors';
 *
 * try {
 *   const result = await fetchApi({ path: '/api/accommodations' });
 * } catch (error) {
 *   if (isApiError(error)) {
 *     if (error.isNotFoundError()) {
 *       // Handle 404
 *     } else if (error.isValidationError()) {
 *       // Handle validation errors
 *       const fieldErrors = error.getValidationErrors();
 *     }
 *   }
 *
 *   // Show user feedback
 *   showErrorToast({ error, action: 'loading accommodations' });
 * }
 * ```
 */

// ApiError class and type guards
export {
    ApiError,
    type ApiErrorCode,
    type ApiErrorConfig,
    createApiError,
    isAbortError,
    isApiError,
    isNetworkError,
    isTimeoutError
} from './api-error';

// Error reporter
export {
    type ErrorReportInput,
    type ErrorSeverity,
    reportApiError,
    reportComponentError,
    reportError,
    reportNetworkError
} from './error-reporter';
// API validation error parser (GAP-032)
export {
    type ApiValidationDetail,
    ApiValidationDetailSchema,
    type ApiValidationError,
    ApiValidationErrorBodySchema,
    ApiValidationErrorSchema,
    ApiValidationSummarySchema,
    type ParseApiValidationErrorsInput,
    parseApiValidationErrors
} from './parse-api-validation-errors';
// Toast utilities
export {
    getFriendlyErrorInfo,
    type ShowErrorToastInput,
    setToastFunction,
    showErrorToast,
    showInfoToast,
    showSuccessToast
} from './toast-error';
// Admin-side adapter for translateApiError (SPEC-183)
export {
    type TranslateAdminApiErrorInput,
    translateAdminApiError
} from './translate-api-error';
