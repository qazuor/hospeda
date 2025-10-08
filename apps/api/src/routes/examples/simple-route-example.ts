/**
 * Example of using the new createSimpleRoute factory
 * Demonstrates how to create simple endpoints with minimal boilerplate
 */

import { SystemHealthSchema, SystemPingSchema, SystemVersionSchema } from '@repo/schemas';
import { createSimpleRoute } from '../../utils/route-factory';

/**
 * Example: Version endpoint using createSimpleRoute
 * This demonstrates the new simple route factory for endpoints that don't need complex validation
 */

export const versionRoute = createSimpleRoute({
    method: 'get',
    path: '/version',
    summary: 'Get API version information',
    description: 'Returns version, environment, and build information',
    tags: ['System'],
    responseSchema: SystemVersionSchema,
    handler: async (_ctx) => {
        return {
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            buildTime: new Date().toISOString(),
            commit: process.env.COMMIT_SHA || 'unknown'
        };
    },
    options: {
        skipAuth: true, // Public endpoint
        cacheTTL: 300 // Cache for 5 minutes
    }
});

/**
 * Example: Health check with custom middleware
 */
export const quickHealthRoute = createSimpleRoute({
    method: 'get',
    path: '/quick-health',
    summary: 'Quick health check',
    description: 'Lightweight health check endpoint',
    tags: ['Health'],
    responseSchema: SystemHealthSchema,
    handler: async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        customRateLimit: { requests: 1000, windowMs: 60000 } // Higher limit for health checks
    }
});

/**
 * Example: Using createSimpleRoute with POST method
 */
export const pingRoute = createSimpleRoute({
    method: 'post',
    path: '/ping',
    summary: 'Ping endpoint',
    description: 'Simple ping endpoint that echoes back a response',
    tags: ['System'],
    responseSchema: SystemPingSchema,
    handler: async (ctx) => {
        return {
            message: 'pong',
            timestamp: new Date().toISOString(),
            requestId: ctx.get('requestId') || 'unknown'
        };
    }
});
