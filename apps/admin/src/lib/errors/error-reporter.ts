/**
 * Error Reporter - Environment-aware error reporting utility
 *
 * Reports errors to console in development and to Sentry in production.
 * Sanitizes sensitive data before sending to external services.
 *
 * @example
 * ```typescript
 * import { reportError } from '@/lib/errors';
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   reportError({
 *     error,
 *     context: { userId: '123', action: 'save' },
 *     severity: 'error'
 *   });
 * }
 * ```
 */

import { type ApiError, isAbortError, isApiError, isNetworkError } from './api-error';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Configuration for error reporting
 */
export interface ErrorReportInput {
    /** The error to report */
    readonly error: unknown;
    /** Additional context information */
    readonly context?: Record<string, unknown>;
    /** Error severity level */
    readonly severity?: ErrorSeverity;
    /** Component or module where error occurred */
    readonly source?: string;
    /** User ID (will be sanitized in reports) */
    readonly userId?: string;
    /** Tags for categorization */
    readonly tags?: Record<string, string>;
}

/**
 * Sanitized error report structure
 */
interface SanitizedReport {
    message: string;
    type: string;
    severity: ErrorSeverity;
    timestamp: string;
    source?: string;
    context: Record<string, unknown>;
    tags: Record<string, string>;
    stack?: string;
    apiDetails?: {
        status: number;
        code: string;
        url?: string;
        method?: string;
    };
}

/**
 * Patterns to detect sensitive data that should be redacted
 */
const SENSITIVE_PATTERNS = [
    /bearer\s+[\w-]+/gi, // Bearer tokens
    /authorization:\s*[\w-]+/gi, // Authorization headers
    /password[=:]\s*\S+/gi, // Passwords
    /api[_-]?key[=:]\s*\S+/gi, // API keys
    /secret[=:]\s*\S+/gi, // Secrets
    /token[=:]\s*[\w-]+/gi, // Generic tokens
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g // Credit card numbers
];

/**
 * Sanitize a string by redacting sensitive information
 */
