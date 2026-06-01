/**
 * Protected feature routes
 * Routes that require authentication
 *
 * Note (SPEC-172): the standalone "add/remove feature to accommodation" endpoints
 * have been removed. Feature associations are now managed via the accommodation
 * create/update endpoints using the `featureIds` array field.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateFeatureRoute } from './create';
import { protectedPatchFeatureRoute } from './patch';
import { protectedSoftDeleteFeatureRoute } from './softDelete';
import { protectedUpdateFeatureRoute } from './update';

const app = createRouter();

// POST / - Create feature
app.route('/', protectedCreateFeatureRoute);

// PUT /:id - Update feature
app.route('/', protectedUpdateFeatureRoute);

// PATCH /:id - Patch feature
app.route('/', protectedPatchFeatureRoute);

// DELETE /:id - Soft delete feature
app.route('/', protectedSoftDeleteFeatureRoute);

export { app as protectedFeatureRoutes };
