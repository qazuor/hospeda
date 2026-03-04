/**
 * Toast Error Utility - User-friendly error display
 *
 * Provides consistent error toasts across the application with
 * appropriate messages based on error type.
 *
 * @example
 * ```typescript
 * import { showErrorToast } from '@/lib/errors';
 *
 * try {
 *   await saveAccommodation(data);
 * } catch (error) {
 *   showErrorToast({ error, action: 'save' });
 * }
 * ```
 */

import { adminLogger } from '@/utils/logger';
import { defaultLocale, trans } from '@repo/i18n';
import {
    type ApiError,
    isAbortError,
    isApiError,
    isNetworkError,
    isTimeoutError
} from './api-error';
import { reportError } from './error-reporter';

/**
 * Get a translation string from admin-common namespace.
 * Used in non-React contexts where hooks are not available.
 */
function tt(key: string): string {
    const fullKey = `admin-common.toastErrors.${key}`;
    return trans[defaultLocale]?.[fullKey] ?? `[MISSING: ${fullKey}]`;
}

/**
 * Toast notification function type (provided by ToastProvider)
 */
type ToastFn = (options: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive' | 'success';
    duration?: number;
}) => void;

/**
 * Global toast function reference (set by ToastProvider)
 */
let globalToast: ToastFn | null = null;

/**
 * Set the global toast function (called by ToastProvider)
 */
export function setToastFunction(toast: ToastFn): void {
    globalToast = toast;
}

/**
 * Configuration for showing an error toast
 */
export interface ShowErrorToastInput {
    /** The error to display */
    readonly error: unknown;
    /** Action that was being performed (for context) */
    readonly action?: string;
    /** Custom title override */
    readonly title?: string;
    /** Custom description override */
    readonly description?: string;
    /** Duration in milliseconds (default: 5000) */
    readonly duration?: number;
    /** Whether to report to error tracking (default: true) */
    readonly report?: boolean;
    /** Additional context for error reporting */
    readonly context?: Record<string, unknown>;
}

/**
 * Get user-friendly error message based on error type
 */
function getErrorMessage(error: unknown, action?: string): { title: string; description: string } {
    const actionContext = action ? ` while ${action}` : '';

    // Handle abort errors (user cancelled)
    if (isAbortError(error)) {
        return {
            title: tt('cancelled.title'),
            description: tt('cancelled.description')
        };
    }

    // Handle timeout errors
    if (isTimeoutError(error)) {
        return {
            title: tt('timeout.title'),
            description: tt('timeout.description')
        };
    }

    // Handle network errors
    if (isNetworkError(error)) {
        return {
            title: tt('connectionError.title'),
            description: tt('connectionError.description')
        };
    }

    // Handle API errors
    if (isApiError(error)) {
        return getApiErrorMessage(error, actionContext);
    }

    // Handle generic errors
    if (error instanceof Error) {
        return {
            title: tt('generic.title'),
            description: error.message || tt('generic.description')
        };
    }

    // Unknown error type
    return {
        title: tt('generic.title'),
        description: tt('generic.description')
    };
}

/**
 * Get user-friendly message for API errors
 */
function getApiErrorMessage(
    error: ApiError,
    _actionContext: string
): { title: string; description: string } {
    switch (error.status) {
        case 400:
            return {
                title: tt('generic.title'),
                description: error.message || tt('api.badRequest')
            };

        case 401:
            return {
                title: tt('generic.title'),
                description: tt('api.unauthorized')
            };

        case 403:
            return {
                title: tt('generic.title'),
                description: tt('api.forbidden')
            };

        case 404:
            return {
                title: tt('generic.title'),
                description: error.message || tt('api.notFound')
            };

        case 409:
            return {
                title: tt('generic.title'),
                description: error.message || tt('api.conflict')
            };

        case 422: {
            // Validation errors - try to get specific field errors
            const validationErrors = error.getValidationErrors();
            if (validationErrors) {
                const fieldErrors = Object.entries(validationErrors)
                    .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
                    .join('; ');
                return {
                    title: tt('generic.title'),
                    description: fieldErrors || tt('api.validation')
                };
            }
            return {
                title: tt('generic.title'),
                description: error.message || tt('api.validation')
            };
        }

        case 429:
            return {
                title: tt('generic.title'),
                description: tt('api.tooManyRequests')
            };

        case 500:
        case 502:
        case 503:
        case 504:
            return {
                title: tt('generic.title'),
                description: tt('api.serverError')
            };

        default:
            return {
                title: tt('generic.title'),
                description: error.message || tt('generic.description')
            };
    }
}

/**
 * Show an error toast notification
 *
 * Displays a user-friendly error message and optionally reports
 * the error to the error tracking system.
 *
 * @example
 * ```typescript
 * // Basic usage
 * showErrorToast({ error });
 *
 * // With action context
 * showErrorToast({
 *   error,
 *   action: 'saving the accommodation'
 * });
 *
 * // With custom message
 * showErrorToast({
 *   error,
 *   title: 'Upload Failed',
 *   description: 'The image could not be uploaded.'
 * });
 *
 * // Without reporting
 * showErrorToast({
 *   error,
 *   report: false
 * });
 * ```
 */
export function showErrorToast(input: ShowErrorToastInput): void {
    const {
        error,
        action,
        title: customTitle,
        description: customDescription,
        duration = 5000,
        report = true,
        context
    } = input;

    // Don't show toast for aborted requests
    if (isAbortError(error)) {
        return;
    }

    // Get appropriate message
    const { title, description } = getErrorMessage(error, action);

    // Show toast
    if (globalToast) {
        globalToast({
            title: customTitle || title,
            description: customDescription || description,
            variant: 'destructive',
            duration
        });
    } else {
        // Fallback to logger if toast not available
        adminLogger.error(
            `Toast Error - ${customTitle || title}: ${customDescription || description}`
        );
    }

    // Report error
    if (report) {
        reportError({
            error,
            context: {
                ...context,
                action,
                toastShown: true
            },
            source: 'Toast'
        });
    }
}

/**
 * Show a success toast (for completeness)
 */
export function showSuccessToast(title: string, description?: string, duration = 3000): void {
    if (globalToast) {
        globalToast({
            title,
            description,
            variant: 'success',
            duration
        });
    }
}

/**
 * Show an info toast
 */
export function showInfoToast(title: string, description?: string, duration = 4000): void {
    if (globalToast) {
        globalToast({
            title,
            description,
            variant: 'default',
            duration
        });
    }
}
