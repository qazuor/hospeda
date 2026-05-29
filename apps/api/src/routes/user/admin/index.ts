/**
 * Admin user routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminUserBatchRoute } from './batch';
import { adminCreateUserRoute } from './create';
import { adminDeleteUserRoute } from './delete';
import { adminGetUserByIdRoute } from './getById';
import { adminHardDeleteUserRoute } from './hardDelete';
import { adminListUsersRoute } from './list';
import { adminUserOptionsRoute } from './options';
import { adminPatchUserRoute } from './patch';
import { adminRestoreUserRoute } from './restore';
import { adminUserStatsRoute } from './stats';
import { adminUpdateUserRoute } from './update';

const app = createRouter();

// GET / - List all users
app.route('/', adminListUsersRoute);

// GET /stats - Aggregated stats for admin dashboard (SPEC-155 T-012)
// NOTE: registered before /:id routes to prevent the param segment from
// matching the literal string "stats".
app.route('/', adminUserStatsRoute);

// GET /options - Lightweight relation-selector lookup (SPEC-169 §5.5)
// Registered before /:id so Hono does not resolve "options" as a UUID param
app.route('/', adminUserOptionsRoute);

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

// DELETE /:id/hard - Hard delete user
app.route('/', adminHardDeleteUserRoute);

// POST /:id/restore - Restore soft-deleted user
app.route('/', adminRestoreUserRoute);

// POST /batch - Get multiple users
app.route('/', adminUserBatchRoute);

export { app as adminUserRoutes };
