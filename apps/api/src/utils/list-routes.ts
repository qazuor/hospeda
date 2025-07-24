/**
 * Utility to list all registered routes
 */
import { logger } from '@repo/logger';

/**
 * Extract and display all registered routes from the Hono app
 */
export const listRoutes = () => {
    logger.info('📋 Registered API Endpoints:');
    logger.info('');

    // Core endpoints
    const coreEndpoints = [
        { method: 'GET', path: '/', description: 'API Information' },
        { method: 'GET', path: '/health', description: 'Health Check' },
        { method: 'GET', path: '/health/ready', description: 'Readiness Check' },
        { method: 'GET', path: '/health/live', description: 'Liveness Check' }
    ];

    // Documentation endpoints
    const docEndpoints = [
        { method: 'GET', path: '/docs', description: 'API Documentation (redirects to /docs/ui)' },
        { method: 'GET', path: '/docs/ui', description: 'Swagger UI Documentation' },
        { method: 'GET', path: '/docs/openapi.json', description: 'OpenAPI JSON Specification' },
        { method: 'GET', path: '/openapi.json', description: 'OpenAPI JSON (alternative)' }
    ];

    // Public API endpoints
    const publicEndpoints = [
        {
            method: 'GET',
            path: '/api/v1/public/accommodations',
            description: 'List accommodations with filtering'
        },
        {
            method: 'GET',
            path: '/api/v1/public/accommodations/{id}',
            description: 'Get accommodation details'
        },
        { method: 'GET', path: '/api/v1/public/destinations', description: 'List destinations' },
        {
            method: 'GET',
            path: '/api/v1/public/search',
            description: 'Global search with type filtering'
        }
    ];

    // Display grouped endpoints
    logger.info('🔧 Core Endpoints:');
    for (const endpoint of coreEndpoints) {
        logger.info(
            `  ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(35)} - ${endpoint.description}`
        );
    }

    logger.info('');
    logger.info('📖 Documentation:');
    for (const endpoint of docEndpoints) {
        logger.info(
            `  ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(35)} - ${endpoint.description}`
        );
    }

    logger.info('');
    logger.info('🌐 Public API:');
    for (const endpoint of publicEndpoints) {
        logger.info(
            `  ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(35)} - ${endpoint.description}`
        );
    }

    logger.info('');
    logger.info('🔗 Quick Links:');
    logger.info('  📚 Documentation: http://localhost:3001/docs');
    logger.info('  🔍 API Spec: http://localhost:3001/docs/openapi.json');
    logger.info('  ❤️  Health Check: http://localhost:3001/health');
    logger.info('');
};
