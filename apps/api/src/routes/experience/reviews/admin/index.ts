/**
 * Admin experience review routes.
 * Routes that require admin-level access for review moderation.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminDeleteExperienceReviewRoute } from './delete';
import { adminGetExperienceReviewByIdRoute } from './getById';
import { adminListExperienceReviewsRoute } from './list';
import { adminModerateExperienceReviewRoute } from './moderate';
import { adminUpdateExperienceReviewRoute } from './update';

const app = createRouter();

// GET / - List all reviews (including pending)
app.route('/', adminListExperienceReviewsRoute);

// GET /:id - Get review by ID
app.route('/', adminGetExperienceReviewByIdRoute);

// PUT /:id - Update review
app.route('/', adminUpdateExperienceReviewRoute);

// DELETE /:id - Soft delete review
app.route('/', adminDeleteExperienceReviewRoute);

// POST /:id/moderate - Approve or reject review (T-021)
// Registered after /:id CRUD routes; the /moderate suffix makes it unambiguous.
app.route('/', adminModerateExperienceReviewRoute);

export { app as adminExperienceReviewRoutes };
