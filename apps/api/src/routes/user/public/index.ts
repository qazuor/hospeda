/**
 * Public user routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicUserBatchRoute } from './batch';
import { publicGetUserAccommodationsRoute } from './getAccommodations';
import { publicGetUserByIdRoute } from './getById';

const app = createRouter();

// GET /batch - Get multiple users (must be registered before /:id to avoid conflict)
app.route('/', publicUserBatchRoute);

// GET /{id}/accommodations - List accommodations owned by user
app.route('/', publicGetUserAccommodationsRoute);

// GET /{id} - Get by ID (catch-all — registered last)
app.route('/', publicGetUserByIdRoute);

export { app as publicUserRoutes };
