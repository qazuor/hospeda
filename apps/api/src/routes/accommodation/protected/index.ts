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
import { protectedAddMediaRoute } from './addMedia';
import { protectedGetContactRoute } from './contact';
import { protectedCreateAccommodationRoute } from './create';
import { protectedCreateAccommodationDraftRoute } from './createDraft';
import { protectedGetOwnAccommodationByIdRoute } from './getById';
import { getFaqsRoute } from './getFaqs';
import { protectedGetMediaRoute } from './getMedia';
import { hostFavoritesBreakdownRoute } from './hostFavoritesBreakdown';
import { hostMarketComparisonRoute } from './hostMarketComparison';
import { protectedImportFromUrlRoute } from './import-from-url';
import { protectedListOwnAccommodationsRoute } from './list';
import { protectedPatchAccommodationRoute } from './patch';
import { removeFaqRoute } from './removeFaq';
import { protectedRemoveMediaRoute } from './removeMedia';
import { protectedReorderMediaRoute } from './reorderMedia';
import { protectedSetFeaturedMediaRoute } from './setFeaturedMedia';
import { protectedSoftDeleteAccommodationRoute } from './softDelete';
import { protectedUnpublishAccommodationRoute } from './unpublish';
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
// POST /:id/unpublish - Transition ACTIVE → INACTIVE
ownershipRoutes.route('/', protectedUnpublishAccommodationRoute);

const app = createRouter();

// GET /my/favorites-breakdown - Per-accommodation bookmark count (SPEC-155 T-005)
// Registered before GET / to avoid the list route matching the /my/* prefix.
app.route('/', hostFavoritesBreakdownRoute);

// GET /my/market-comparison - Per-accommodation market comparison (SPEC-155 card J)
app.route('/', hostMarketComparisonRoute);

// GET / - List own accommodations (no ownership check — filtered by actor.id in handler)
app.route('/', protectedListOwnAccommodationsRoute);

// GET /:id - Get own accommodation by ID (ownership check in handler)
app.route('/', protectedGetOwnAccommodationByIdRoute);

// POST / - Create accommodation (no ownership check)
app.route('/', protectedCreateAccommodationRoute);

// POST /draft - Create draft accommodation with minimum required fields
app.route('/', protectedCreateAccommodationDraftRoute);

// POST /import-from-url - Import accommodation data from an external listing URL
app.route('/', protectedImportFromUrlRoute);

// GET /:id/contact - Resolved contact info (auth required, NO ownership)
app.route('/', protectedGetContactRoute);

// FAQ management (auth required, no ownership)
app.route('/', getFaqsRoute);
app.route('/', addFaqRoute);
app.route('/', updateFaqRoute);
app.route('/', removeFaqRoute);

// Media management (auth required, ownership via service _canUpdate)
// CRITICAL ORDERING: fixed-suffix routes (reorder, featured) BEFORE /:id/media/:mediaId
// so Hono does not resolve "reorder" or "featured" as a mediaId UUID param.
// Mirror of the ordering in apps/api/src/routes/accommodation/admin/index.ts.

// PATCH /:id/media/reorder - Reorder gallery photos
// Registered BEFORE /:id/media/:mediaId to prevent "reorder" matching as a UUID param.
app.route('/', protectedReorderMediaRoute);

// GET /:id/media - List gallery photos
app.route('/', protectedGetMediaRoute);

// POST /:id/media - Add a photo to accommodation gallery
app.route('/', protectedAddMediaRoute);

// PUT /:id/media/:mediaId/featured - Promote a photo as the featured image
// Registered BEFORE /:id/media/:mediaId (DELETE) so "featured" is not resolved as UUID.
app.route('/', protectedSetFeaturedMediaRoute);

// DELETE /:id/media/:mediaId - Remove a photo from accommodation gallery
app.route('/', protectedRemoveMediaRoute);

// PUT /:id, PATCH /:id, DELETE /:id - Ownership-protected CRUD
app.route('/', ownershipRoutes);

// POST /:accommodationId/reviews - Create review for an accommodation
app.route('/', protectedAccommodationReviewRoutes);

export { app as protectedAccommodationRoutes };
