import { createRouter } from '../../../utils/create-app.js';
import { adminContentModerationHealthRoute } from './health.js';
import { adminContentModerationTermRoutes } from './terms/index.js';
import { adminContentModerationThresholdRoutes } from './thresholds/index.js';

const app = createRouter();

// Health endpoint
app.route('/', adminContentModerationHealthRoute);

// Terms CRUD (registered before thresholds to avoid path conflicts)
app.route('/terms', adminContentModerationTermRoutes);

// Thresholds CRUD + resolved
app.route('/thresholds', adminContentModerationThresholdRoutes);

export { app as adminContentModerationRoutes };
