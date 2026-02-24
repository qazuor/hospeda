/**
 * Protected accommodation review routes
 * Routes that require authentication
 */
import { createRouter } from '../../../../utils/create-app';
import { protectedCreateAccommodationReviewRoute } from './create';

const app = createRouter();

app.route('/', protectedCreateAccommodationReviewRoute);

export { app as protectedAccommodationReviewRoutes };
