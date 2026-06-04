/**
 * Protected user routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { userEntitlementsRoute } from './entitlements';
import { protectedGetUserByIdRoute } from './getById';
import { newsletterToggleRoute } from './newsletter';
import { protectedPatchUserRoute } from './patch';
import { userReviewsRoute } from './reviews';
import { userStatsRoute } from './stats';
import { userSubscriptionRoute } from './subscription';
import { tourProgressRoute } from './tourProgress';
import { protectedUpdateUserRoute } from './update';
import { whatsNewSeenRoute } from './whatsNewSeen';

const app = createRouter();

// GET /me/reviews - User reviews (registered before /:id to avoid path conflicts)
app.route('/', userReviewsRoute);

// GET /me/stats - User statistics
app.route('/', userStatsRoute);

// GET /me/subscription - User subscription details
app.route('/', userSubscriptionRoute);

// GET /me/entitlements - Merged entitlements + limits + plan context
app.route('/', userEntitlementsRoute);

// POST /me/newsletter/toggle - Toggle newsletter subscription
app.route('/', newsletterToggleRoute);

// GET /:id - Get by ID
app.route('/', protectedGetUserByIdRoute);

// PUT /:id - Update user
app.route('/', protectedUpdateUserRoute);

// PATCH /:id - Patch user
app.route('/', protectedPatchUserRoute);

// PATCH /me/whats-new-seen - Mark What's New entries as seen (SPEC-175)
// Registered BEFORE /:id to avoid the route being captured by the UUID param matcher.
app.route('/', whatsNewSeenRoute);

// PATCH /me/tour-progress - Mark an admin tour as seen (SPEC-174)
// Registered BEFORE /:id to avoid the route being captured by the UUID param matcher.
app.route('/', tourProgressRoute);

export { app as protectedUserRoutes };
