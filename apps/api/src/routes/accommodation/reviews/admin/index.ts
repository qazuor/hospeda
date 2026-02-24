/**
 * Admin accommodation review routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../../utils/create-app';
import { adminDeleteAccommodationReviewRoute } from './delete';
import { adminGetAccommodationReviewByIdRoute } from './getById';
import { adminHardDeleteAccommodationReviewRoute } from './hardDelete';
import { adminListAccommodationReviewsRoute } from './list';
import { adminRestoreAccommodationReviewRoute } from './restore';
import { adminUpdateAccommodationReviewRoute } from './update';

const app = createRouter();

// GET / - List all reviews
app.route('/', adminListAccommodationReviewsRoute);

// GET /:id - Get review by ID
app.route('/', adminGetAccommodationReviewByIdRoute);

// PUT /:id - Update review
app.route('/', adminUpdateAccommodationReviewRoute);

// DELETE /:id - Soft delete review
app.route('/', adminDeleteAccommodationReviewRoute);

// POST /:id/restore - Restore review
app.route('/', adminRestoreAccommodationReviewRoute);

// DELETE /:id/hard - Hard delete review
app.route('/', adminHardDeleteAccommodationReviewRoute);

export { app as adminAccommodationReviewRoutes };
