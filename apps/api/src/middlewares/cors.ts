import { logger } from '@repo/logger';
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

/**
 * Advanced CORS configuration for different environments and use cases
 */

/**
 * CORS configuration types
 */
interface CorsEnvironmentConfig {
    origins: string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge?: number;
}

/**
 * CORS configurations by environment
 */
const CORS_CONFIGS: Record<string, CorsEnvironmentConfig> = {
    development: {
        origins: [
            'http://localhost:3000',
            'http://localhost:4321',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:4321'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'X-API-Key',
            'X-Client-Version',
            'X-User-Agent',
            'Cache-Control'
        ],
        exposedHeaders: [
            'X-Total-Count',
            'X-Rate-Limit-Limit',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset',
            'X-Response-Time'
        ],
        maxAge: 86400 // 24 hours
    },

    production: {
        origins: [
            'https://hospeda.app',
            'https://www.hospeda.app',
            'https://admin.hospeda.app',
            'https://api.hospeda.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'X-API-Key',
            'X-Client-Version'
        ],
        exposedHeaders: [
            'X-Total-Count',
            'X-Rate-Limit-Limit',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset'
        ],
        maxAge: 86400 // 24 hours
    },

    testing: {
        origins: [
            'http://localhost:3000',
            'http://localhost:4321',
            'https://staging.hospeda.app',
            'https://preview.hospeda.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'X-API-Key',
            'X-Client-Version',
            'X-Test-Mode'
        ],
        exposedHeaders: [
            'X-Total-Count',
            'X-Rate-Limit-Limit',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset',
            'X-Test-Response'
        ],
        maxAge: 3600 // 1 hour for testing
    }
};

/**
 * Custom CORS options
 */
interface CustomCorsOptions {
    /** Environment to use configuration for */
    environment?: keyof typeof CORS_CONFIGS;
    /** Additional origins to allow */
    additionalOrigins?: string[];
    /** Override credentials setting */
    credentials?: boolean;
    /** Additional allowed headers */
    additionalHeaders?: string[];
    /** Enable detailed logging */
    enableLogging?: boolean;
    /** Custom origin validation function */
    originValidator?: (origin: string) => boolean;
}

/**
 * Advanced CORS middleware with environment-specific configurations
 *
 * @param options - Custom CORS configuration options
 * @returns {MiddlewareHandler} CORS middleware
 */
export const advancedCors = (options: CustomCorsOptions = {}): MiddlewareHandler => {
    const {
        environment = (process.env.NODE_ENV as keyof typeof CORS_CONFIGS) || 'development',
        additionalOrigins = [],
        credentials,
        additionalHeaders = [],
        enableLogging = false,
        originValidator
    } = options;

    // Get base configuration for environment
    const baseConfig = CORS_CONFIGS[environment] || CORS_CONFIGS.development;

    // Ensure baseConfig is defined
    if (!baseConfig) {
        throw new Error(`CORS configuration not found for environment: ${environment}`);
    }

    // Merge origins
    const origins = Array.isArray(baseConfig.origins)
        ? [...baseConfig.origins, ...additionalOrigins]
        : baseConfig.origins;

    // Merge headers
    const allowedHeaders = [...baseConfig.allowedHeaders, ...additionalHeaders];

    return cors({
        origin: (origin) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return origin;

            // Use custom validator if provided
            if (originValidator) {
                return originValidator(origin) ? origin : null;
            }

            // Check against allowed origins
            if (Array.isArray(origins)) {
                const isAllowed = origins.includes(origin);

                if (enableLogging) {
                    logger.info(
                        `CORS origin check: ${origin} - ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`
                    );
                }

                return isAllowed ? origin : null;
            }

            return origins ? origin : null;
        },
        credentials: credentials ?? baseConfig.credentials,
        allowMethods: baseConfig.methods,
        allowHeaders: allowedHeaders,
        exposeHeaders: baseConfig.exposedHeaders,
        maxAge: baseConfig.maxAge
    });
};

/**
 * Predefined CORS configurations
 */

/**
 * Development CORS with permissive settings
 */
export const devCors = () =>
    advancedCors({
        environment: 'development',
        enableLogging: true,
        additionalOrigins: [
            'http://localhost:5173', // Vite default
            'http://localhost:8080', // Webpack dev server
            'http://192.168.1.100:3000' // Local network testing
        ]
    });

/**
 * Production CORS with strict security
 */
export const prodCors = () =>
    advancedCors({
        environment: 'production',
        enableLogging: true,
        originValidator: (origin) => {
            // Additional security check for production
            return (
                !origin.includes('localhost') &&
                !origin.includes('127.0.0.1') &&
                origin.startsWith('https://')
            );
        }
    });

/**
 * Testing CORS for staging environments
 */
export const testCors = () =>
    advancedCors({
        environment: 'testing',
        enableLogging: true,
        additionalHeaders: ['X-Test-Token', 'X-Mock-Response']
    });

/**
 * API-only CORS for machine-to-machine communication
 */
export const apiCors = () =>
    advancedCors({
        environment: (process.env.NODE_ENV as keyof typeof CORS_CONFIGS) || 'development',
        credentials: false, // No cookies for API-only
        additionalHeaders: ['X-API-Version', 'X-Client-ID', 'X-Request-ID'],
        enableLogging: true
    });

/**
 * Public CORS for public endpoints (very permissive)
 */
export const publicCors = (): MiddlewareHandler => {
    return cors({
        origin: '*',
        credentials: false,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Accept'],
        maxAge: 86400
    });
};
