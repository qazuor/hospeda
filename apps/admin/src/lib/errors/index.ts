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
    isApiError,
    isNetworkError,
    isAbortError,
    isTimeoutError,
    createApiError
} from './api-error';

// Error reporter
export {
    type ErrorSeverity,
    type ErrorReportInput,
    reportError,
    reportApiError,
    reportNetworkError,
    reportComponentError
} from './error-reporter';

// Toast utilities
export {
    type ShowErrorToastInput,
    setToastFunction,
    showErrorToast,
    showSuccessToast,
    showInfoToast
} from './toast-error';
