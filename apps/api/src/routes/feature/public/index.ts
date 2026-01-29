/**
 * Public feature routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetAccommodationsByFeatureRoute } from './getAccommodationsByFeature';
import { publicGetFeaturesForAccommodationRoute } from './getFeaturesForAccommodation';
import { publicListFeaturesRoute } from './list';
import { publicSearchFeaturesRoute } from './search';
import { publicGetFeatureByIdRoute } from './show';

const app = createRouter();

// GET / - List features
app.route('/', publicListFeaturesRoute);

// GET /:id - Get by ID
app.route('/', publicGetFeatureByIdRoute);

// GET /search - Search features
app.route('/', publicSearchFeaturesRoute);

// GET /accommodation/:accommodationId - Get features for accommodation
app.route('/', publicGetFeaturesForAccommodationRoute);

// GET /:featureId/accommodations - Get accommodations by feature
app.route('/', publicGetAccommodationsByFeatureRoute);

export { app as publicFeatureRoutes };
