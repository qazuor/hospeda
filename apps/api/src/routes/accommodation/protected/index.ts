/**
 * Protected accommodation routes
 * Routes that require authentication
 *
 * IMPORTANT: Routes with ownership middleware (update, patch, softDelete) are
 * isolated in a dedicated sub-router to prevent their app.use() middleware from
 * leaking to other routes (e.g. contact). See route-factory.ts applyRouteMiddlewares().
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAccommodationReviewRoutes } from '../reviews/protected/index.js';
import { addFaqRoute } from './addFaq';
import { protectedGetContactRoute } from './contact';
import { protectedCreateAccommodationRoute } from './create';
import { getFaqsRoute } from './getFaqs';
import { protectedPatchAccommodationRoute } from './patch';
import { removeFaqRoute } from './removeFaq';
import { protectedSoftDeleteAccommodationRoute } from './softDelete';
import { protectedUpdateAccommodationRoute } from './update';
import { updateFaqRoute } from './updateFaq';

/**
 * Sub-router for ownership-protected CRUD routes.
 * Isolates ownershipMiddleware so it does NOT leak to sibling routes.
 */
const ownershipRoutes = createRouter();
ownershipRoutes.route('/', protectedUpdateAccommodationRoute);
ownershipRoutes.route('/', protectedPatchAccommodationRoute);
ownershipRoutes.route('/', protectedSoftDeleteAccommodationRoute);

const app = createRouter();

// POST / - Create accommodation (no ownership check)
app.route('/', protectedCreateAccommodationRoute);

// GET /:id/contact - Resolved contact info (auth required, NO ownership)
app.route('/', protectedGetContactRoute);

// FAQ management (auth required, no ownership)
app.route('/', getFaqsRoute);
app.route('/', addFaqRoute);
app.route('/', updateFaqRoute);
app.route('/', removeFaqRoute);

// PUT /:id, PATCH /:id, DELETE /:id - Ownership-protected CRUD
app.route('/', ownershipRoutes);

// POST /:accommodationId/reviews - Create review for an accommodation
app.route('/', protectedAccommodationReviewRoutes);

export { app as protectedAccommodationRoutes };
