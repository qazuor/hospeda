/**
 * Public gastronomy routes (T-042)
 * Routes that do not require authentication.
 *
 * NOTE: Routes with path params that could conflict with named sub-paths (e.g.
 * /slug/:slug, /destination/:id) are registered BEFORE the /:id catch-all to
 * ensure Hono resolves them correctly.
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetVenuesByDestinationRoute } from './getByDestination';
import { publicGetVenueByIdRoute } from './getById';
import { publicGetVenueBySlugRoute } from './getBySlug';
import { publicGetVenueFaqsRoute } from './getFaqs';
import { publicListVenueReviewsRoute } from './getReviews';
import { publicListVenuesRoute } from './list';

const app = createRouter();

// GET /slug/:slug — Must be before /:id to avoid /:id catching "slug" as a UUID.
app.route('/', publicGetVenueBySlugRoute);

// GET /destination/:destinationId — Must be before /:id.
app.route('/', publicGetVenuesByDestinationRoute);

// GET / — List gastronomy listings.
app.route('/', publicListVenuesRoute);

// GET /:id — Get by ID (catch-all param route).
app.route('/', publicGetVenueByIdRoute);

// GET /:gastronomyId/reviews — List approved reviews.
app.route('/', publicListVenueReviewsRoute);

// GET /:gastronomyId/faqs — List FAQs.
app.route('/', publicGetVenueFaqsRoute);

export { app as publicVenueRoutes };
