/**
 * Admin destination routes
 * All routes here require admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminDestinationReviewRoutes } from '../reviews/admin/index.js';
import { adminBatchDestinationsRoute } from './batch';
import { adminCreateDestinationRoute } from './create';
import { adminDeleteDestinationRoute } from './delete';
import { adminGetDestinationAncestorsRoute } from './getAncestors';
import { adminGetDestinationByIdRoute } from './getById';
import { adminGetDestinationChildrenRoute } from './getChildren';
import { adminGetDestinationDescendantsRoute } from './getDescendants';
import { adminHardDeleteDestinationRoute } from './hardDelete';
import { adminListDestinationsRoute } from './list';
import { adminPatchDestinationRoute } from './patch';
import { adminRestoreDestinationRoute } from './restore';
import { adminUpdateDestinationRoute } from './update';

const app = createRouter();

// GET / - List all destinations
app.route('/', adminListDestinationsRoute);

// POST / - Create destination
app.route('/', adminCreateDestinationRoute);

// POST /batch - Batch operations
// Registered before /{id} routes to prevent "batch" matching as a UUID param
app.route('/', adminBatchDestinationsRoute);

// Review admin routes (list, getById, update, delete, restore, hardDelete)
// Registered before /{id} routes to prevent "reviews" matching as a UUID param
app.route('/reviews', adminDestinationReviewRoutes);

// GET /:id - Get by ID
app.route('/', adminGetDestinationByIdRoute);

// PUT /:id - Update destination
app.route('/', adminUpdateDestinationRoute);

// PATCH /:id - Patch destination
app.route('/', adminPatchDestinationRoute);

// DELETE /:id - Soft delete destination
app.route('/', adminDeleteDestinationRoute);

// DELETE /:id/hard - Hard delete destination
app.route('/', adminHardDeleteDestinationRoute);

// POST /:id/restore - Restore destination
app.route('/', adminRestoreDestinationRoute);

// GET /:id/children - Get direct children (admin)
app.route('/', adminGetDestinationChildrenRoute);

// GET /:id/descendants - Get all descendants (admin)
app.route('/', adminGetDestinationDescendantsRoute);

// GET /:id/ancestors - Get ancestor chain (admin)
app.route('/', adminGetDestinationAncestorsRoute);

export { app as adminDestinationRoutes };
