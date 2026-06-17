/**
 * Public gastronomy routes (T-042)
 * Routes that do not require authentication.
 *
 * NOTE: Routes with path params that could conflict with named sub-paths (e.g.
 * /slug/:slug, /destination/:id) are registered BEFORE the /:id catch-all to
 * ensure Hono resolves them correctly.
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetGastronomiesByDestinationRoute } from './getByDestination';
import { publicGetGastronomyByIdRoute } from './getById';
import { publicGetGastronomyBySlugRoute } from './getBySlug';
import { publicGetGastronomyFaqsRoute } from './getFaqs';
import { publicListGastronomyReviewsRoute } from './getReviews';
import { publicListGastronomiesRoute } from './list';

const app = createRouter();

// GET /slug/:slug — Must be before /:id to avoid /:id catching "slug" as a UUID.
app.route('/', publicGetGastronomyBySlugRoute);

// GET /destination/:destinationId — Must be before /:id.
app.route('/', publicGetGastronomiesByDestinationRoute);

// GET / — List gastronomy listings.
app.route('/', publicListGastronomiesRoute);

// GET /:id — Get by ID (catch-all param route).
app.route('/', publicGetGastronomyByIdRoute);

// GET /:gastronomyId/reviews — List approved reviews.
app.route('/', publicListGastronomyReviewsRoute);

// GET /:gastronomyId/faqs — List FAQs.
app.route('/', publicGetGastronomyFaqsRoute);

export { app as publicGastronomyRoutes };
