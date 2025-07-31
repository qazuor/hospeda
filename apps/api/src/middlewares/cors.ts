/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers and preflight requests
 */
import { cors } from 'hono/cors';
import { env } from '../utils/env';

/**
 * Creates a CORS middleware with environment-based configuration
 * @param customConfig - Optional custom CORS configuration
 * @returns Configured CORS middleware
 */
export const createCorsMiddleware = (
    // biome-ignore lint/suspicious/noExplicitAny: CORS config can be flexible
    customConfig?: any
) => {
    // Parse origins from environment variable
    const origins =
        env.CORS_ORIGINS === '*' ? '*' : env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

    // Parse methods from environment variable
    const allowMethods = env.CORS_ALLOW_METHODS.split(',').map((method) => method.trim());

    // Parse headers from environment variables
    const allowHeaders = env.CORS_ALLOW_HEADERS.split(',').map((header) => header.trim());
    const exposeHeaders = env.CORS_EXPOSE_HEADERS.split(',').map((header) => header.trim());

    // Handle credentials based on origin
    let credentials = env.CORS_ALLOW_CREDENTIALS;
    if (origins === '*') {
        credentials = false; // Wildcard origin requires credentials: false
    }

    const config = {
        origin: origins,
        allowMethods,
        allowHeaders,
        exposeHeaders,
        credentials,
        maxAge: env.CORS_MAX_AGE,
        ...customConfig
    };

    return cors(config);
};

/**
 * Default CORS middleware instance
 * Uses environment-based configuration
 */
export const corsMiddleware = createCorsMiddleware();
