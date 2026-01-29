/**
 * Admin feature routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchFeaturesRoute } from './batch';
import { adminListFeaturesRoute } from './list';
import { adminRestoreFeatureRoute } from './restore';

const app = createRouter();

// GET / - List all features (including deleted)
app.route('/', adminListFeaturesRoute);

// POST /:id/restore - Restore feature
app.route('/', adminRestoreFeatureRoute);

// POST /batch - Batch get features
app.route('/', adminBatchFeaturesRoute);

export { app as adminFeatureRoutes };
