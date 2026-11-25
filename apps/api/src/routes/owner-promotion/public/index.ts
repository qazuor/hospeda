/**
 * Public owner promotion routes
 * Read-only routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetOwnerPromotionByIdRoute } from './getById';
import { publicListOwnerPromotionsRoute } from './list';
import { publicListingOwnerPromotionsRoute } from './listing';
import { publicVisibleOwnerPromotionsRoute } from './visible';

const app = createRouter();

// GET / - List owner promotions
app.route('/', publicListOwnerPromotionsRoute);

// HOS-2589: per-actor reads, mounted before `/{id}` so the literal paths win.
app.route('/', publicVisibleOwnerPromotionsRoute);
app.route('/', publicListingOwnerPromotionsRoute);

// GET /:id - Get by ID
app.route('/', publicGetOwnerPromotionByIdRoute);

export { app as publicOwnerPromotionRoutes };
