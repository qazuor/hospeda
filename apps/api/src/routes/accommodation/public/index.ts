/**
 * Public accommodation routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
// Legacy routes that need to be updated to new pattern
import { getByDestinationRoute } from './getByDestination';
import { publicGetAccommodationByIdRoute } from './getById';
import { publicGetAccommodationBySlugRoute } from './getBySlug';
import { getStatsRoute } from './getStats';
import { getSummaryRoute } from './getSummary';
import { getTopRatedByDestinationRoute } from './getTopRatedByDestination';
import { publicListAccommodationsRoute } from './list';

const app = createRouter();

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

export { app as publicAccommodationRoutes };
