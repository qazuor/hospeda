/**
 * Public user routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicUserBatchRoute } from './batch';
import { publicGetUserByIdRoute } from './getById';

const app = createRouter();

// GET /:id - Get by ID
app.route('/', publicGetUserByIdRoute);

// POST /batch - Get multiple users
app.route('/', publicUserBatchRoute);

export { app as publicUserRoutes };
