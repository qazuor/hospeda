/**
 * Admin feature routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchFeaturesRoute } from './batch';
import { adminCreateFeatureRoute } from './create';
import { adminDeleteFeatureRoute } from './delete';
import { adminGetFeatureByIdRoute } from './getById';
import { adminHardDeleteFeatureRoute } from './hardDelete';
import { adminListFeaturesRoute } from './list';
import { adminPatchFeatureRoute } from './patch';
import { adminRestoreFeatureRoute } from './restore';
import { adminUpdateFeatureRoute } from './update';

const app = createRouter();

// GET / - List all features (including deleted)
app.route('/', adminListFeaturesRoute);

// GET /:id - Get feature by ID
app.route('/', adminGetFeatureByIdRoute);

// POST / - Create feature
app.route('/', adminCreateFeatureRoute);

// POST /batch - Batch get features
app.route('/', adminBatchFeaturesRoute);

// POST /:id/restore - Restore feature
app.route('/', adminRestoreFeatureRoute);

// PUT /:id - Update feature
app.route('/', adminUpdateFeatureRoute);

// PATCH /:id - Partial update feature
app.route('/', adminPatchFeatureRoute);

// DELETE /:id - Soft delete feature
app.route('/', adminDeleteFeatureRoute);

// DELETE /:id/hard - Hard delete feature
app.route('/', adminHardDeleteFeatureRoute);

export { app as adminFeatureRoutes };
