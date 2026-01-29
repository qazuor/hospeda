/**
 * Protected destination review routes
 */
import { createRouter } from '../../../../utils/create-app';
import { protectedCreateDestinationReviewRoute } from './create';

const app = createRouter();

app.route('/', protectedCreateDestinationReviewRoute);

export { app as protectedDestinationReviewRoutes };
