/**
 * Admin accommodation routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminAccommodationReviewRoutes } from '../reviews/admin/index.js';
import { adminAddFaqRoute } from './addFaq';
import { adminAddMediaRoute } from './addMedia';
import { adminBatchAccommodationsRoute } from './batch';
import { adminCreateAccommodationRoute } from './create';
import { adminDeleteAccommodationRoute } from './delete';
import { adminGetAccommodationByIdRoute } from './getById';
import { adminGetFaqsRoute } from './getFaqs';
import { adminHardDeleteAccommodationRoute } from './hardDelete';
import { adminListAccommodationsRoute } from './list';
import { adminAccommodationOptionsRoute } from './options';
import { adminPatchAccommodationRoute } from './patch';
import { adminRemoveFaqRoute } from './removeFaq';
import { adminReorderAccommodationFaqsRoute } from './reorderFaqs';
import { adminRestoreAccommodationRoute } from './restore';
import { adminUpdateAccommodationRoute } from './update';
import { adminUpdateFaqRoute } from './updateFaq';

const app = createRouter();

// GET / - List all accommodations (including deleted)
app.route('/', adminListAccommodationsRoute);

// POST / - Create accommodation
app.route('/', adminCreateAccommodationRoute);

// POST /batch - Batch operations
// Registered before /{id} routes to prevent "batch" matching as a UUID param
app.route('/', adminBatchAccommodationsRoute);

// Review admin routes (list, getById, update, delete, restore, hardDelete)
// Registered before /{id} routes to prevent "reviews" matching as a UUID param
app.route('/reviews', adminAccommodationReviewRoutes);

// GET /options - Lightweight relation-selector lookup (SPEC-169 §5.5)
// Registered before /{id} so Hono does not resolve "options" as a UUID param
app.route('/', adminAccommodationOptionsRoute);

// GET /:id - Get by ID
app.route('/', adminGetAccommodationByIdRoute);

// PUT /:id - Update accommodation
app.route('/', adminUpdateAccommodationRoute);

// PATCH /:id - Patch accommodation
app.route('/', adminPatchAccommodationRoute);

// DELETE /:id - Soft delete accommodation
app.route('/', adminDeleteAccommodationRoute);

// DELETE /:id/hard - Hard delete accommodation
app.route('/', adminHardDeleteAccommodationRoute);

// POST /:id/restore - Restore accommodation
app.route('/', adminRestoreAccommodationRoute);

// PATCH /:id/faqs/reorder - Reorder FAQs for an accommodation
// Registered before /:id/faqs routes to prevent "reorder" matching as a faqId param
app.route('/', adminReorderAccommodationFaqsRoute);

// GET /:id/faqs - Get accommodation FAQs
app.route('/', adminGetFaqsRoute);

// POST /:id/faqs - Add FAQ to accommodation
app.route('/', adminAddFaqRoute);

// PUT /:id/faqs/:faqId - Update FAQ in accommodation
app.route('/', adminUpdateFaqRoute);

// DELETE /:id/faqs/:faqId - Remove FAQ from accommodation
app.route('/', adminRemoveFaqRoute);

// POST /:id/media - Add a photo to accommodation gallery
// NOTE: Fixed-suffix routes like /:id/media/reorder MUST be registered BEFORE
// /:id/media/:mediaId to prevent Hono matching "reorder" as a UUID param.
// This comment block is the ordering anchor for future media endpoints.
app.route('/', adminAddMediaRoute);

export { app as adminAccommodationRoutes };
