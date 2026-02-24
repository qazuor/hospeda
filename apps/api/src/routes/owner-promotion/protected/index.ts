/**
 * Protected owner promotion routes
 * Routes that require user authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateOwnerPromotionRoute } from './create';
import { protectedPatchOwnerPromotionRoute } from './patch';
import { protectedDeleteOwnerPromotionRoute } from './softDelete';
import { protectedUpdateOwnerPromotionRoute } from './update';

const app = createRouter();

// POST / - Create owner promotion
app.route('/', protectedCreateOwnerPromotionRoute);

// PUT /:id - Update owner promotion
app.route('/', protectedUpdateOwnerPromotionRoute);

// PATCH /:id - Partial update owner promotion
app.route('/', protectedPatchOwnerPromotionRoute);

// DELETE /:id - Soft delete owner promotion
app.route('/', protectedDeleteOwnerPromotionRoute);

export { app as protectedOwnerPromotionRoutes };