function sanitizeString(str: string): string {
    let result = str;
    for (const pattern of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Sanitize an object by redacting sensitive values
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'apiKey',
        'authorization',
        'cookie',
        'session',
        'creditCard',
        'ssn',
        'email'
    ];

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Check if key is sensitive
        if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
            result[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
            result[key] = sanitizeString(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Create a sanitized error report
 */
function createSanitizedReport(input: ErrorReportInput): SanitizedReport {
    const { error, context = {}, severity = 'error', source, tags = {} } = input;

    const report: SanitizedReport = {
        message: 'Unknown error',
        type: 'unknown',
        severity,
        timestamp: new Date().toISOString(),
        source,
        context: sanitizeObject(context),
        tags
    };

    if (isApiError(error)) {
        report.message = sanitizeString(error.message);
        report.type = 'ApiError';
        report.stack = error.stack ? sanitizeString(error.stack) : undefined;
        report.apiDetails = {
            status: error.status,
            code: error.code,
            url: error.url ? sanitizeString(error.url) : undefined,
            method: error.method
        };
    } else if (error instanceof Error) {
        report.message = sanitizeString(error.message);
        report.type = error.name;
        report.stack = error.stack ? sanitizeString(error.stack) : undefined;
    } else if (typeof error === 'string') {
        report.message = sanitizeString(error);
        report.type = 'string';
    }

    return report;
}

/**
 * Check if we're in production environment
 */
function isProduction(): boolean {
    return (
        typeof window !== 'undefined' &&
        (import.meta.env?.PROD === true || import.meta.env?.MODE === 'production')
    );
}

/**
 * Check if we're in development environment
 */
function isDevelopment(): boolean {
    return (
        typeof window !== 'undefined' &&
        (import.meta.env?.DEV === true || import.meta.env?.MODE === 'development')
    );
}

/**
 * Log error to console with appropriate styling
 */
function logToConsole(report: SanitizedReport): void {
    const styles = {
        debug: 'color: gray',
        info: 'color: blue',
        warning: 'color: orange',
        error: 'color: red; font-weight: bold',
        fatal: 'color: white; background: red; font-weight: bold; padding: 2px 4px'
    };

    const style = styles[report.severity];
    const prefix = `[${report.severity.toUpperCase()}]${report.source ? ` [${report.source}]` : ''}`;

    console.groupCollapsed(`%c${prefix} ${report.message}`, style);

    if (report.apiDetails) {
    }

    if (Object.keys(report.context).length > 0) {
    }

    if (Object.keys(report.tags).length > 0) {
    }

    if (report.stack) {
    }

    console.groupEnd();
}

/**
 * Send error to Sentry (when configured)
 *
 * Uses the Sentry module from @/lib/sentry for error reporting.
 * Only sends errors when Sentry is initialized (production with DSN).
 */
function sendToSentry(report: SanitizedReport): void {
    // Dynamic import to avoid loading Sentry in development
    import('@/lib/sentry')
        .then(({ captureError, isSentryInitialized }) => {
            if (!isSentryInitialized()) {
                return;
            }

            const error = new Error(report.message);
            error.name = report.type;
            if (report.stack) {
                error.stack = report.stack;
            }

            captureError(error, {
                level: report.severity as 'debug' | 'info' | 'warning' | 'error' | 'fatal',
                tags: {
                    ...report.tags,
                    errorType: report.type,
                    ...(report.apiDetails ? { statusCode: String(report.apiDetails.status) } : {})
                },
                extra: {
                    context: report.context,
                    apiDetails: report.apiDetails,
                    timestamp: report.timestamp,
                    source: report.source
                }
            });
        })
        .catch(() => {
            // Sentry module not available, silently ignore
        });
}

/**
 * Report an error with environment-aware behavior
 *
 * - Development: Logs detailed error to console with formatting
 * - Production: Sends sanitized error to Sentry
 *
 * @example
 * ```typescript
 * // Basic usage
 * reportError({ error: new Error('Something failed') });
 *
 * // With context
 * reportError({
 *   error,
 *   context: { accommodationId: '123', action: 'update' },
 *   source: 'AccommodationForm',
 *   severity: 'error'
 * });
 *
 * // With tags for filtering
 * reportError({
 *   error,
 *   tags: { feature: 'booking', priority: 'high' }
 * });
 * ```
 */
export function reportError(input: ErrorReportInput): void {
    // Don't report aborted requests (user cancelled)
    if (isAbortError(input.error)) {
        return;
    }

    // Create sanitized report
    const report = createSanitizedReport(input);

    // Always log to console in development
    if (isDevelopment()) {
        logToConsole(report);
    }

    // Send to Sentry in production
    if (isProduction()) {
        sendToSentry(report);
    }
}

/**
 * Report an API error with additional API context
 */
export function reportApiError(error: ApiError, context?: Record<string, unknown>): void {
    reportError({
        error,
        context: {
            ...context,
            requestUrl: error.url,
            requestMethod: error.method,
            responseStatus: error.status,
            errorCode: error.code
        },
        source: 'API',
        severity: error.isServerError() ? 'error' : 'warning',
        tags: {
            errorType: 'api',
            statusCode: String(error.status),
            errorCode: error.code
        }
    });
}

/**
 * Report a network error
 */
export function reportNetworkError(error: unknown, context?: Record<string, unknown>): void {
    if (!isNetworkError(error)) {
        reportError({ error, context });
        return;
    }

    reportError({
        error,
        context: {
            ...context,
            errorType: 'network',
            online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown'
        },
        source: 'Network',
        severity: 'warning',
        tags: {
            errorType: 'network'
        }
    });
}

/**
 * Report a component error (for error boundaries)
 */
export function reportComponentError(
    error: unknown,
    componentStack: string | undefined,
    componentName?: string
): void {
    reportError({
        error,
        context: {
            componentStack: componentStack ? sanitizeString(componentStack) : undefined
        },
        source: componentName || 'Component',
        severity: 'error',
        tags: {
            errorType: 'component'
        }
    });
}
