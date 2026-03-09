/**
 * API Route Registration
 * Organizes all routes into three tiers:
 *   - Public:    /api/v1/public/*    (no auth required)
 *   - Protected: /api/v1/protected/* (auth required, own resources)
 *   - Admin:     /api/v1/admin/*     (admin role + permissions)
 */
import type { AppOpenAPI } from '../types';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

// ─── Entity route imports (from entity barrels) ───────────────────────────────
import {
    adminAccommodationRoutes,
    protectedAccommodationRoutes,
    publicAccommodationRoutes
} from './accommodation';
import { adminAmenityRoutes, protectedAmenityRoutes, publicAmenityRoutes } from './amenity';
import {
    adminAttractionRoutes,
    protectedAttractionRoutes,
    publicAttractionRoutes
} from './attraction';
import {
    adminDestinationRoutes,
    protectedDestinationRoutes,
    publicDestinationRoutes
} from './destination';
import { adminEventRoutes, protectedEventRoutes, publicEventRoutes } from './event';
import {
    adminEventLocationRoutes,
    protectedEventLocationRoutes,
    publicEventLocationRoutes
} from './event-location';
import {
    adminEventOrganizerRoutes,
    protectedEventOrganizerRoutes,
    publicEventOrganizerRoutes
} from './event-organizer';
import { adminFeatureRoutes, protectedFeatureRoutes, publicFeatureRoutes } from './feature';
import { adminPostRoutes, protectedPostRoutes, publicPostRoutes } from './post';
import { adminTagRoutes, publicTagRoutes } from './tag';

import {
    adminOwnerPromotionRoutes,
    protectedOwnerPromotionRoutes,
    publicOwnerPromotionRoutes
} from './owner-promotion';
// ─── Entities with admin-only or specialized tiers ──────────────────────────
import { adminPostSponsorRoutes } from './postSponsor';

// ─── Non-entity route imports ─────────────────────────────────────────────────
import { cronRoutes } from '../cron';
import { adminAuthRoutes, authRoutes, protectedAuthRoutes } from './auth';
import { betterAuthHandler } from './auth/handler';
import { createBillingRoutesHandler } from './billing';
import { adminBillingRoutes } from './billing/admin';
import { publicBillingRoutes } from './billing/public';
import { contactRoutes } from './contact';
import { adminCronRoutes } from './cron-admin';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { adminExchangeRateRoutes } from './exchange-rates/admin/index.js';
import { publicExchangeRateRoutes } from './exchange-rates/public/index.js';
import { publicFeedbackRoutes } from './feedback';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { metricsRoutes } from './metrics';
import { reportRoutes } from './reports';
import { adminSponsorshipRoutes, protectedSponsorshipRoutes } from './sponsorship';
import { adminSponsorshipLevelRoutes, publicSponsorshipLevelRoutes } from './sponsorship-level';
import {
    adminSponsorshipPackageRoutes,
    publicSponsorshipPackageRoutes
} from './sponsorship-package';
import { adminUserRoutes, protectedUserRoutes, publicUserRoutes } from './user';
import { protectedUserBookmarkRoutes } from './user-bookmark';
import { createMercadoPagoWebhookRoutes, webhookHealthRoutes } from './webhooks';
import { adminWebhookRouter } from './webhooks/admin';

import { ApiInfoSchema } from '@repo/schemas';
import { pastDueGraceMiddleware } from '../middlewares/past-due-grace.middleware';
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
        skipAuth: true,
        cacheTTL: 300
    }
});

