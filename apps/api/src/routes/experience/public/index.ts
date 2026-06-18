/**
 * Public experience routes (T-019)
 * Routes that do not require authentication.
 *
 * NOTE: Routes with path params that could conflict with named sub-paths (e.g.
 * /slug/:slug, /destination/:id) are registered BEFORE the /:id catch-all to
 * ensure Hono resolves them correctly.
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetExperiencesByDestinationRoute } from './getByDestination';
import { publicGetExperienceByIdRoute } from './getById';
import { publicGetExperienceBySlugRoute } from './getBySlug';
import { publicGetExperienceFaqsRoute } from './getFaqs';
import { publicListExperienceReviewsRoute } from './getReviews';
import { publicListExperiencesRoute } from './list';

const app = createRouter();

// GET /slug/:slug — Must be before /:id to avoid /:id catching "slug" as a UUID.
app.route('/', publicGetExperienceBySlugRoute);

// GET /destination/:destinationId — Must be before /:id.
app.route('/', publicGetExperiencesByDestinationRoute);

// GET / — List experience listings.
app.route('/', publicListExperiencesRoute);

// GET /:id — Get by ID (catch-all param route).
app.route('/', publicGetExperienceByIdRoute);

// GET /:experienceId/reviews — List approved reviews.
app.route('/', publicListExperienceReviewsRoute);

// GET /:experienceId/faqs — List FAQs.
app.route('/', publicGetExperienceFaqsRoute);

export { app as publicExperienceRoutes };
