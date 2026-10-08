/**
 * Access control for Better Auth's `admin` plugin.
 *
 * Hospeda keeps the plugin for ONE job: rejecting the session of a banned
 * account at sign-in (its `databaseHooks.session.create.before` reads
 * `users.banned` / `users.ban_expires`, which does not depend on any role).
 * Everything else the plugin offers is authorization that already lives in
 * Hospeda's own `PermissionEnum`-gated routes, so no plugin role grants any
 * plugin action (HOS-1352 V5, DEC-AUTH-003 points 4 and 5):
 *
 * - `impersonate` and `set-role` are gone from the statements: impersonation
 *   leaves the product entirely, and `set-role` was a second path to assign
 *   roles outside Hospeda's role-assignment action.
 * - `fullAdminRole` lists no action at all, exactly like `noAdminRole`. In
 *   particular `user: delete` was a physical account-deletion door.
 *
 * The roles still exist because the plugin validates `adminRoles` against the
 * keys of its `roles` map at construction time and throws otherwise.
 *
 * @module auth-admin-access
 */

import { RoleEnum } from '@repo/schemas';
import { createAccessControl } from 'better-auth/plugins';

/**
 * Plugin-level statements: the actions a plugin role could be granted.
 * Neither `impersonate` nor `set-role` is among them.
 */
export const adminPluginStatements = {
    user: ['create', 'list', 'ban', 'delete', 'set-password', 'get', 'update'],
    session: ['list', 'revoke', 'delete']
} as const;

const ac = createAccessControl(adminPluginStatements);

/**
 * Plugin role for SUPER_ADMIN and ADMIN. Grants NO plugin action: every
 * `/api/auth/admin/*` endpoint is forbidden to them.
 */
export const fullAdminRole = ac.newRole({
    user: [],
    session: []
});

/** Plugin role for every other Hospeda role. Grants no plugin action. */
export const noAdminRole = ac.newRole({
    user: [],
    session: []
});

/**
 * The `roles` map handed to the `admin()` plugin, keyed by Hospeda role.
 */
export const adminPluginRoles = {
    [RoleEnum.SUPER_ADMIN]: fullAdminRole,
    [RoleEnum.ADMIN]: fullAdminRole,
    [RoleEnum.CLIENT_MANAGER]: noAdminRole,
    [RoleEnum.EDITOR]: noAdminRole,
    [RoleEnum.HOST]: noAdminRole,
    [RoleEnum.SPONSOR]: noAdminRole,
    [RoleEnum.USER]: noAdminRole,
    [RoleEnum.GUEST]: noAdminRole
} as const;
