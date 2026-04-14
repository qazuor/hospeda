/**
 * Public accommodation routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicAccommodationReviewRoutes } from '../reviews/public/index.js';
import { getByDestinationRoute } from './getByDestination';
import { publicGetAccommodationByIdRoute } from './getById';
import { publicGetAccommodationBySlugRoute } from './getBySlug';
import { getStatsRoute } from './getStats';
import { getSummaryRoute } from './getSummary';
import { getTopRatedByDestinationRoute } from './getTopRatedByDestination';
import { publicListAccommodationsRoute } from './list';
import { publicGetSimilarRoute } from './similar';

const app = createRouter();

// GET /:id/similar - Similar accommodations (registered before :id catch-all)
app.route('/', publicGetSimilarRoute);

// GET / - List accommodations
app.route('/', publicListAccommodationsRoute);

// GET /:id - Get by ID
app.route('/', publicGetAccommodationByIdRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetAccommodationBySlugRoute);

// GET /destination/:destinationId - Get by destination
app.route('/', getByDestinationRoute);

// GET /destination/:destinationId/top-rated - Top rated by destination
app.route('/', getTopRatedByDestinationRoute);

// GET /:id/summary - Get summary
app.route('/', getSummaryRoute);

// GET /stats - Get stats
app.route('/', getStatsRoute);

// GET /:accommodationId/reviews - List reviews for an accommodation
app.route('/', publicAccommodationReviewRoutes);

export { app as publicAccommodationRoutes };
