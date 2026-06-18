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
import { adminCommentRoutes, protectedCommentRoutes } from './comment';
import { adminCommerceRoutes, publicCommerceRoutes } from './commerce';
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
import {
    adminExperienceRoutes,
    protectedExperienceRoutes,
    publicExperienceRoutes
} from './experience';
import { adminFeatureRoutes, protectedFeatureRoutes, publicFeatureRoutes } from './feature';
import {
    adminGastronomyRoutes,
    protectedGastronomyRoutes,
    publicGastronomyRoutes
} from './gastronomy';
import { protectedHostRoutes } from './host';
import { protectedHostOnboardingRoutes } from './host-onboarding';
import { adminHostTradeRoutes, protectedHostTradeRoutes } from './host-trade';
import { adminPostRoutes, protectedPostRoutes, publicPostRoutes } from './post';
import {
    adminPostTagAssignmentRoutes,
    adminPostTagCrudRoutes,
    publicPostTagRoutes
} from './tag/post-tag/index.js';
import {
    adminEntityTagRoutes,
    adminInternalTagRoutes,
    adminOwnTagRoutes,
    adminSystemTagRoutes,
    adminUserTagModerationRoutes
} from './tag/user-tag/index.js';

import { adminOwnerPromotionRoutes, protectedOwnerPromotionRoutes } from './owner-promotion';
// ─── Entities with admin-only or specialized tiers ──────────────────────────
import { adminPostSponsorRoutes } from './postSponsor';

import {
    adminAiCredentialsRoutes,
    adminAiPromptsRoutes,
    adminAiSettingsRoutes,
    adminAiTranslateRoute,
    adminAiUsageRoutes
} from './ai/index.js';
import { protectedAiRoutes } from './ai/protected/index.js';
import { adminAppLogRoutes } from './app-logs';
// ─── Non-entity route imports ─────────────────────────────────────────────────
import { adminAuthRoutes, authRoutes, protectedAuthRoutes } from './auth';
import { betterAuthHandler } from './auth/handler';
import { createBillingRoutesHandler } from './billing';
import { adminBillingRoutes } from './billing/admin';
import { publicBillingRoutes } from './billing/public';
import { contactRoutes } from './contact';
import { adminContentModerationRoutes } from './content-moderation/admin';
import { adminCronRoutes } from './cron-admin';
import { docsIndexRoutes, scalarRoutes, swaggerRoutes } from './docs';
import { adminExchangeRateRoutes } from './exchange-rates/admin/index.js';
import { publicExchangeRateRoutes } from './exchange-rates/public/index.js';
import { publicFeedbackRoutes } from './feedback';
import { adminGeocodingRoutes, protectedGeocodingRoutes } from './geocoding';
import { dbHealthRoutes, healthRoutes, liveRoutes, readyRoutes } from './health';
import { mediaHealthRoutes } from './health/media';
import { adminMediaRoutes } from './media/admin';
import { protectedMediaRoutes } from './media/protected';
import { metricsRoutes } from './metrics';
import { adminModerationRoutes } from './moderation/admin';
import {
    newsletterAdminRoutes,
    newsletterProtectedRoutes,
    newsletterPublicRoutes,
    newsletterRoutes
} from './newsletter';
import { adminPlatformSettingsRoutes } from './platform-settings/admin/index.js';
import { publicPlatformSettingsRoutes } from './platform-settings/public/index.js';
import { protectedProfileRoutes } from './profile';
import { revalidationRouter } from './revalidation';
import { publicSearchRoutes } from './search/public';
import { adminSponsorshipRoutes, protectedSponsorshipRoutes } from './sponsorship';
import { adminSponsorshipLevelRoutes } from './sponsorship-level';
import { adminSponsorshipPackageRoutes } from './sponsorship-package';
import { publicStatsRoutes } from './stats/public';
import { adminSystemRoutes } from './system/admin';
// SPEC-217: static import (NOT require) so tsup inlines qzpay-control once and it
// shares the single @repo/billing test-control `state` singleton with applyTestControl.
// A dynamic require() here produced a second module instance under the ESM bundle,
// so the failNext queue written by the HTTP handler was invisible to applyTestControl.
// The module is inert in production (every entry point is gated by isTestControlEnabled()).
import { createQZPayTestControlRoutes } from './test/qzpay-control.js';
import { publicTestimonialRoutes } from './testimonials/public';
import { adminUserRoutes, protectedUserRoutes, publicUserRoutes } from './user';
import { protectedUserBookmarkRoutes, publicUserBookmarkRoutes } from './user-bookmark';
import { protectedUserBookmarkCollectionRoutes } from './user-bookmark-collection';
import { adminViewsRoutes, protectedViewsRoutes, viewsRoutes } from './views';
import {
    brevoWebhookRoutes,
    createMercadoPagoWebhookRoutes,
    webhookHealthRoutes
} from './webhooks';
import { adminWebhookRouter } from './webhooks/admin';
import { protectedWhatsNewRoutes } from './whats-new';

