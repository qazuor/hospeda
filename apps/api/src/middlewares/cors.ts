/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers and preflight requests
 */
import { cors } from 'hono/cors';
import { getCorsConfig } from '../utils/env';

/**
 * Checks if an origin matches the allowed origins list,
 * supporting wildcard subdomain patterns (e.g., `*.hospeda.com.ar`).
 * Uses the same logic as originVerificationMiddleware in security.ts.
 */
function matchOrigin({
    requestOrigin,
    allowedOrigins
}: { requestOrigin: string; allowedOrigins: readonly string[] }): boolean {
    return allowedOrigins.some((allowed) => {
        if (allowed === '*' || allowed === requestOrigin) return true;
        // Support wildcard subdomains (e.g., *.example.com)
        // Must check for leading dot to prevent sibling domain matching
        if (allowed.startsWith('*.')) {
            const baseDomain = allowed.slice(1); // Keep the leading dot: ".example.com"
            return requestOrigin.endsWith(baseDomain);
        }
        return false;
    });
}

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
    const hasWildcard = corsConfig.origins.includes('*');
    if (hasWildcard) {
        credentials = false;
    }

    // If any origin uses wildcard subdomain patterns (*.example.com),
    // use a function for origin matching instead of a plain string array
    const hasWildcardSubdomains = corsConfig.origins.some((o: string) => o.startsWith('*.'));
    const origin =
        hasWildcardSubdomains && !hasWildcard
            ? (requestOrigin: string) =>
                  matchOrigin({ requestOrigin, allowedOrigins: corsConfig.origins })
                      ? requestOrigin
                      : ''
            : corsConfig.origins;

    const config = {
        origin,
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
 * Created lazily to ensure environment variables are loaded
 */
export const corsMiddleware = () => createCorsMiddleware();
