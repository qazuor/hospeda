import packageJSON from '../../package.json' with { type: 'json' };
import type { AppOpenAPI } from '../types';
import { accommodationRoutes } from './accommodation';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { userRoutes } from './user';

export const setupRoutes = (app: AppOpenAPI) => {
    // Root endpoint
    app.get('/', (c) => {
        return c.json({
            name: packageJSON.name || 'Hospeda API',
            version: packageJSON.version || '1.0.0',
            description: packageJSON.description || 'Hospeda API',
            status: 'operational',
            timestamp: new Date().toISOString(),
            documentation: '/docs'
        });
    });

    // Health check routes
    app.route('/health', healthRoutes);
    app.route('/health', dbHealthRoutes);
    app.route('/health', readyRoutes);
    app.route('/health', liveRoutes);

    // Public routes
    app.route('/api/v1/public/users', userRoutes);
    app.route('/api/v1/public/accommodations', accommodationRoutes);

    // Documentation routes
    app.route('/docs', docsIndexRoutes);
    app.route('/docs', swaggerRoutes);
    app.route('/docs', scalarRoutes);
};
