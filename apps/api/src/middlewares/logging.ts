import { logger } from '@repo/logger';
import type { Context, MiddlewareHandler } from 'hono';

/**
 * Advanced logging middleware for comprehensive request/response tracking
 */

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if path should be excluded from logging
 */
const shouldExclude = (path: string, excludePaths: string[]): boolean => {
    return excludePaths.some((excludePath) => {
        if (excludePath.includes('*')) {
            const pattern = excludePath.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(path);
        }
        return path === excludePath;
    });
};

/**
 * Logging configuration options
 */
interface LoggingOptions {
    /** Log request details */
    logRequests?: boolean;
    /** Log response details */
    logResponses?: boolean;
    /** Paths to exclude from logging */
    excludePaths?: string[];
    /** Enable detailed logging */
    detailed?: boolean;
}

/**
 * Advanced logging middleware
 *
 * @param options - Logging configuration options
 * @returns {MiddlewareHandler} Logging middleware
 */
export const advancedLogging = (options: LoggingOptions = {}): MiddlewareHandler => {
    const {
        logRequests = true,
        logResponses = true,
        excludePaths = ['/health', '/ping', '/favicon.ico'],
        detailed = false
    } = options;

    return async (c: Context, next) => {
        const startTime = Date.now();
        const requestId = c.req.header('X-Request-ID') || generateRequestId();

        // Add request ID to context for use in other middlewares
        c.set('requestId', requestId);

        // Check if this path should be excluded
        if (shouldExclude(c.req.path, excludePaths)) {
            return next();
        }

        // Log request
        if (logRequests) {
            const ip =
                c.req.header('CF-Connecting-IP') ||
                c.req.header('X-Forwarded-For') ||
                c.req.header('X-Real-IP') ||
                'unknown';

            if (detailed) {
                logger.info(
                    `[${requestId}] ${c.req.method} ${c.req.path} - IP: ${ip} - UA: ${c.req.header('User-Agent') || 'unknown'}`
                );
            } else {
                logger.info(`[${requestId}] ${c.req.method} ${c.req.path}`);
            }
        }

        let responseStatus = 200;
        let responseError: Error | null = null;

        try {
            await next();
            responseStatus = c.res.status;
        } catch (error) {
            responseError = error instanceof Error ? error : new Error('Unknown error');
            responseStatus = 500;
            throw error;
        } finally {
            // Log response
            if (logResponses) {
                const duration = Date.now() - startTime;

                if (responseError) {
                    logger.error(
                        `[${requestId}] ${c.req.method} ${c.req.path} - ${responseStatus} - ${duration}ms - ERROR: ${responseError.message}`
                    );
                } else if (responseStatus >= 400) {
                    logger.warn(
                        `[${requestId}] ${c.req.method} ${c.req.path} - ${responseStatus} - ${duration}ms`
                    );
                } else {
                    logger.info(
                        `[${requestId}] ${c.req.method} ${c.req.path} - ${responseStatus} - ${duration}ms`
                    );
                }
            }
        }
    };
};

/**
 * Predefined logging configurations
 */

/**
 * Development logging with detailed information
 */
export const devLogging = () =>
    advancedLogging({
        logRequests: true,
        logResponses: true,
        detailed: true,
        excludePaths: ['/health', '/ping']
    });

/**
 * Production logging with security-focused configuration
 */
export const prodLogging = () =>
    advancedLogging({
        logRequests: true,
        logResponses: true,
        detailed: false,
        excludePaths: ['/health', '/ping', '/metrics', '/favicon.ico']
    });

/**
 * Debug logging for troubleshooting
 */
export const debugLogging = () =>
    advancedLogging({
        logRequests: true,
        logResponses: true,
        detailed: true,
        excludePaths: [] // Log everything
    });

/**
 * Minimal logging for high-performance scenarios
 */
export const minimalLogging = () =>
    advancedLogging({
        logRequests: false,
        logResponses: true,
        detailed: false,
        excludePaths: ['/health', '/ping', '/metrics']
    });
