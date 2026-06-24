/**
 * Admin accommodation routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminAccommodationReviewRoutes } from '../reviews/admin/index.js';
import { adminAddFaqRoute } from './addFaq';
import { adminAddMediaRoute } from './addMedia';
import { adminArchiveMediaRoute } from './archiveMedia';
import { adminBatchAccommodationsRoute } from './batch';
import { adminCreateAccommodationRoute } from './create';
import { adminDeleteAccommodationRoute } from './delete';
import { adminGetAccommodationByIdRoute } from './getById';
import { adminGetFaqsRoute } from './getFaqs';
import { adminGetMediaRoute } from './getMedia';
import { adminHardDeleteAccommodationRoute } from './hardDelete';
import { adminListAccommodationsRoute } from './list';
import { adminAccommodationOptionsRoute } from './options';
import { adminPatchAccommodationRoute } from './patch';
import { adminRemoveFaqRoute } from './removeFaq';
import { adminRemoveMediaRoute } from './removeMedia';
import { adminReorderAccommodationFaqsRoute } from './reorderFaqs';
import { adminReorderMediaRoute } from './reorderMedia';
import { adminRestoreAccommodationRoute } from './restore';
import { adminRestoreMediaRoute } from './restoreMedia';
import { adminSetFeaturedMediaRoute } from './setFeaturedMedia';
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

// PATCH /:id/media/reorder - Reorder gallery photos
// Registered BEFORE /:id/media/:mediaId so Hono does not resolve "reorder" as a UUID param
// (same ordering rule as /:id/faqs/reorder above).
app.route('/', adminReorderMediaRoute);

// GET /:id/media - List gallery photos
app.route('/', adminGetMediaRoute);

// POST /:id/media - Add a photo to accommodation gallery
// NOTE: Fixed-suffix routes like /:id/media/reorder MUST be registered BEFORE
// /:id/media/:mediaId to prevent Hono matching "reorder" as a UUID param.
// This comment block is the ordering anchor for future media endpoints.
app.route('/', adminAddMediaRoute);

// PUT /:id/media/:mediaId/featured - Promote a photo as the featured image
// POST /:id/media/:mediaId/archive  - Archive a visible photo
// POST /:id/media/:mediaId/restore  - Restore an archived photo
// IMPORTANT: These fixed-suffix paths (/.../featured, /.../archive, /.../restore)
// MUST be registered BEFORE /:id/media/:mediaId (DELETE) so Hono does not
// resolve "featured", "archive", or "restore" as a nested param segment.
app.route('/', adminSetFeaturedMediaRoute);
app.route('/', adminArchiveMediaRoute);
app.route('/', adminRestoreMediaRoute);

// DELETE /:id/media/:mediaId - Remove a photo from accommodation gallery
app.route('/', adminRemoveMediaRoute);

export { app as adminAccommodationRoutes };
