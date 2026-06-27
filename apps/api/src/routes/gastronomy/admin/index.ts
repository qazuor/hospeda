/**
 * Admin gastronomy routes (SPEC-239 T-045 / T-046).
 * Routes that require admin-level access.
 *
 * IMPORTANT: Route ordering matters — more-specific paths MUST be registered
 * BEFORE /{id} catch-alls to prevent Hono from resolving static segments
 * ("batch", "options", "reviews", "assign-owner") as UUID params:
 *   - /batch         registered before /{id}
 *   - /reviews       registered before /{id}
 *   - /options       registered before /{id}
 *   - /{id}/faqs/reorder  registered before /{id}/faqs/{faqId}
 */
import { createRouter } from '../../../utils/create-app';
import { adminGastronomyReviewRoutes } from '../reviews/admin/index.js';
import { adminAddGastronomyFaqRoute } from './addFaq';
import { adminAssignGastronomyOwnerRoute } from './assignOwner';
import { adminBatchGastronomiesRoute } from './batch';
import { adminCreateGastronomyRoute } from './create';
import { adminDeleteGastronomyRoute } from './delete';
import { adminGetGastronomyByIdRoute } from './getById';
import { adminGetGastronomyFaqsRoute } from './getFaqs';
import { adminHardDeleteGastronomyRoute } from './hardDelete';
import { adminListGastronomiesRoute } from './list';
import { adminGastronomyOptionsRoute } from './options';
import { adminPatchGastronomyRoute } from './patch';
import { adminRemoveGastronomyFaqRoute } from './removeFaq';
import { adminReorderGastronomyFaqsRoute } from './reorderFaqs';
import { adminRestoreGastronomyRoute } from './restore';
import { adminUpdateGastronomyRoute } from './update';
import { adminUpdateGastronomyFaqRoute } from './updateFaq';

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

// DELETE /:id - Soft delete
app.route('/', adminDeleteGastronomyRoute);

// DELETE /:id/hard - Hard delete
app.route('/', adminHardDeleteGastronomyRoute);

// POST /:id/restore - Restore soft-deleted listing
app.route('/', adminRestoreGastronomyRoute);

// POST /:id/assign-owner - Set/replace listing owner
app.route('/', adminAssignGastronomyOwnerRoute);

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

export { app as adminGastronomyRoutes };
