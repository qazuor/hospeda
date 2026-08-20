/**
 * Admin experience routes (SPEC-240 T-021 / HOS-372).
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
import { adminExperienceReviewRoutes } from '../reviews/admin/index.js';
import { adminAddExperienceFaqRoute } from './addFaq';
import { adminAddExperienceMediaRoute } from './addMedia';
import { adminAssignExperienceOwnerRoute } from './assignOwner';
import { adminBatchExperiencesRoute } from './batch';
import { adminCreateExperienceRoute } from './create';
import { adminDeleteExperienceRoute } from './delete';
import { adminGetExperienceByIdRoute } from './getById';
import { adminGetExperienceFaqsRoute } from './getFaqs';
import { adminGetExperienceMediaRoute } from './getMedia';
import { adminHardDeleteExperienceRoute } from './hardDelete';
import { adminListExperiencesRoute } from './list';
import { adminModerateExperienceRoute } from './moderate';
import { adminExperienceOptionsRoute } from './options';
import { adminPatchExperienceRoute } from './patch';
import { adminRemoveExperienceFaqRoute } from './removeFaq';
import { adminRemoveExperienceMediaRoute } from './removeMedia';
import { adminReorderExperienceFaqsRoute } from './reorderFaqs';
import { adminReorderExperienceMediaRoute } from './reorderMedia';
import { adminRestoreExperienceRoute } from './restore';
import { adminSetFeaturedExperienceMediaRoute } from './setFeaturedMedia';
import { adminUpdateExperienceRoute } from './update';
import { adminUpdateExperienceFaqRoute } from './updateFaq';

const app = createRouter();

// GET / - List all experience listings (including deleted when includeDeleted=true)
app.route('/', adminListExperiencesRoute);

// POST / - Create experience listing
app.route('/', adminCreateExperienceRoute);

// POST /batch - Batch operations
// Registered before /{id} routes to prevent "batch" matching as a UUID param
app.route('/', adminBatchExperiencesRoute);

// Review admin routes (list, getById, update, delete, moderate)
// Registered before /{id} routes to prevent "reviews" matching as a UUID param
app.route('/reviews', adminExperienceReviewRoutes);

// GET /options - Lightweight relation-selector lookup
// Registered before /{id} so Hono does not resolve "options" as a UUID param
app.route('/', adminExperienceOptionsRoute);

// GET /:id - Get by ID
app.route('/', adminGetExperienceByIdRoute);

// PUT /:id - Full update
app.route('/', adminUpdateExperienceRoute);

// PATCH /:id - Partial update
app.route('/', adminPatchExperienceRoute);

// DELETE /:id - Soft delete
app.route('/', adminDeleteExperienceRoute);

// DELETE /:id/hard - Hard delete
app.route('/', adminHardDeleteExperienceRoute);

// POST /:id/restore - Restore soft-deleted listing
app.route('/', adminRestoreExperienceRoute);

// POST /:id/assign-owner - Set/replace listing owner
app.route('/', adminAssignExperienceOwnerRoute);

// POST /:id/moderate - Apply the moderation verdict to the LISTING (HOS-686).
// Distinct from /reviews/:id/moderate above, which moderates reviews ABOUT a
// listing: different permission, different subject.
app.route('/', adminModerateExperienceRoute);

// PATCH /:id/faqs/reorder - Reorder FAQs for a listing
// Registered before /:id/faqs routes to prevent "reorder" matching as a faqId param
app.route('/', adminReorderExperienceFaqsRoute);

// GET /:id/faqs - Get FAQs for a listing
app.route('/', adminGetExperienceFaqsRoute);

// POST /:id/faqs - Add FAQ to a listing
app.route('/', adminAddExperienceFaqRoute);

// PUT /:id/faqs/:faqId - Update FAQ in a listing
app.route('/', adminUpdateExperienceFaqRoute);

// DELETE /:id/faqs/:faqId - Remove FAQ from a listing
app.route('/', adminRemoveExperienceFaqRoute);

// Media management (HOS-372) - gated on COMMERCE_EDIT_ALL

// PATCH /:id/media/reorder - Reorder gallery photos
// Registered before /:id/media/:mediaId to prevent "reorder" matching as a mediaId param
app.route('/', adminReorderExperienceMediaRoute);

// GET /:id/media - List gallery photos
app.route('/', adminGetExperienceMediaRoute);

// POST /:id/media - Add photo to gallery
app.route('/', adminAddExperienceMediaRoute);

// PUT /:id/media/:mediaId/featured - Set featured photo
// Registered before /:id/media/:mediaId to prevent "featured" suffix ambiguity
app.route('/', adminSetFeaturedExperienceMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery
app.route('/', adminRemoveExperienceMediaRoute);

export { app as adminExperienceRoutes };
