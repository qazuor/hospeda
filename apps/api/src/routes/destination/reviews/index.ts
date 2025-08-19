import { createRouter } from '../../../utils/create-app';
import { createDestinationReviewRoute } from './create';
import { listDestinationReviewsRoute } from './list';

const app = createRouter();

app.route('/', listDestinationReviewsRoute);
app.route('/', createDestinationReviewRoute);

export { app as destinationReviewRoutes };
