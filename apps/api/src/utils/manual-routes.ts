/**
 * Central route registry for manual route definitions
 * Use this for routes that are not automatically detected from OpenAPI
 */

export interface ManualRouteDefinition {
    method: string;
    path: string;
    description: string;
    category: 'core' | 'documentation' | 'public' | 'admin' | 'other';
}

/**
 * Manually defined routes that should always be included
 * Add new routes here when they're not automatically detected
 */
export const MANUAL_ROUTES: ManualRouteDefinition[] = [
    // Core endpoints
    {
        method: 'GET',
        path: '/',
        description: 'API Information',
        category: 'core'
    },
    {
        method: 'GET',
        path: '/health',
        description: 'Health Check',
        category: 'core'
    },
    {
        method: 'GET',
        path: '/health/ready',
        description: 'Readiness Check',
        category: 'core'
    },
    {
        method: 'GET',
        path: '/health/live',
        description: 'Liveness Check',
        category: 'core'
    },

    // Documentation endpoints (not using OpenAPI createRoute pattern)
    {
        method: 'GET',
        path: '/docs',
        description: 'API Documentation (redirects to /docs/ui)',
        category: 'documentation'
    },
    {
        method: 'GET',
        path: '/docs/ui',
        description: 'Swagger UI Documentation',
        category: 'documentation'
    },
    {
        method: 'GET',
        path: '/docs/ui-alt',
        description: 'Alternative Swagger UI',
        category: 'documentation'
    },
    {
        method: 'GET',
        path: '/docs/openapi.json',
        description: 'OpenAPI JSON Specification',
        category: 'documentation'
    },
    {
        method: 'GET',
        path: '/openapi.json',
        description: 'OpenAPI JSON (alternative)',
        category: 'documentation'
    },

    // Public API endpoints (using OpenAPI patterns should be auto-detected)
    {
        method: 'GET',
        path: '/api/v1/public/accommodations',
        description: 'List accommodations with filtering',
        category: 'public'
    },
    {
        method: 'GET',
        path: '/api/v1/public/accommodations/{id}',
        description: 'Get accommodation details',
        category: 'public'
    }

    // Add new manual routes here as needed
    // Example:
    // { method: 'GET', path: '/api/v1/public/stats', description: 'API Statistics', category: 'public' },
];
