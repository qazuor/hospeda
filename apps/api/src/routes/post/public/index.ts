/**
 * Public post routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
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

// GET / - List posts
app.route('/', publicListPostsRoute);

// GET /:id - Get by ID
app.route('/', publicGetPostByIdRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetPostBySlugRoute);

// GET /:id/summary - Get summary
app.route('/', publicGetPostSummaryRoute);

// GET /stats - Get statistics
app.route('/', publicGetPostStatsRoute);

// GET /news - Get news posts
app.route('/', publicGetNewsPostsRoute);

// GET /featured - Get featured posts
app.route('/', publicGetFeaturedPostsRoute);

// GET /category/:category - Get by category
app.route('/', publicGetPostsByCategoryRoute);

// GET /related/event/:eventId - Get by related event
app.route('/', publicGetPostsByRelatedEventRoute);

// GET /related/destination/:destinationId - Get by related destination
app.route('/', publicGetPostsByRelatedDestinationRoute);

// GET /related/accommodation/:accommodationId - Get by related accommodation
app.route('/', publicGetPostsByRelatedAccommodationRoute);

export { app as publicPostRoutes };
