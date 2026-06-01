/**
 * Public post routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicPostCommentRoutes } from '../comments/public/index.js';
import { publicGetPostsByCategoryRoute } from './getByCategory';
import { publicGetPostByIdRoute } from './getById';
import { publicGetPostsByRelatedAccommodationRoute } from './getByRelatedAccommodation';
import { publicGetPostsByRelatedDestinationRoute } from './getByRelatedDestination';
import { publicGetPostsByRelatedEventRoute } from './getByRelatedEvent';
import { publicGetPostBySlugRoute } from './getBySlug';
import { publicGetFeaturedPostsRoute } from './getFeatured';
import { publicGetNewsPostsRoute } from './getNews';
import { publicGetPostStatsRoute } from './getStats';
import { publicGetPostSummaryRoute } from './getSummary';
import { publicListPostsRoute } from './list';

const app = createRouter();

// IMPORTANT: register specific paths BEFORE the catch-all `/:id` route.
// Hono matches in registration order — if `/:id` is registered first, paths
// like `/news`, `/featured`, `/stats`, `/category/:cat` get matched as
// `id="news"` and the UUID validation rejects them with 400.

// GET / - List posts
app.route('/', publicListPostsRoute);

// GET /news - Get news posts
app.route('/', publicGetNewsPostsRoute);

// GET /featured - Get featured posts
app.route('/', publicGetFeaturedPostsRoute);

// GET /stats - Get statistics
app.route('/', publicGetPostStatsRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetPostBySlugRoute);

// GET /category/:category - Get by category
app.route('/', publicGetPostsByCategoryRoute);

// GET /related/event/:eventId - Get by related event
app.route('/', publicGetPostsByRelatedEventRoute);

// GET /related/destination/:destinationId - Get by related destination
app.route('/', publicGetPostsByRelatedDestinationRoute);

// GET /related/accommodation/:accommodationId - Get by related accommodation
app.route('/', publicGetPostsByRelatedAccommodationRoute);

// GET /:id - Get by ID (catch-all — registered last)
app.route('/', publicGetPostByIdRoute);

// GET /:id/summary - Get summary (registered after /:id since both share /:id prefix)
app.route('/', publicGetPostSummaryRoute);

// GET /:postId/comments - Public comment thread (SPEC-165)
app.route('/', publicPostCommentRoutes);

export { app as publicPostRoutes };
