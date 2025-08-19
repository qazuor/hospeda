import { createRouter } from '../../../utils/create-app';
import { createAccommodationReviewRoute } from './create';
import { listAccommodationReviewsRoute } from './list';

const app = createRouter();

app.route('/', listAccommodationReviewsRoute);
app.route('/', createAccommodationReviewRoute);

export { app as accommodationReviewRoutes };
