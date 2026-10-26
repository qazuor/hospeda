/**
 * Admin gastronomy review routes.
 * Routes that require admin-level access for review moderation.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminDeleteGastronomyReviewRoute } from '../../../gastronomy/reviews/admin/delete';
import { adminGetGastronomyReviewByIdRoute } from '../../../gastronomy/reviews/admin/getById';
import { adminListGastronomyReviewsRoute } from '../../../gastronomy/reviews/admin/list';
import { adminModerateGastronomyReviewRoute } from '../../../gastronomy/reviews/admin/moderate';
import { adminUpdateGastronomyReviewRoute } from '../../../gastronomy/reviews/admin/update';

const app = createRouter();

// GET / - List all reviews (including pending)
app.route('/', adminListGastronomyReviewsRoute);

// GET /:id - Get review by ID
app.route('/', adminGetGastronomyReviewByIdRoute);

// PUT /:id - Update review
app.route('/', adminUpdateGastronomyReviewRoute);

// DELETE /:id - Soft delete review
app.route('/', adminDeleteGastronomyReviewRoute);

// POST /:id/moderate - Approve or reject review (T-046)
// Registered after /:id CRUD routes; the /moderate suffix makes it unambiguous.
app.route('/', adminModerateGastronomyReviewRoute);

export { app as adminGastronomyReviewRoutes };
