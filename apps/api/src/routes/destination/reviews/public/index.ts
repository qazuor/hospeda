/**
 * Public destination review routes
 */
import { createRouter } from '../../../../utils/create-app';
import { publicListDestinationReviewsRoute } from './list';

const app = createRouter();

app.route('/', publicListDestinationReviewsRoute);

export { app as publicDestinationReviewRoutes };
