/**
 * Protected accommodation review routes
 * Routes that require authentication
 */
import { createRouter } from '../../../../utils/create-app';
import { protectedCreateAccommodationReviewRoute } from './create';
import {
    protectedCreateReviewReplyRoute,
    protectedDeleteReviewReplyRoute,
    protectedEditReviewReplyRoute
} from './reply';

const app = createRouter();

app.route('/', protectedCreateAccommodationReviewRoute);

// POST|PATCH|DELETE /:accommodationId/reviews/:reviewId/reply - Host reply (HOS-2199)
app.route('/', protectedCreateReviewReplyRoute);
app.route('/', protectedEditReviewReplyRoute);
app.route('/', protectedDeleteReviewReplyRoute);

export { app as protectedAccommodationReviewRoutes };
