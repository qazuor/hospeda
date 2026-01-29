/**
 * Protected user routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedGetUserByIdRoute } from './getById';
import { protectedPatchUserRoute } from './patch';
import { protectedUpdateUserRoute } from './update';

const app = createRouter();

// GET /:id - Get by ID
app.route('/', protectedGetUserByIdRoute);

// PUT /:id - Update user
app.route('/', protectedUpdateUserRoute);

// PATCH /:id - Patch user
app.route('/', protectedPatchUserRoute);

export { app as protectedUserRoutes };
