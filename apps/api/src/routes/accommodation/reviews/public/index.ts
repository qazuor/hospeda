/**
 * Public accommodation review routes
 * Routes that do not require authentication
 */
import { createRouter } from '../../../../utils/create-app';
import { publicListAccommodationReviewsRoute } from './list';

const app = createRouter();

app.route('/', publicListAccommodationReviewsRoute);

export { app as publicAccommodationReviewRoutes };
