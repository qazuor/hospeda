/**
 * Admin venue routes (SPEC-239 T-045 / T-046 / HOS-372).
 * Routes that require admin-level access.
 *
 * IMPORTANT: Route ordering matters — more-specific paths MUST be registered
 * BEFORE /{id} catch-alls to prevent Hono from resolving static segments
 * ("batch", "options", "reviews", "assign-owner") as UUID params:
 *   - /batch         registered before /{id}
 *   - /reviews       registered before /{id}
 *   - /options       registered before /{id}
 *   - /{id}/faqs/reorder  registered before /{id}/faqs/{faqId}
 *   - /{id}/media/reorder  registered before /{id}/media/{mediaId}
 *   - /{id}/media/{mediaId}/featured  registered before /{id}/media/{mediaId}
 */
import { createRouter } from '../../../utils/create-app';
import { adminVenueReviewRoutes } from '../reviews/admin/index.js';
import { adminAddVenueFaqRoute } from './addFaq';
import { adminAddVenueFeaturedMediaRoute } from './addFeaturedMedia';
import { adminAddVenueMediaRoute } from './addMedia';
import { adminAssignVenueOwnerRoute } from './assignOwner';
import { adminBatchVenuesRoute } from './batch';
import { adminCreateVenueRoute } from './create';
import { adminGetVenueByIdRoute } from './getById';
import { adminGetVenueFaqsRoute } from './getFaqs';
import { adminGetVenueMediaRoute } from './getMedia';
import { adminListVenuesRoute } from './list';
import { adminModerateVenueRoute } from './moderate';
import { adminGetVenueModerationStateRoute } from './moderation-state';
import { adminVenueOptionsRoute } from './options';
import { adminPatchVenueRoute } from './patch';
import { adminPurgeOnRequestVenueRoute } from './purge';
import { adminRemoveVenueFaqRoute } from './removeFaq';
import { adminRemoveVenueMediaRoute } from './removeMedia';
import { adminReorderVenueFaqsRoute } from './reorderFaqs';
import { adminReorderVenueMediaRoute } from './reorderMedia';
import { adminSetFeaturedVenueMediaRoute } from './setFeaturedMedia';
import { adminUpdateVenueRoute } from './update';
import { adminUpdateVenueFaqRoute } from './updateFaq';
import { adminUpdateVenueMediaRoute } from './updateMedia';

const app = createRouter();

// GET / - List all venue listings (including deleted when includeDeleted=true)
app.route('/', adminListVenuesRoute);

// POST / - Create venue listing
app.route('/', adminCreateVenueRoute);

// POST /batch - Batch operations
// Registered before /{id} routes to prevent "batch" matching as a UUID param
app.route('/', adminBatchVenuesRoute);

// Review admin routes (list, getById, update, delete, moderate)
// Registered before /{id} routes to prevent "reviews" matching as a UUID param
app.route('/reviews', adminVenueReviewRoutes);

// GET /options - Lightweight relation-selector lookup
// Registered before /{id} so Hono does not resolve "options" as a UUID param
app.route('/', adminVenueOptionsRoute);

// GET /:id - Get by ID
app.route('/', adminGetVenueByIdRoute);

// PUT /:id - Full update
app.route('/', adminUpdateVenueRoute);

// PATCH /:id - Partial update
app.route('/', adminPatchVenueRoute);

// POST /:id/assign-owner - Set/replace listing owner
app.route('/', adminAssignVenueOwnerRoute);

// POST /:id/moderate - ACC:12 two-level publication moderation; the legacy moderation column was retired by V6.9b.
app.route('/', adminModerateVenueRoute);

// GET /:id/moderation - current publication and fix-request state
app.route('/', adminGetVenueModerationStateRoute);

// POST /:id/purge - ACC:23 purge at the owner's request (PB12, mandatory reason).
app.route('/', adminPurgeOnRequestVenueRoute);

// PATCH /:id/faqs/reorder - Reorder FAQs for a listing
// Registered before /:id/faqs routes to prevent "reorder" matching as a faqId param
app.route('/', adminReorderVenueFaqsRoute);

// GET /:id/faqs - Get FAQs for a listing
app.route('/', adminGetVenueFaqsRoute);

// POST /:id/faqs - Add FAQ to a listing
app.route('/', adminAddVenueFaqRoute);

// PUT /:id/faqs/:faqId - Update FAQ in a listing
app.route('/', adminUpdateVenueFaqRoute);

// DELETE /:id/faqs/:faqId - Remove FAQ from a listing
app.route('/', adminRemoveVenueFaqRoute);

// Media management (HOS-372) - gated on VENUE_EDIT_ALL

// PATCH /:id/media/reorder - Reorder gallery photos
// Registered before /:id/media/:mediaId to prevent "reorder" matching as a mediaId param
app.route('/', adminReorderVenueMediaRoute);

// GET /:id/media - List gallery photos
app.route('/', adminGetVenueMediaRoute);

// POST /:id/media - Add photo to gallery
// POST /:id/media/featured - Upload straight to cover (HOS-803).
// Registered before POST /:id/media so "featured" resolves as the fixed
// suffix rather than being absorbed by the collection route.
app.route('/', adminAddVenueFeaturedMediaRoute);

app.route('/', adminAddVenueMediaRoute);

// PUT /:id/media/:mediaId/featured - Set featured photo
// Registered before /:id/media/:mediaId to prevent "featured" suffix ambiguity
app.route('/', adminSetFeaturedVenueMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery
app.route('/', adminRemoveVenueMediaRoute);

// PATCH /:id/media/:mediaId - Correct a photo's text metadata
// (caption/description/alt/attribution) — HOS-1036.
app.route('/', adminUpdateVenueMediaRoute);

export { app as adminVenueRoutes };
