/**
 * Protected feature routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddFeatureToAccommodationRoute } from './addFeatureToAccommodation';
import { protectedCreateFeatureRoute } from './create';
import { protectedPatchFeatureRoute } from './patch';
import { protectedRemoveFeatureFromAccommodationRoute } from './removeFeatureFromAccommodation';
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

// POST /accommodation/:accommodationId - Add feature to accommodation
app.route('/', protectedAddFeatureToAccommodationRoute);

// DELETE /accommodation/:accommodationId/:featureId - Remove feature from accommodation
app.route('/', protectedRemoveFeatureFromAccommodationRoute);

export { app as protectedFeatureRoutes };
