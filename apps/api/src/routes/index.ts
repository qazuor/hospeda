import type { AppOpenAPI } from '../types';
import { apiLogger } from '../utils/logger';
import { accommodationRoutes } from './accommodation';
import { attractionRoutes } from './attraction';
import { destinationRoutes } from './destination';
import { eventRoutes } from './event';
import { eventLocationRoutes } from './event-location';
import { eventOrganizerRoutes } from './event-organizer';
import { postRoutes } from './post';

apiLogger.debug('🏠 Loading accommodation routes...');
apiLogger.debug('✅ Accommodation routes loaded successfully');

import { amenityRoutes } from './amenity';
import { authRoutes } from './auth';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { featureRoutes } from './feature';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { metricsRoutes } from './metrics';
import { ownerPromotionRoutes } from './owner-promotion';
import { sponsorshipRoutes } from './sponsorship';
import { sponsorshipLevelRoutes } from './sponsorship-level';
import { sponsorshipPackageRoutes } from './sponsorship-package';
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

    // Auth routes - MUST be registered first to avoid conflicts with wildcard routes
    // Routes mounted at /api/v1/public with /:id patterns would otherwise catch /auth/sync
    app.route('/api/v1/public/auth', authRoutes);

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
        app.route('/api/v1/attractions', attractionRoutes);
        apiLogger.debug('✅ Attraction routes registered successfully');

        apiLogger.debug('🔗 Registering event organizer routes...');
        app.route('/api/v1/public', eventOrganizerRoutes);
        app.route('/api/v1/event-organizers', eventOrganizerRoutes);
        apiLogger.debug('✅ Event organizer routes registered successfully');

        apiLogger.debug('🔗 Registering event location routes...');
        app.route('/api/v1/public', eventLocationRoutes);
        app.route('/api/v1/event-locations', eventLocationRoutes);
        apiLogger.debug('✅ Event location routes registered successfully');

        apiLogger.debug('🔗 Registering sponsorship level routes...');
        app.route('/api/v1/public/sponsorship-levels', sponsorshipLevelRoutes);
        apiLogger.debug('✅ Sponsorship level routes registered successfully');

        apiLogger.debug('🔗 Registering sponsorship package routes...');
        app.route('/api/v1/public/sponsorship-packages', sponsorshipPackageRoutes);
        apiLogger.debug('✅ Sponsorship package routes registered successfully');

        apiLogger.debug('🔗 Registering sponsorship routes...');
        app.route('/api/v1/sponsorships', sponsorshipRoutes);
        apiLogger.debug('✅ Sponsorship routes registered successfully');

        apiLogger.debug('🔗 Registering owner promotion routes...');
        app.route('/api/v1/public/owner-promotions', ownerPromotionRoutes);
        apiLogger.debug('✅ Owner promotion routes registered successfully');
    } catch (error) {
        apiLogger.debug('❌ Failed to register routes:', String(error));
        throw error;
    }

    // Documentation routes
    app.route('/docs', docsIndexRoutes);
    app.route('/docs', swaggerRoutes);
    app.route('/docs', scalarRoutes);
};
