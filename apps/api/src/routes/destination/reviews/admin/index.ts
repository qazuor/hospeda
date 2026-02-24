/**
 * Admin destination review routes
 * All routes here require admin role and specific permissions
 */
import { createRouter } from '../../../../utils/create-app';
import { adminDeleteDestinationReviewRoute } from './delete';
import { adminGetDestinationReviewByIdRoute } from './getById';
import { adminHardDeleteDestinationReviewRoute } from './hardDelete';
import { adminListDestinationReviewsRoute } from './list';
import { adminRestoreDestinationReviewRoute } from './restore';
import { adminUpdateDestinationReviewRoute } from './update';

const app = createRouter();

// GET / - List all destination reviews
app.route('/', adminListDestinationReviewsRoute);

// GET /:id - Get review by ID
app.route('/', adminGetDestinationReviewByIdRoute);

// PUT /:id - Update review
app.route('/', adminUpdateDestinationReviewRoute);

// DELETE /:id - Soft delete review
app.route('/', adminDeleteDestinationReviewRoute);

// POST /:id/restore - Restore review
app.route('/', adminRestoreDestinationReviewRoute);

// DELETE /:id/hard - Permanently delete review
app.route('/', adminHardDeleteDestinationReviewRoute);

export { app as adminDestinationReviewRoutes };