import { ApiInfoSchema } from '@repo/schemas';
import { mustChangePasswordGate } from '../middlewares/must-change-password';
import { pastDueGraceMiddleware } from '../middlewares/past-due-grace.middleware';
import { createSimpleRoute } from '../utils/route-factory';
import {
    adminConversationsRouter,
    protectedConversationRoutes,
    publicConversationsRouter
} from './conversations';

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
    // Media provider auth check — public, unauthenticated, returns 503 when
    // Cloudinary credentials are missing or invalid (SPEC-078-GAPS GAP-078-232).
    app.route('/api/v1/public/health', mediaHealthRoutes);
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
        // Commerce listings: gastronomy (SPEC-239 T-042)
        app.route('/api/v1/public/gastronomies', publicGastronomyRoutes);
        // Commerce listings: experience (SPEC-240 T-019)
        app.route('/api/v1/public/experiences', publicExperienceRoutes);
        // Commerce lead intake — public acquisition form (SPEC-239 T-047 US-1)
        app.route('/api/v1/public/commerce', publicCommerceRoutes);
        app.route('/api/v1/public/destinations', publicDestinationRoutes);
        app.route('/api/v1/public/events', publicEventRoutes);

        // PostTag public listing (SPEC-086 — public SEO taxonomy for blog posts).
        // MUST be mounted BEFORE `/api/v1/public/posts` because Hono matches mount
        // prefixes in registration order: registering `/posts` first would route
        // any `/posts/tags` request into the posts router (where it falls into the
        // `/:id` handler with id="tags" and fails UUID validation with 400).
        app.route('/api/v1/public/posts/tags', publicPostTagRoutes);
        app.route('/api/v1/public/posts', publicPostRoutes);

        // Supporting entities
        app.route('/api/v1/public/amenities', publicAmenityRoutes);
        app.route('/api/v1/public/features', publicFeatureRoutes);
        app.route('/api/v1/public/attractions', publicAttractionRoutes);
        app.route('/api/v1/public/event-locations', publicEventLocationRoutes);
        app.route('/api/v1/public/event-organizers', publicEventOrganizerRoutes);

        // Exchange rates (public read-only — consumed by the web frontend
        // for USD/ARS price conversion).
        app.route('/api/v1/public/exchange-rates', publicExchangeRateRoutes);

        // Other public routes (read-only)
        app.route('/api/v1/public/plans', publicBillingRoutes);
        app.route('/api/v1/public', contactRoutes);
        app.route('/api/v1/public', newsletterRoutes);
        // SPEC-101 public newsletter — token-gated verify + unsubscribe redirects.
        app.route('/api/v1/public/newsletter', newsletterPublicRoutes);
        app.route('/api/v1/public/feedback', publicFeedbackRoutes);

        // Global platform announcements (SPEC-156 T-010): cross-device cache
        // for the web layout banner. Reads from platform_settings.announcements.global.
        app.route('/api/v1/public/announcements', publicPlatformSettingsRoutes);

        // Conversations (guest-owner messaging — SPEC-085)
        // Public:    /api/v1/public/conversations/*
        // Protected: /api/v1/protected/conversations/*
        // Admin:     /api/v1/admin/conversations/*   (T-011)
        app.route('/api/v1/public/conversations', publicConversationsRouter);
        app.route('/api/v1/protected/conversations', protectedConversationRoutes);

        // Unified public search (SPEC-096 / REQ-096-04)
        app.route('/api/v1/public/search', publicSearchRoutes);

        // Platform statistics
        app.route('/api/v1/public/stats', publicStatsRoutes);

        // Testimonials
        app.route('/api/v1/public/testimonials', publicTestimonialRoutes);

        // User bookmarks (public count by entity — no auth required)
        app.route('/api/v1/public/user-bookmarks', publicUserBookmarkRoutes);

        // Cross-entity view tracking capture (SPEC-159 T-008)
        // Fire-and-forget; always 202. No auth required.
        app.route('/api/v1/public', viewsRoutes);

        apiLogger.debug('✅ Public routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // PROTECTED ROUTES - Authentication required, own resources
        // ═══════════════════════════════════════════════════════════════════════

        // Enforce past-due grace period on ALL protected routes.
        // Users whose subscription grace period has expired get 402.
        // Exempt paths (payment-methods, checkout, reactivate) are handled
        // inside the middleware itself.
        app.use('/api/v1/protected/*', pastDueGraceMiddleware());

        // SPEC-239 T-041: Force-password-change gate on ALL protected routes.
        // Commerce owner accounts are provisioned with mustChangePassword=true.
        // Any protected request from such a user returns 403 PASSWORD_CHANGE_REQUIRED
        // until they change their password via /api/v1/protected/auth/change-password.
        // The exempt path list is maintained inside the middleware itself.
        app.use('/api/v1/protected/*', mustChangePasswordGate());

        apiLogger.debug('🔗 Registering protected routes...');

        app.route('/api/v1/protected/auth', protectedAuthRoutes);
        app.route('/api/v1/protected/users', protectedUserRoutes);

        // Profile completion flow (SPEC-113)
        app.route('/api/v1/protected/profile', protectedProfileRoutes);
        app.route('/api/v1/protected/user-bookmarks', protectedUserBookmarkRoutes);
        app.route(
            '/api/v1/protected/user-bookmark-collections',
            protectedUserBookmarkCollectionRoutes
        );
        app.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);
        // Commerce listings: gastronomy (SPEC-239 T-043 / T-044)
        app.route('/api/v1/protected/gastronomies', protectedGastronomyRoutes);
        // Commerce listings: experience (SPEC-240 T-020)
        app.route('/api/v1/protected/experiences', protectedExperienceRoutes);
        app.route('/api/v1/protected/host', protectedHostRoutes);
        app.route('/api/v1/protected/host-trades', protectedHostTradeRoutes);
        app.route('/api/v1/protected/host-onboarding', protectedHostOnboardingRoutes);
        app.route('/api/v1/protected/destinations', protectedDestinationRoutes);
        app.route('/api/v1/protected/events', protectedEventRoutes);
        app.route('/api/v1/protected/posts', protectedPostRoutes);
        app.route('/api/v1/protected/comments', protectedCommentRoutes);
        app.route('/api/v1/protected/amenities', protectedAmenityRoutes);
        app.route('/api/v1/protected/features', protectedFeatureRoutes);
        app.route('/api/v1/protected/attractions', protectedAttractionRoutes);
        app.route('/api/v1/protected/event-locations', protectedEventLocationRoutes);
        app.route('/api/v1/protected/event-organizers', protectedEventOrganizerRoutes);
        app.route('/api/v1/protected/owner-promotions', protectedOwnerPromotionRoutes);
        app.route('/api/v1/protected/sponsorships', protectedSponsorshipRoutes);

        // Media (avatar uploads for authenticated users)
        app.route('/api/v1/protected/media', protectedMediaRoutes);

        // What's New (SPEC-175 — role-filtered release-notes with seen state)
        app.route('/api/v1/protected/whats-new', protectedWhatsNewRoutes);

        // Cross-entity view stats (SPEC-159 T-009/T-010)
        // Protected: host accommodation stats + editor post/event stats.
        // Public capture (T-008) lives under /api/v1/public above.
        app.route('/api/v1/protected/views', protectedViewsRoutes);

        // SPEC-208 — Protected geocoding proxy for the web accommodation editor
        app.route('/api/v1/protected/geocoding', protectedGeocodingRoutes);

        // AI protected (SPEC-198 T-004 — text-improve stream;
        // SPEC-199 search-intent and SPEC-200 chat will be added as
        // sibling spec handlers land; see ai/protected/index.ts for slots).
        app.route('/api/v1/protected/ai', protectedAiRoutes);

        // Newsletter (SPEC-101 — subscribe / status / resend / unsubscribe live
        // under /api/v1/protected/newsletter/*, the routes mount themselves at
        // /newsletter/<verb> so we don't double-prefix here).
        app.route('/api/v1/protected', newsletterProtectedRoutes);

        // Newsletter admin routes (SPEC-101 T-101-27 / T-101-28 — campaign CRUD +
        // actions + metrics). Mounted separately from admin billing/user/etc because
        // the newsletter feature is self-contained.
        // Note: more-specific action paths (/:id/send, /:id/cancel, etc.) are
        // registered BEFORE /:id in the sub-router, so Hono resolves them correctly.
        app.route('/api/v1/admin/newsletter', newsletterAdminRoutes);

        apiLogger.debug('✅ Protected routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // ADMIN ROUTES - Admin role + permissions required
        // ═══════════════════════════════════════════════════════════════════════

        apiLogger.debug('🔗 Registering admin routes...');

        // Users
        app.route('/api/v1/admin/users', adminUserRoutes);

        // Core entities
        app.route('/api/v1/admin/accommodations', adminAccommodationRoutes);
        // Commerce listings: gastronomy (SPEC-239 T-045 / T-046)
        app.route('/api/v1/admin/gastronomies', adminGastronomyRoutes);
        // Commerce listings: experience (SPEC-240 T-021)
        app.route('/api/v1/admin/experiences', adminExperienceRoutes);
        // Commerce leads admin management (SPEC-239 T-047)
        app.route('/api/v1/admin/commerce', adminCommerceRoutes);
        app.route('/api/v1/admin/destinations', adminDestinationRoutes);
        app.route('/api/v1/admin/events', adminEventRoutes);

        // SPEC-097 — Geocoding proxy for the admin location picker
        app.route('/api/v1/admin/geocoding', adminGeocodingRoutes);

        // PostTag admin routes (SPEC-086 — public SEO taxonomy for blog posts)
        // IMPORTANT: more-specific prefix /posts/tags MUST be registered BEFORE /posts
        // to prevent Hono from matching GET /posts/tags as GET /posts/:id with id='tags'.
        // CRUD: GET /posts/tags, POST /posts/tags, GET /posts/tags/:id, etc.
        app.route('/api/v1/admin/posts/tags', adminPostTagCrudRoutes);
        // Core post CRUD
        app.route('/api/v1/admin/posts', adminPostRoutes);
        // Assignment: POST /posts/:postId/tags, DELETE /posts/:postId/tags/:tagId
        // Registered after /posts/tags to avoid conflict but fine — assignment paths have /:postId/ prefix
        app.route('/api/v1/admin/posts', adminPostTagAssignmentRoutes);

        // Cross-entity comments (POST + EVENT) — SPEC-165
        app.route('/api/v1/admin/comments', adminCommentRoutes);

        // Supporting entities
        app.route('/api/v1/admin/amenities', adminAmenityRoutes);
        app.route('/api/v1/admin/features', adminFeatureRoutes);
        app.route('/api/v1/admin/attractions', adminAttractionRoutes);

        // Host-trade directory (SPEC-241) — admin-curated; host read perk
        app.route('/api/v1/admin/host-trades', adminHostTradeRoutes);

        // User-tag admin routes (SPEC-086 T-025..T-028)
        // IMPORTANT mounting order: more-specific prefixes MUST be registered BEFORE
        // the generic /admin/tags router. If /admin/tags is mounted first, Hono
        // would match GET /admin/tags/internal as GET /admin/tags/:id with id='internal'.
        app.route('/api/v1/admin/tags/internal', adminInternalTagRoutes);
        app.route('/api/v1/admin/tags/system', adminSystemTagRoutes);
        app.route('/api/v1/admin/tags/own', adminOwnTagRoutes);
        app.route('/api/v1/admin/tags/user', adminUserTagModerationRoutes);

        // Entity tag assignment + attribution (SPEC-086 T-026, T-028)
        // Mounted at /admin/entities. More-specific paths in the sub-router itself
        // handle ordering: GET /:type/:id/tags/own vs GET /:type/:id/tags.
        app.route('/api/v1/admin/entities', adminEntityTagRoutes);
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

        // Admin app log viewer (SPEC-184)
        app.route('/api/v1/admin/logs', adminAppLogRoutes);

        // Admin view stats (SPEC-197 T-008–T-011)
        app.route('/api/v1/admin/views', adminViewsRoutes);

        // Conversations admin (SPEC-085 T-011)
        app.route('/api/v1/admin/conversations', adminConversationsRouter);

        // Exchange rates admin (admin-only management routes)
        app.route('/api/v1/admin/exchange-rates', adminExchangeRateRoutes);

        // Admin billing, webhooks, and auth monitoring
        app.route('/api/v1/admin/billing', adminBillingRoutes);
        app.route('/api/v1/admin/webhooks', adminWebhookRouter);
        app.route('/api/v1/admin/auth', adminAuthRoutes);

        // Moderation aggregation — pending count across content entities (SPEC-155 T-010)
        app.route('/api/v1/admin/moderation', adminModerationRoutes);
        app.route('/api/v1/admin/content-moderation', adminContentModerationRoutes);

        // System operations — health rollup for the admin dashboard (SPEC-155 card E)
        app.route('/api/v1/admin/system', adminSystemRoutes);

        // ISR revalidation management (admin only)
        app.route('/api/v1/admin/revalidation', revalidationRouter);

        // Platform settings admin (SPEC-156 PR-1: SEO defaults, maintenance mode, announcements)
        app.route('/api/v1/admin/platform-settings', adminPlatformSettingsRoutes);

        // AI admin (SPEC-173: credential vault, settings, prompt versions, usage reporting — AI_SETTINGS_MANAGE)
        app.route('/api/v1/admin/ai/credentials', adminAiCredentialsRoutes);
        app.route('/api/v1/admin/ai/settings', adminAiSettingsRoutes);
        app.route('/api/v1/admin/ai/prompts', adminAiPromptsRoutes);
        app.route('/api/v1/admin/ai/usage', adminAiUsageRoutes);
        app.route('/api/v1/admin/ai/translate', adminAiTranslateRoute);

        // Media (entity image uploads + asset deletion)
        app.route('/api/v1/admin/media', adminMediaRoutes);

        apiLogger.debug('✅ Admin routes registered successfully');

        // ═══════════════════════════════════════════════════════════════════════
        // PROTECTED TIER - Billing and Reports
        // ═══════════════════════════════════════════════════════════════════════

        // Billing routes (user-facing: trial, addons, promo-codes, subscriptions, etc.)
        app.route('/api/v1/protected/billing', createBillingRoutesHandler());

        // Webhook routes (public endpoints with signature verification)
        const mercadoPagoWebhookRoutes = createMercadoPagoWebhookRoutes();
        if (mercadoPagoWebhookRoutes) {
            app.route('/api/v1/webhooks/mercadopago', mercadoPagoWebhookRoutes);
        } else {
            apiLogger.warn('⚠️ MercadoPago webhook routes not registered - billing not configured');
        }
        app.route('/api/v1/webhooks', webhookHealthRoutes);

        // SPEC-101 T-101-32: Brevo email-event webhook. Public + token-gated
        // (X-Sib-Webhook-Token matched against HOSPEDA_BREVO_WEBHOOK_SECRET).
        app.route('/api/v1/public/webhooks', brevoWebhookRoutes);

        // SPEC-092 T-036: QZPay test-only control endpoint.
        // Mounted ONLY when both env gates are open. Accidental enablement
        // in prod would still hit no-ops because the underlying control
        // module checks the same gate, but we double-gate at the router
        // for defense in depth.
        if (
            env.NODE_ENV !== 'production' &&
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'
        ) {
            app.route('/api/v1/test/qzpay-control', createQZPayTestControlRoutes());
            apiLogger.warn(
                '⚠️ QZPay test-control endpoint mounted at /api/v1/test/qzpay-control (test-only)'
            );
        }
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
