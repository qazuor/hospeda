/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers and preflight requests
 */
import { cors } from 'hono/cors';
import { getCorsConfig } from '../utils/env';

/**
 * Creates a CORS middleware with environment-based configuration
 * @param customConfig - Optional custom CORS configuration
 * @returns Configured CORS middleware
 */
export const createCorsMiddleware = (
    // biome-ignore lint/suspicious/noExplicitAny: CORS config can be flexible
    customConfig?: any
) => {
    const corsConfig = getCorsConfig();

    // Handle credentials based on origin (wildcard origin requires credentials: false)
    let credentials = corsConfig.allowCredentials;
    if (corsConfig.origins === '*') {
        credentials = false;
    }

    const config = {
        origin: corsConfig.origins,
        allowMethods: corsConfig.allowMethods,
        allowHeaders: corsConfig.allowHeaders,
        exposeHeaders: corsConfig.exposeHeaders,
        credentials,
        maxAge: corsConfig.maxAge,
        ...customConfig
    };

    return cors(config);
};

/**
 * Default CORS middleware instance
 * Uses environment-based configuration
 */
export const corsMiddleware = createCorsMiddleware();
