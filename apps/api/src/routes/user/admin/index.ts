/**
 * Admin user routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminUserBatchRoute } from './batch';
import { adminCreateUserRoute } from './create';
import { adminDeleteUserRoute } from './delete';
import { adminGetUserByIdRoute } from './getById';
import { adminListUsersRoute } from './list';
import { adminPatchUserRoute } from './patch';
import { adminUpdateUserRoute } from './update';

const app = createRouter();

// GET / - List all users
app.route('/', adminListUsersRoute);

// POST / - Create user
app.route('/', adminCreateUserRoute);

// GET /:id - Get by ID
app.route('/', adminGetUserByIdRoute);

// PUT /:id - Update user
app.route('/', adminUpdateUserRoute);

// PATCH /:id - Patch user
app.route('/', adminPatchUserRoute);

// DELETE /:id - Soft delete user
app.route('/', adminDeleteUserRoute);

// POST /batch - Get multiple users
app.route('/', adminUserBatchRoute);

export { app as adminUserRoutes };
