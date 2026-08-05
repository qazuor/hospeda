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
import {
    adminAssignUserPermissionRoute,
    adminGetUserPermissionsRoute,
    adminRevokeUserPermissionRoute,
    adminSetTrustedEditorRoute,
    adminUnsetTrustedEditorRoute
} from './permissions';
import { adminRestoreUserRoute } from './restore';
import { adminGetUserRolesRoute, adminGrantUserRoleRoute, adminRevokeUserRoleRoute } from './roles';
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

// Per-user permission overrides (SPEC-170). Registered BEFORE the /:id routes
// so "permissions" is never matched as a bare /:id segment.
// GET    /:id/permissions
// POST   /:id/permissions
// DELETE /:id/permissions/:permission
app.route('/', adminGetUserPermissionsRoute);
app.route('/', adminAssignUserPermissionRoute);
app.route('/', adminRevokeUserPermissionRoute);

// Atomic trusted-editor action (HOS-374 §5.1.2 / OQ-1). Same reason as above:
// registered BEFORE the /:id routes so "trusted-editor" is never matched as a
// bare /:id segment.
// POST   /:id/trusted-editor
// DELETE /:id/trusted-editor
app.route('/', adminSetTrustedEditorRoute);
app.route('/', adminUnsetTrustedEditorRoute);

// Multi-role management (HOS-296). Registered BEFORE the /:id routes for the
// same reason as the permission overrides above: "roles" and "role-grants" must
// never be matched as a bare /:id segment.
// GET    /:id/role-grants
// POST   /:id/roles
// DELETE /:id/roles/:role
//
// The READ deliberately lives on its OWN path — do NOT move it back onto
// /:id/roles. Route middlewares are registered per PATH and are
// method-agnostic, so sharing the path with the POST would make the read
// additionally demand USER_UPDATE_ROLES, which CLIENT_MANAGER does not hold;
// the admin user header would then 403 for them.
app.route('/', adminGetUserRolesRoute);
app.route('/', adminGrantUserRoleRoute);
app.route('/', adminRevokeUserRoleRoute);

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
