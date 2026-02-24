/**
 * Public owner promotion routes
 * Read-only routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetOwnerPromotionByIdRoute } from './getById';
import { publicListOwnerPromotionsRoute } from './list';

const app = createRouter();

// GET / - List owner promotions
app.route('/', publicListOwnerPromotionsRoute);

// GET /:id - Get by ID
app.route('/', publicGetOwnerPromotionByIdRoute);

export { app as publicOwnerPromotionRoutes };