export const setupRoutes = (app: AppOpenAPI) => {
    app.route('/', rootRoute);

    // ─── System routes ────────────────────────────────────────────────────────
    app.route('/health', healthRoutes);
    app.route('/health', dbHealthRoutes);
    app.route('/health', readyRoutes);
    app.route('/health', liveRoutes);
    app.route('/api/v1/admin/metrics', metricsRoutes);

    // ─── Auth routes ──────────────────────────────────────────────────────────
    app.route('/api/auth', betterAuthHandler);
    app.route('/api/v1/public/auth', authRoutes);

    try {
        // ═══════════════════════════════════════════════════════════════════════
        // PUBLIC ROUTES - No authentication required
        // ═══════════════════════════════════════════════════════════════════════

        apiLogger.debug('🔗 Registering public routes...');

        // Users (public read-only: getById, batch)
        app.route('/api/v1/public/users', publicUserRoutes);

        // Core entities
        app.route('/api/v1/public/accommodations', publicAccommodationRoutes);
        app.route('/api/v1/public/destinations', publicDestinationRoutes);
        app.route('/api/v1/public/events', publicEventRoutes);
        app.route('/api/v1/public/posts', publicPostRoutes);

        // Supporting entities
        app.route('/api/v1/public/amenities', publicAmenityRoutes);
        app.route('/api/v1/public/features', publicFeatureRoutes);
        app.route('/api/v1/public/attractions', publicAttractionRoutes);
        app.route('/api/v1/public/tags', publicTagRoutes);
        app.route('/api/v1/public/event-locations', publicEventLocationRoutes);
        app.route('/api/v1/public/event-organizers', publicEventOrganizerRoutes);

        // Owner promotions
        app.route('/api/v1/public/owner-promotions', publicOwnerPromotionRoutes);

        // Exchange rates (public read-only)
        app.route('/api/v1/public/exchange-rates', publicExchangeRateRoutes);

        // Other public routes (read-only)
        app.route('/api/v1/public/sponsorship-levels', publicSponsorshipLevelRoutes);
        app.route('/api/v1/public/sponsorship-packages', publicSponsorshipPackageRoutes);
        app.route('/api/v1/public/plans', publicBillingRoutes);
        app.route('/api/v1/public', contactRoutes);
        app.route('/api/v1/public/feedback', publicFeedbackRoutes);

        apiLogger.debug('✅ Public routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // PROTECTED ROUTES - Authentication required, own resources
        // ═══════════════════════════════════════════════════════════════════════

        // Enforce past-due grace period on ALL protected routes.
        // Users whose subscription grace period has expired get 402.
        // Exempt paths (payment-methods, checkout, reactivate) are handled
        // inside the middleware itself.
        app.use('/api/v1/protected/*', pastDueGraceMiddleware());

        apiLogger.debug('🔗 Registering protected routes...');

        app.route('/api/v1/protected/auth', protectedAuthRoutes);
        app.route('/api/v1/protected/users', protectedUserRoutes);
        app.route('/api/v1/protected/user-bookmarks', protectedUserBookmarkRoutes);
        app.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);
        app.route('/api/v1/protected/destinations', protectedDestinationRoutes);
        app.route('/api/v1/protected/events', protectedEventRoutes);
        app.route('/api/v1/protected/posts', protectedPostRoutes);
        app.route('/api/v1/protected/amenities', protectedAmenityRoutes);
        app.route('/api/v1/protected/features', protectedFeatureRoutes);
        app.route('/api/v1/protected/attractions', protectedAttractionRoutes);
        app.route('/api/v1/protected/event-locations', protectedEventLocationRoutes);
        app.route('/api/v1/protected/event-organizers', protectedEventOrganizerRoutes);
        app.route('/api/v1/protected/owner-promotions', protectedOwnerPromotionRoutes);
        app.route('/api/v1/protected/sponsorships', protectedSponsorshipRoutes);

        apiLogger.debug('✅ Protected routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // ADMIN ROUTES - Admin role + permissions required
        // ═══════════════════════════════════════════════════════════════════════

        apiLogger.debug('🔗 Registering admin routes...');

        // Users
        app.route('/api/v1/admin/users', adminUserRoutes);

        // Core entities
        app.route('/api/v1/admin/accommodations', adminAccommodationRoutes);
        app.route('/api/v1/admin/destinations', adminDestinationRoutes);
        app.route('/api/v1/admin/events', adminEventRoutes);
        app.route('/api/v1/admin/posts', adminPostRoutes);

        // Supporting entities
        app.route('/api/v1/admin/amenities', adminAmenityRoutes);
        app.route('/api/v1/admin/features', adminFeatureRoutes);
        app.route('/api/v1/admin/attractions', adminAttractionRoutes);
        app.route('/api/v1/admin/tags', adminTagRoutes);
        app.route('/api/v1/admin/event-locations', adminEventLocationRoutes);
        app.route('/api/v1/admin/event-organizers', adminEventOrganizerRoutes);
        app.route('/api/v1/admin/post-sponsors', adminPostSponsorRoutes);
        app.route('/api/v1/admin/owner-promotions', adminOwnerPromotionRoutes);

        // Sponsorship admin routes
        app.route('/api/v1/admin/sponsorships', adminSponsorshipRoutes);
        app.route('/api/v1/admin/sponsorship-levels', adminSponsorshipLevelRoutes);
        app.route('/api/v1/admin/sponsorship-packages', adminSponsorshipPackageRoutes);

        // Admin cron job management
        app.route('/api/v1/admin/cron', adminCronRoutes);

        // Exchange rates admin (admin-only management routes)
        app.route('/api/v1/admin/exchange-rates', adminExchangeRateRoutes);

        // Admin billing, webhooks, and auth monitoring
        app.route('/api/v1/admin/billing', adminBillingRoutes);
        app.route('/api/v1/admin/webhooks', adminWebhookRouter);
        app.route('/api/v1/admin/auth', adminAuthRoutes);

        apiLogger.debug('✅ Admin routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // PROTECTED TIER - Billing and Reports
        // ═══════════════════════════════════════════════════════════════════════

        // Billing routes (user-facing: trial, addons, promo-codes, subscriptions, etc.)
        app.route('/api/v1/protected/billing', createBillingRoutesHandler());

        // Reports routes (bug reports, labels)
        app.route('/api/v1/protected/reports', reportRoutes);

        // Internal: Vercel cron scheduler (requires CRON_SECRET, not a public API)
        app.route('/api/v1/cron', cronRoutes);

        // Webhook routes (public endpoints with signature verification)
        const mercadoPagoWebhookRoutes = createMercadoPagoWebhookRoutes();
        if (mercadoPagoWebhookRoutes) {
            app.route('/api/v1/webhooks/mercadopago', mercadoPagoWebhookRoutes);
        } else {
            apiLogger.warn('⚠️ MercadoPago webhook routes not registered - billing not configured');
        }
        app.route('/api/v1/webhooks', webhookHealthRoutes);
    } catch (error) {
        apiLogger.debug('❌ Failed to register routes:', String(error));
        throw error;
    }

    // Documentation routes (disabled in production for security)
    if (env.NODE_ENV !== 'production') {
        app.route('/docs', docsIndexRoutes);
        app.route('/docs', swaggerRoutes);
        app.route('/docs', scalarRoutes);
    } else {
        apiLogger.info('Documentation routes disabled in production');
    }
};
