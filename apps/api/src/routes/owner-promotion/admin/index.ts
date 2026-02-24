/**
 * Admin owner promotion routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateOwnerPromotionRoute } from './create';
import { adminDeleteOwnerPromotionRoute } from './delete';
import { adminGetOwnerPromotionByIdRoute } from './getById';
import { adminHardDeleteOwnerPromotionRoute } from './hardDelete';
import { adminListOwnerPromotionsRoute } from './list';
import { adminPatchOwnerPromotionRoute } from './patch';
import { adminRestoreOwnerPromotionRoute } from './restore';
import { adminUpdateOwnerPromotionRoute } from './update';

const app = createRouter();

// GET / - List all owner promotions (including deleted)
app.route('/', adminListOwnerPromotionsRoute);

// POST / - Create owner promotion
app.route('/', adminCreateOwnerPromotionRoute);

// GET /:id - Get by ID
app.route('/', adminGetOwnerPromotionByIdRoute);

// PUT /:id - Update owner promotion
app.route('/', adminUpdateOwnerPromotionRoute);

// PATCH /:id - Partial update owner promotion
app.route('/', adminPatchOwnerPromotionRoute);

// DELETE /:id - Soft delete owner promotion
app.route('/', adminDeleteOwnerPromotionRoute);

// DELETE /:id/hard - Hard delete owner promotion
app.route('/', adminHardDeleteOwnerPromotionRoute);

// POST /:id/restore - Restore owner promotion
app.route('/', adminRestoreOwnerPromotionRoute);

export { app as adminOwnerPromotionRoutes };
