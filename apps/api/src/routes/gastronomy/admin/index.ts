/**
 * Admin gastronomy routes (SPEC-239 T-045 / T-046 / HOS-372).
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
import { adminAddGastronomyFaqRoute } from '../../gastronomy/admin/addFaq';
import { adminAddGastronomyFeaturedMediaRoute } from '../../gastronomy/admin/addFeaturedMedia';
import { adminAddGastronomyMediaRoute } from '../../gastronomy/admin/addMedia';
import { adminAssignGastronomyOwnerRoute } from '../../gastronomy/admin/assignOwner';
import { adminBatchGastronomiesRoute } from '../../gastronomy/admin/batch';
import { adminCreateGastronomyRoute } from '../../gastronomy/admin/create';
import { adminGetGastronomyByIdRoute } from '../../gastronomy/admin/getById';
import { adminGetGastronomyFaqsRoute } from '../../gastronomy/admin/getFaqs';
import { adminGetGastronomyMediaRoute } from '../../gastronomy/admin/getMedia';
import { adminListGastronomiesRoute } from '../../gastronomy/admin/list';
import { adminModerateGastronomyRoute } from '../../gastronomy/admin/moderate';
import { adminGetGastronomyModerationStateRoute } from '../../gastronomy/admin/moderation-state';
import { adminGastronomyOptionsRoute } from '../../gastronomy/admin/options';
import { adminPatchGastronomyRoute } from '../../gastronomy/admin/patch';
import { adminPurgeOnRequestGastronomyRoute } from '../../gastronomy/admin/purge';
import { adminRemoveGastronomyFaqRoute } from '../../gastronomy/admin/removeFaq';
import { adminRemoveGastronomyMediaRoute } from '../../gastronomy/admin/removeMedia';
import { adminReorderGastronomyFaqsRoute } from '../../gastronomy/admin/reorderFaqs';
import { adminReorderGastronomyMediaRoute } from '../../gastronomy/admin/reorderMedia';
import { adminSetFeaturedGastronomyMediaRoute } from '../../gastronomy/admin/setFeaturedMedia';
import { adminUpdateGastronomyRoute } from '../../gastronomy/admin/update';
import { adminUpdateGastronomyFaqRoute } from '../../gastronomy/admin/updateFaq';
import { adminUpdateGastronomyMediaRoute } from '../../gastronomy/admin/updateMedia';
import { adminGastronomyReviewRoutes } from '../../gastronomy/reviews/admin/index.js';

const app = createRouter();

// GET / - List all gastronomy listings (including deleted when includeDeleted=true)
app.route('/', adminListGastronomiesRoute);

// POST / - Create gastronomy listing
app.route('/', adminCreateGastronomyRoute);

// POST /batch - Batch operations
// Registered before /{id} routes to prevent "batch" matching as a UUID param
app.route('/', adminBatchGastronomiesRoute);

// Review admin routes (list, getById, update, delete, moderate)
// Registered before /{id} routes to prevent "reviews" matching as a UUID param
app.route('/reviews', adminGastronomyReviewRoutes);

// GET /options - Lightweight relation-selector lookup
// Registered before /{id} so Hono does not resolve "options" as a UUID param
app.route('/', adminGastronomyOptionsRoute);

// GET /:id - Get by ID
app.route('/', adminGetGastronomyByIdRoute);

// PUT /:id - Full update
app.route('/', adminUpdateGastronomyRoute);

// PATCH /:id - Partial update
app.route('/', adminPatchGastronomyRoute);

// POST /:id/assign-owner - Set/replace listing owner
app.route('/', adminAssignGastronomyOwnerRoute);

// POST /:id/moderate - ACC:12 two-level publication moderation; the legacy moderation column was retired by V6.9b.
app.route('/', adminModerateGastronomyRoute);

// GET /:id/moderation - current publication and fix-request state
app.route('/', adminGetGastronomyModerationStateRoute);

// POST /:id/purge - ACC:23 purge at the owner's request (PB12, mandatory reason).
app.route('/', adminPurgeOnRequestGastronomyRoute);

// PATCH /:id/faqs/reorder - Reorder FAQs for a listing
// Registered before /:id/faqs routes to prevent "reorder" matching as a faqId param
app.route('/', adminReorderGastronomyFaqsRoute);

// GET /:id/faqs - Get FAQs for a listing
app.route('/', adminGetGastronomyFaqsRoute);

// POST /:id/faqs - Add FAQ to a listing
app.route('/', adminAddGastronomyFaqRoute);

// PUT /:id/faqs/:faqId - Update FAQ in a listing
app.route('/', adminUpdateGastronomyFaqRoute);

// DELETE /:id/faqs/:faqId - Remove FAQ from a listing
app.route('/', adminRemoveGastronomyFaqRoute);

// Media management (HOS-372) - gated on GASTRONOMY_EDIT_ALL

// PATCH /:id/media/reorder - Reorder gallery photos
// Registered before /:id/media/:mediaId to prevent "reorder" matching as a mediaId param
app.route('/', adminReorderGastronomyMediaRoute);

// GET /:id/media - List gallery photos
app.route('/', adminGetGastronomyMediaRoute);

// POST /:id/media - Add photo to gallery
// POST /:id/media/featured - Upload straight to cover (HOS-803).
// Registered before POST /:id/media so "featured" resolves as the fixed
// suffix rather than being absorbed by the collection route.
app.route('/', adminAddGastronomyFeaturedMediaRoute);

app.route('/', adminAddGastronomyMediaRoute);

// PUT /:id/media/:mediaId/featured - Set featured photo
// Registered before /:id/media/:mediaId to prevent "featured" suffix ambiguity
app.route('/', adminSetFeaturedGastronomyMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery
app.route('/', adminRemoveGastronomyMediaRoute);

// PATCH /:id/media/:mediaId - Correct a photo's text metadata
// (caption/description/alt/attribution) — HOS-1036.
app.route('/', adminUpdateGastronomyMediaRoute);

export { app as adminGastronomyRoutes };
