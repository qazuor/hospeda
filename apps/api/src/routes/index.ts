import type { AppOpenAPI } from '../types';
import { accommodationRoutes } from './accommodation';
import { authRoutes } from './auth';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { metricsRoutes } from './metrics';
import { userRoutes } from './user';

export const setupRoutes = (app: AppOpenAPI) => {
    // Root endpoint
    app.get('/', (c) => {
        return c.json({
            name: 'hospeda-api',
            version: '0.0.1',
            description: 'Complete API for the Hospeda tourism accommodation platform',
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

    // Health check routes
    app.route('/metrics', metricsRoutes);

    // Public routes
    app.route('/api/v1/public/users', userRoutes);
    app.route('/api/v1/public/accommodations', accommodationRoutes);
    app.route('/api/v1/public/auth', authRoutes);

    // Documentation routes
    app.route('/docs', docsIndexRoutes);
    app.route('/docs', swaggerRoutes);
    app.route('/docs', scalarRoutes);
};
