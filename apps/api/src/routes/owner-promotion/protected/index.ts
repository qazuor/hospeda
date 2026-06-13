/**
 * Protected owner promotion routes
 * Routes that require user authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateOwnerPromotionRoute } from './create';
import { protectedGetOwnerPromotionByIdRoute } from './get';
import { protectedListOwnOwnerPromotionsRoute } from './list';
import { protectedPatchOwnerPromotionRoute } from './patch';
import { protectedDeleteOwnerPromotionRoute } from './softDelete';
import { protectedUpdateOwnerPromotionRoute } from './update';

const app = createRouter();

// GET / - List own owner-promotions (all lifecycle states)
app.route('/', protectedListOwnOwnerPromotionsRoute);

// GET /:id - Get own owner-promotion by ID
app.route('/', protectedGetOwnerPromotionByIdRoute);

// POST / - Create owner promotion
app.route('/', protectedCreateOwnerPromotionRoute);

// PUT /:id - Update owner promotion
app.route('/', protectedUpdateOwnerPromotionRoute);

// PATCH /:id - Partial update owner promotion
app.route('/', protectedPatchOwnerPromotionRoute);

// DELETE /:id - Soft delete owner promotion
app.route('/', protectedDeleteOwnerPromotionRoute);

export { app as protectedOwnerPromotionRoutes };
