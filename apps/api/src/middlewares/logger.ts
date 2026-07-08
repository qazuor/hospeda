/**
 * Logging middleware for API requests
 * Logs all incoming requests and responses with timing information
 * Uses structured apiLogger for consistency
 */
import type { MiddlewareHandler } from 'hono';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    // const path = c.req.path; // Available for future use

    if (env.API_LOG_LEVEL === 'debug') {
        apiLogger.debug(`🔍 Incoming request: ${method} ${url}`);

        // Special logging for OPTIONS requests (CORS preflight)
        if (method === 'OPTIONS') {
            const origin = c.req.header('Origin');
            const requestMethod = c.req.header('Access-Control-Request-Method');
            const requestHeaders = c.req.header('Access-Control-Request-Headers');
            apiLogger.debug(
                `🌐 CORS Preflight: Origin=${origin}, Method=${requestMethod}, Headers=${requestHeaders}`
            );
        }
    }

    await next();

    const duration = Date.now() - startTime;
    const status = c.res.status;

    const logMessage = `${method} ${url} ${status} ${duration}ms`;

    // The bare root `/` is hit by uptime/health probers (the real health check
    // at `/health` is registered before this middleware and already exempt).
    // Logging one line per probe is pure noise, so suppress its routine access
    // log — server errors on it are still logged below.
    const isHealthProbe = c.req.path === '/';

    // Use structured apiLogger for consistency. Server errors (5xx) are ALWAYS
    // logged — you never want to silently drop them. The routine access log
    // (2xx success + 4xx client warnings) is gated by API_ENABLE_REQUEST_LOGGING
    // and skipped for health probes.
    if (status >= 500) {
        apiLogger.error(`❌ HTTP ERROR => ${logMessage}`, 'ERROR');
    } else if (!env.API_ENABLE_REQUEST_LOGGING || isHealthProbe) {
        // Routine access log suppressed (request logging disabled or health probe).
    } else if (status >= 400) {
        apiLogger.warn(`⚠️ HTTP WARNING => ${logMessage}`, 'WARNING');
    } else {
        apiLogger.info(`✅ HTTP SUCCESS => ${logMessage}`, 'SUCCESS');
    }

    // Log response body in debug mode for errors
    if (env.API_LOG_LEVEL === 'debug' && status >= 400) {
        try {
            const responseClone = c.res.clone();
            const contentType = responseClone.headers.get('content-type') || '';
            const contentEncoding = responseClone.headers.get('content-encoding') || '';

            // Skip if content is compressed
            if (
                contentEncoding.includes('gzip') ||
                contentEncoding.includes('deflate') ||
                contentEncoding.includes('br')
            ) {
                apiLogger.error(
                    `📄 Error Response: Content-Encoding ${contentEncoding} (compressed, body not logged)`
                );
                return;
            }

            // Only log text-based content types
            if (
                contentType.includes('application/json') ||
                contentType.includes('text/') ||
                contentType.includes('application/xml') ||
                contentType === '' || // Sometimes error responses don't have content-type
                contentType.includes('application/problem+json')
            ) {
                const responseText = await responseClone.text();

                // Skip if response is empty
                if (!responseText || responseText.trim() === '') {
                    apiLogger.error('📄 Error Response Body: (empty)');
                    return;
                }

                // Check if the text contains binary/non-printable characters
                const hasBinaryContent = responseText.split('').some((char) => {
                    const code = char.charCodeAt(0);
                    return (
                        (code >= 0 && code <= 8) ||
                        (code >= 14 && code <= 31) ||
                        (code >= 127 && code <= 255)
                    );
                });
                if (hasBinaryContent) {
                    apiLogger.error('📄 Error Response: Binary content detected (body not logged)');
                    return;
                }

                try {
                    // Try to parse and pretty-print JSON
                    const jsonResponse = JSON.parse(responseText);
                    apiLogger.error(
                        '📄 Error Response Body:',
                        JSON.stringify(jsonResponse, null, 2)
                    );
                } catch {
                    // If not JSON, log as text (truncate if too long)
                    const truncatedText =
                        responseText.length > 1000
                            ? `${responseText.substring(0, 1000)}... (truncated)`
                            : responseText;
                    apiLogger.error(`📄 Error Response Body: ${truncatedText}`);
                }
            } else {
                apiLogger.error(
                    `📄 Error Response: Content-Type ${contentType} (non-text content, body not logged)`
                );
            }
        } catch (error) {
            apiLogger.error('💥 Failed to log response body:', String(error));
        }
    }
};
