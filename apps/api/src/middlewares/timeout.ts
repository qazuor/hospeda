import { logger } from '@repo/logger';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Advanced timeout middleware with configurable timeouts by endpoint type
 */

/**
 * Timeout configuration by endpoint type
 */
const TIMEOUT_CONFIGS = {
    // Quick endpoints (health checks, simple queries)
    quick: 5000, // 5 seconds

    // Standard API endpoints
    standard: 30000, // 30 seconds

    // Search and complex queries
    search: 45000, // 45 seconds

    // Admin operations
    admin: 60000, // 1 minute

    // File uploads/downloads
    upload: 300000, // 5 minutes

    // Reports and analytics
    report: 120000, // 2 minutes

    // Default for unspecified endpoints
    default: 30000 // 30 seconds
} as const;

/**
 * Timeout configuration options
 */
interface TimeoutOptions {
    /** Timeout duration in milliseconds */
    timeout?: number;
    /** Endpoint type for predefined timeouts */
    type?: keyof typeof TIMEOUT_CONFIGS;
    /** Custom timeout message */
    message?: string;
    /** Enable detailed logging */
    enableLogging?: boolean;
    /** Custom timeout handler */
    onTimeout?: (context: Context) => Response | Promise<Response>;
}

/**
 * Create a timeout middleware with enhanced configuration
 *
 * @param options - Timeout configuration options
 * @returns {MiddlewareHandler} Timeout middleware
 */
export const timeoutMiddleware = (options: TimeoutOptions = {}): MiddlewareHandler => {
    const {
        timeout,
        type = 'default',
        message = 'Request timeout. The server took too long to respond.',
        enableLogging = true,
        onTimeout
    } = options;

    // Determine timeout duration
    const timeoutDuration = timeout || TIMEOUT_CONFIGS[type];

    return async (c, next) => {
        const startTime = Date.now();
        const requestId =
            c.req.header('X-Request-ID') ||
            `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create timeout promise with cleanup
        let timeoutId: NodeJS.Timeout | undefined;
        let isCompleted = false;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                if (!isCompleted) {
                    const duration = Date.now() - startTime;

                    if (enableLogging) {
                        logger.warn(
                            `Request timeout after ${duration}ms for ${c.req.method} ${c.req.path} (${timeoutDuration}ms limit) - Request ID: ${requestId}`
                        );
                    }

                    reject(new Error('TIMEOUT'));
                }
            }, timeoutDuration);
        });

        try {
            // Race between the actual request and timeout
            await Promise.race([
                next().then(() => {
                    isCompleted = true;
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                }),
                timeoutPromise
            ]);

            // Log successful requests if logging is enabled
            if (enableLogging && isCompleted) {
                const duration = Date.now() - startTime;
                if (duration > timeoutDuration * 0.8) {
                    // Log if near timeout threshold
                    logger.warn(
                        `Slow request completed in ${duration}ms for ${c.req.method} ${c.req.path} (${timeoutDuration}ms limit) - Request ID: ${requestId}`
                    );
                }
            }
        } catch (error) {
            // Clean up timeout if still active
            isCompleted = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (error instanceof Error && error.message === 'TIMEOUT') {
                // Handle timeout
                if (onTimeout) {
                    return onTimeout(c);
                }

                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'REQUEST_TIMEOUT',
                            message,
                            timeout: timeoutDuration,
                            requestId
                        }
                    },
                    408
                );
            }

            // Re-throw other errors
            throw error;
        }
    };
};

/**
 * Predefined timeout middlewares for common use cases
 */

/**
 * Quick timeout for health checks and simple endpoints
 */
export const quickTimeout = () =>
    timeoutMiddleware({
        type: 'quick',
        message: 'Quick endpoint timeout. This should respond within 5 seconds.'
    });

/**
 * Standard timeout for regular API endpoints
 */
export const standardTimeout = () =>
    timeoutMiddleware({
        type: 'standard',
        message: 'Standard API timeout. Request took longer than 30 seconds.'
    });

/**
 * Extended timeout for search operations
 */
export const searchTimeout = () =>
    timeoutMiddleware({
        type: 'search',
        message: 'Search operation timeout. Complex searches may take up to 45 seconds.'
    });

/**
 * Admin timeout for administrative operations
 */
export const adminTimeout = () =>
    timeoutMiddleware({
        type: 'admin',
        message: 'Admin operation timeout. Administrative tasks may take up to 1 minute.'
    });

/**
 * Upload timeout for file operations
 */
export const uploadTimeout = () =>
    timeoutMiddleware({
        type: 'upload',
        message: 'Upload timeout. File operations may take up to 5 minutes.'
    });

/**
 * Report timeout for analytics and reporting
 */
export const reportTimeout = () =>
    timeoutMiddleware({
        type: 'report',
        message: 'Report generation timeout. Reports may take up to 2 minutes to generate.'
    });

/**
 * Custom timeout with specific duration
 *
 * @param duration - Timeout duration in milliseconds
 * @param customMessage - Optional custom timeout message
 * @returns {MiddlewareHandler} Custom timeout middleware
 */
export const customTimeout = (duration: number, customMessage?: string): MiddlewareHandler => {
    return timeoutMiddleware({
        timeout: duration,
        message: customMessage || `Request timeout after ${duration}ms`,
        enableLogging: true
    });
};

/**
 * Progressive timeout middleware that adjusts based on endpoint complexity
 *
 * @param c - Hono context
 * @returns Appropriate timeout middleware based on the request
 */
export const progressiveTimeout = (c: Context): MiddlewareHandler => {
    const path = c.req.path;
    const method = c.req.method;

    // Determine timeout based on path patterns
    if (path.includes('/health') || path.includes('/ping')) {
        return quickTimeout();
    }

    if (path.includes('/search') || path.includes('/filter')) {
        return searchTimeout();
    }

    if (path.includes('/admin') || path.includes('/manage')) {
        return adminTimeout();
    }

    if (path.includes('/upload') || path.includes('/file')) {
        return uploadTimeout();
    }

    if (path.includes('/report') || path.includes('/analytics')) {
        return reportTimeout();
    }

    // POST/PUT operations generally need more time
    if (method === 'POST' || method === 'PUT') {
        return timeoutMiddleware({ type: 'standard' });
    }

    // Default timeout for other endpoints
    return standardTimeout();
};
