/**
 * Admin accommodation routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminAccommodationReviewRoutes } from '../reviews/admin/index.js';
import { adminAddFaqRoute } from './addFaq';
import { adminBatchAccommodationsRoute } from './batch';
import { adminCreateAccommodationRoute } from './create';
import { adminDeleteAccommodationRoute } from './delete';
import { adminGetAccommodationByIdRoute } from './getById';
import { adminGetFaqsRoute } from './getFaqs';
import { adminHardDeleteAccommodationRoute } from './hardDelete';
import { adminListAccommodationsRoute } from './list';
import { adminPatchAccommodationRoute } from './patch';
import { adminRemoveFaqRoute } from './removeFaq';
import { adminRestoreAccommodationRoute } from './restore';
import { adminUpdateAccommodationRoute } from './update';
import { adminUpdateFaqRoute } from './updateFaq';

const app = createRouter();

// GET / - List all accommodations (including deleted)
app.route('/', adminListAccommodationsRoute);

// POST / - Create accommodation
app.route('/', adminCreateAccommodationRoute);

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

// POST /batch - Batch operations
app.route('/', adminBatchAccommodationsRoute);

// GET /:id/faqs - Get accommodation FAQs
app.route('/', adminGetFaqsRoute);

// POST /:id/faqs - Add FAQ to accommodation
app.route('/', adminAddFaqRoute);

// PUT /:id/faqs/:faqId - Update FAQ in accommodation
app.route('/', adminUpdateFaqRoute);

// DELETE /:id/faqs/:faqId - Remove FAQ from accommodation
app.route('/', adminRemoveFaqRoute);

// Review admin routes (list, getById, update, delete, restore, hardDelete)
app.route('/reviews', adminAccommodationReviewRoutes);

export { app as adminAccommodationRoutes };
