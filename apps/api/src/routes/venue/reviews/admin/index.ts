/**
 * Admin venue review routes.
 * Routes that require admin-level access for review moderation.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminDeleteVenueReviewRoute } from './delete';
import { adminGetVenueReviewByIdRoute } from './getById';
import { adminListVenueReviewsRoute } from './list';
import { adminModerateVenueReviewRoute } from './moderate';
import { adminUpdateVenueReviewRoute } from './update';

const app = createRouter();

// GET / - List all reviews (including pending)
app.route('/', adminListVenueReviewsRoute);

// GET /:id - Get review by ID
app.route('/', adminGetVenueReviewByIdRoute);

// PUT /:id - Update review
app.route('/', adminUpdateVenueReviewRoute);

// DELETE /:id - Soft delete review
app.route('/', adminDeleteVenueReviewRoute);

// POST /:id/moderate - Approve or reject review (T-046)
// Registered after /:id CRUD routes; the /moderate suffix makes it unambiguous.
app.route('/', adminModerateVenueReviewRoute);

export { app as adminVenueReviewRoutes };
