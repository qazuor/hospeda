/**
 * Protected user routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedGetUserByIdRoute } from './getById';
import { protectedPatchUserRoute } from './patch';
import { userReviewsRoute } from './reviews';
import { userStatsRoute } from './stats';
import { userSubscriptionRoute } from './subscription';
import { protectedUpdateUserRoute } from './update';

const app = createRouter();

// GET /me/reviews - User reviews (registered before /:id to avoid path conflicts)
app.route('/', userReviewsRoute);

// GET /me/stats - User statistics
app.route('/', userStatsRoute);

// GET /me/subscription - User subscription details
app.route('/', userSubscriptionRoute);

// GET /:id - Get by ID
app.route('/', protectedGetUserByIdRoute);

// PUT /:id - Update user
app.route('/', protectedUpdateUserRoute);

// PATCH /:id - Patch user
app.route('/', protectedPatchUserRoute);

export { app as protectedUserRoutes };
