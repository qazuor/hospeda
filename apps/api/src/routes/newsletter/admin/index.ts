/**
 * Admin newsletter routes barrel (SPEC-101 T-101-27 + T-101-28).
 *
 * Mounts all admin campaign endpoints (CRUD + actions + metrics) and the
 * subscriber list/stats endpoints under a single Hono router.
 *
 * All routes are exposed under `/api/v1/admin/newsletter` (prefix added by
 * the top-level `apps/api/src/routes/index.ts` registration).
 *
 * @module routes/newsletter/admin/index
 */

import { createRouter } from '../../../utils/create-app';
import {
    adminCampaignErrorsRoute,
    adminCampaignMetricsRoute,
    adminCancelCampaignRoute,
    adminCreateCampaignRoute,
    adminDeleteCampaignRoute,
    adminGetCampaignRoute,
    adminListCampaignsRoute,
    adminSendCampaignRoute,
    adminTestSendCampaignRoute,
    adminUpdateCampaignRoute
} from './campaigns';
import { adminListSubscribersRoute, adminSubscribersStatsRoute } from './subscribers';
import { adminSubscribersByPreferenceRoute } from './subscribers-by-preference';

/**
 * Admin newsletter router.
 *
 * Route mount order matters for Hono's path resolution:
 * 1. `subscribers/stats` BEFORE `subscribers` (more-specific path first).
 * 2. `campaigns/{id}/test-send` / `send` / `cancel` / `metrics` / `errors`
 *    BEFORE `campaigns/{id}` so the action segments are not consumed as an id.
 */
export const newsletterAdminRoutes = createRouter()
    // ── Subscriber routes ──────────────────────────────────────────────────
    // /api/v1/admin/newsletter/subscribers/by-preference (most specific first — SPEC-155 T-007)
    .route('/', adminSubscribersByPreferenceRoute)
    // /api/v1/admin/newsletter/subscribers/stats (more specific first)
    .route('/', adminSubscribersStatsRoute)
    // /api/v1/admin/newsletter/subscribers
    .route('/', adminListSubscribersRoute)

    // ── Campaign list + create ─────────────────────────────────────────────
    // /api/v1/admin/newsletter/campaigns
    .route('/', adminListCampaignsRoute)
    .route('/', adminCreateCampaignRoute)

    // ── Campaign actions (more-specific paths before /:id) ─────────────────
    // /api/v1/admin/newsletter/campaigns/:id/test-send
    .route('/', adminTestSendCampaignRoute)
    // /api/v1/admin/newsletter/campaigns/:id/send
    .route('/', adminSendCampaignRoute)
    // /api/v1/admin/newsletter/campaigns/:id/cancel
    .route('/', adminCancelCampaignRoute)
    // /api/v1/admin/newsletter/campaigns/:id/metrics
    .route('/', adminCampaignMetricsRoute)
    // /api/v1/admin/newsletter/campaigns/:id/errors
    .route('/', adminCampaignErrorsRoute)

    // ── Campaign get / update / delete ─────────────────────────────────────
    // /api/v1/admin/newsletter/campaigns/:id
    .route('/', adminGetCampaignRoute)
    .route('/', adminUpdateCampaignRoute)
    .route('/', adminDeleteCampaignRoute);

// Re-export singletons test seam
export { _resetCampaignRouteSingletons } from './_singletons';
