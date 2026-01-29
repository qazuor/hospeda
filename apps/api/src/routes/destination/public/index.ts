/**
 * Public destination routes
 * All routes here are accessible without authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetDestinationAccommodationsRoute } from './getAccommodations';
import { publicGetDestinationByIdRoute } from './getById';
import { publicGetDestinationBySlugRoute } from './getBySlug';
import { publicGetDestinationStatsRoute } from './getStats';
import { publicGetDestinationSummaryRoute } from './getSummary';
import { publicListDestinationsRoute } from './list';

const app = createRouter();

// Register routes
app.route('/', publicListDestinationsRoute);
app.route('/', publicGetDestinationByIdRoute);
app.route('/', publicGetDestinationBySlugRoute);
app.route('/', publicGetDestinationSummaryRoute);
app.route('/', publicGetDestinationStatsRoute);
app.route('/', publicGetDestinationAccommodationsRoute);

export { app as publicDestinationRoutes };
