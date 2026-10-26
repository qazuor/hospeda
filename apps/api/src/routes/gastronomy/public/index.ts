/**
 * Public gastronomy routes (T-042)
 * Routes that do not require authentication.
 *
 * NOTE: Routes with path params that could conflict with named sub-paths (e.g.
 * /slug/:slug, /destination/:id) are registered BEFORE the /:id catch-all to
 * ensure Hono resolves them correctly.
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetGastronomiesByDestinationRoute } from '../../gastronomy/public/getByDestination';
import { publicGetGastronomyByIdRoute } from '../../gastronomy/public/getById';
import { publicGetGastronomyBySlugRoute } from '../../gastronomy/public/getBySlug';
import { publicGetGastronomyFaqsRoute } from '../../gastronomy/public/getFaqs';
import { publicListGastronomyReviewsRoute } from '../../gastronomy/public/getReviews';
import { publicListGastronomiesRoute } from '../../gastronomy/public/list';

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
