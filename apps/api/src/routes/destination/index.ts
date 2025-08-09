import createApp from '../../utils/create-app';

import { createDestinationRoute } from './create';
import { getDestinationAccommodationsRoute } from './getAccommodations';
import { destinationGetByIdRoute } from './getById';
import { getDestinationBySlugRoute } from './getBySlug';
import { getDestinationStatsRoute } from './getStats';
import { getDestinationSummaryRoute } from './getSummary';
import { hardDeleteDestinationRoute } from './hardDelete';
import { destinationListRoute } from './list';
import { restoreDestinationRoute } from './restore';
import { softDeleteDestinationRoute } from './softDelete';
import { updateDestinationRoute } from './update';

const app = createApp();

// Public routes
app.route('/', destinationListRoute);
app.route('/', destinationGetByIdRoute);
app.route('/', getDestinationBySlugRoute);
app.route('/', getDestinationStatsRoute);
app.route('/', getDestinationSummaryRoute);
app.route('/', getDestinationAccommodationsRoute);

// Protected routes
app.route('/', createDestinationRoute);
app.route('/', updateDestinationRoute);
app.route('/', softDeleteDestinationRoute);
app.route('/', restoreDestinationRoute);

// Admin routes
app.route('/', hardDeleteDestinationRoute);

export { app as destinationRoutes };
