import { createRouter } from '../../utils/create-app';

import { destinationBatchRoute } from './batch';
import { createDestinationRoute } from './create';
import { getDestinationAccommodationsRoute } from './getAccommodations';
import { destinationGetByIdRoute } from './getById';
import { getDestinationBySlugRoute } from './getBySlug';
import { getDestinationStatsRoute } from './getStats';
import { getDestinationSummaryRoute } from './getSummary';
import { hardDeleteDestinationRoute } from './hardDelete';
import { destinationListRoute } from './list';
import { patchDestinationRoute } from './patch';
import { restoreDestinationRoute } from './restore';
import { destinationReviewRoutes } from './reviews';
import { softDeleteDestinationRoute } from './softDelete';
import { updateDestinationRoute } from './update';

const app = createRouter();

// Public routes
app.route('/', destinationListRoute);
app.route('/', destinationGetByIdRoute);
app.route('/', destinationBatchRoute); // POST /batch
app.route('/', getDestinationBySlugRoute);
app.route('/', getDestinationStatsRoute);
app.route('/', getDestinationSummaryRoute);
app.route('/', getDestinationAccommodationsRoute);
app.route('/', destinationReviewRoutes); // /:destinationId/reviews

// Protected routes
app.route('/', createDestinationRoute);
app.route('/', updateDestinationRoute);
app.route('/', patchDestinationRoute);
app.route('/', softDeleteDestinationRoute);
app.route('/', restoreDestinationRoute);

// Admin routes
app.route('/', hardDeleteDestinationRoute);

export { app as destinationRoutes };
