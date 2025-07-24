/**
 * Main router configuration
 * Sets up all API routes and their respective handlers
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { docsRoutes } from './docs';
import { healthRoutes } from './health';
import { publicRoutes } from './public';

/**
 * Setup all application routes
 * @param app - OpenAPI Hono app instance
 */
export const setupRoutes = (app: OpenAPIHono) => {
    // Root endpoint
    app.get('/', (c) => {
        return c.json({
            name: 'Hospeda API',
            version: '1.0.0',
            status: 'operational',
            timestamp: new Date().toISOString(),
            documentation: '/docs'
        });
    });

    // Health check routes
    app.route('/health', healthRoutes);

    // Documentation and API specification
    app.route('/docs', docsRoutes);

    // Public API routes (no authentication required)
    app.route('/api/v1/public', publicRoutes);

    // Admin routes will be added later
    // app.route('/api/v1/admin', adminRoutes);
};
