import type { AppOpenAPI } from '../types';
import { apiLogger } from '../utils/logger';
import { accommodationRoutes } from './accommodation';
import { attractionRoutes } from './attraction';
import { destinationRoutes } from './destination';
import { eventRoutes } from './event';
import { eventLocationRoutes } from './event-location';
import { eventOrganizerRoutes } from './event-organizer';
import { postRoutes } from './post';
import { sponsorRoutes } from './sponsor';

apiLogger.debug('🏠 Loading accommodation routes...');
apiLogger.debug('✅ Accommodation routes loaded successfully');

import { amenityRoutes } from './amenity';
import { authRoutes } from './auth';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { featureRoutes } from './feature';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { metricsRoutes } from './metrics';
import { userRoutes } from './user';

import { ApiInfoSchema } from '@repo/schemas';
import { createSimpleRoute } from '../utils/route-factory';

const rootRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'API Information',
    description: 'Returns basic information about the Hospeda API',
    tags: ['System'],
    responseSchema: ApiInfoSchema,
    handler: async () => ({
        name: 'hospeda-api',
        version: '0.0.1',
        description: 'Complete API for the Hospeda tourism accommodation platform',
        status: 'operational',
        timestamp: new Date().toISOString(),
        documentation: '/docs'
    }),
    options: {
        skipAuth: true, // Public endpoint
        cacheTTL: 300 // Cache for 5 minutes
    }
});

export const setupRoutes = (app: AppOpenAPI) => {
    app.route('/', rootRoute);

    // Health check routes
    app.route('/health', healthRoutes);
    app.route('/health', dbHealthRoutes);
    app.route('/health', readyRoutes);
    app.route('/health', liveRoutes);

    // Metrics routes
    app.route('/metrics', metricsRoutes);

    // Public routes
    app.route('/api/v1/public/users', userRoutes);

    try {
        apiLogger.debug('🔗 Registering accommodation routes...');
        app.route('/api/v1/public/accommodations', accommodationRoutes);
        apiLogger.debug('✅ Accommodation routes registered successfully');

        apiLogger.debug('🔗 Registering destination routes...');
        app.route('/api/v1/public/destinations', destinationRoutes);
        apiLogger.debug('✅ Destination routes registered successfully');

        apiLogger.debug('🔗 Registering event routes...');
        app.route('/api/v1/public/events', eventRoutes);
        apiLogger.debug('✅ Event routes registered successfully');

        apiLogger.debug('🔗 Registering post routes...');
        app.route('/api/v1/public/posts', postRoutes);
        apiLogger.debug('✅ Post routes registered successfully');

        apiLogger.debug('🔗 Registering amenity routes...');
        app.route('/api/v1/public', amenityRoutes);
        apiLogger.debug('✅ Amenity routes registered successfully');

        apiLogger.debug('🔗 Registering feature routes...');
        app.route('/api/v1/public', featureRoutes);
        apiLogger.debug('✅ Feature routes registered successfully');

        apiLogger.debug('🔗 Registering attraction routes...');
        app.route('/api/v1/public', attractionRoutes);
        apiLogger.debug('✅ Attraction routes registered successfully');

        apiLogger.debug('🔗 Registering sponsor routes...');
        app.route('/api/v1/public', sponsorRoutes);
        apiLogger.debug('✅ Sponsor routes registered successfully');

        apiLogger.debug('🔗 Registering event organizer routes...');
        app.route('/api/v1/public', eventOrganizerRoutes);
        apiLogger.debug('✅ Event organizer routes registered successfully');

        apiLogger.debug('🔗 Registering event location routes...');
        app.route('/api/v1/public', eventLocationRoutes);
        apiLogger.debug('✅ Event location routes registered successfully');
    } catch (error) {
        apiLogger.error('❌ Failed to register routes:', String(error));
        throw error;
    }

    app.route('/api/v1/public/auth', authRoutes);

    // Documentation routes
    app.route('/docs', docsIndexRoutes);
    app.route('/docs', swaggerRoutes);
    app.route('/docs', scalarRoutes);
};
