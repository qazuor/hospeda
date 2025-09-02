import { createRouter } from '../../utils/create-app';
import { addFeatureToAccommodationRoute } from './addFeatureToAccommodation';
import { featureBatchRoute } from './batch';
import { createFeatureRoute } from './create';
import { getAccommodationsByFeatureRoute } from './getAccommodationsByFeature';
import { getFeaturesForAccommodationRoute } from './getFeaturesForAccommodation';
import { featureListRoute } from './list';
import { removeFeatureFromAccommodationRoute } from './removeFeatureFromAccommodation';
import { restoreFeatureRoute } from './restore';
import { searchFeaturesRoute } from './search';
import { featureGetByIdRoute } from './show';
import { softDeleteFeatureRoute } from './softDelete';
import { updateFeatureRoute } from './update';

const app = createRouter();

// Public
app.route('/', featureListRoute);
app.route('/', featureBatchRoute);
app.route('/', featureGetByIdRoute);
// Relations
app.route('/', getAccommodationsByFeatureRoute);
app.route('/', getFeaturesForAccommodationRoute);
app.route('/', addFeatureToAccommodationRoute);
app.route('/', removeFeatureFromAccommodationRoute);
// CRUD
app.route('/', createFeatureRoute);
app.route('/', updateFeatureRoute);
app.route('/', softDeleteFeatureRoute);
app.route('/', restoreFeatureRoute);
// Search
app.route('/', searchFeaturesRoute);

export { app as featureRoutes };
