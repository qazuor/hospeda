import { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
/**
 * Admin per-user permission override endpoints (SPEC-170).
 *
 * Manage the `user_permission` overrides that sit on top of a user's role:
 * - GET    /{id}/permissions               → split view (fromRole / grant / deny)
 * - POST   /{id}/permissions               → create or update an override
 * - DELETE /{id}/permissions/{permission}  → remove an override
 *
 * Gated by the granular trio (PERMISSION_VIEW / PERMISSION_ASSIGN /
 * PERMISSION_REVOKE) in addition to the base admin-access check enforced by
 * `createAdminRoute`. Audit emission and cache invalidation happen inside the
 * service (wired to the API at startup via the permission-effects registry).
 */
import {
    type AssignUserPermissionOverrideBody,
    AssignUserPermissionOverrideBodySchema,
    PermissionAssignmentOutputSchema,
    PermissionEnum,
    PermissionEnumSchema,
    PermissionRemovalOutputSchema,
    UserIdSchema,
    UserPermissionOverridesResponseSchema
} from '@repo/schemas';
import { PermissionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const permissionService = new PermissionService(
    { logger: apiLogger },
    {
        rolePermissionModel: new RRolePermissionModel(),
        userPermissionModel: new RUserPermissionModel()
    }
);

/**
 * GET /api/v1/admin/users/{id}/permissions
 * Returns the user's effective permissions split into role / grant / deny.
 */
export const adminGetUserPermissionsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/permissions',
    summary: 'Get user permission overrides (admin)',
    description:
        "Returns the user's permissions split into fromRole, grantOverrides, denyOverrides.",
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.PERMISSION_VIEW],
    requestParams: { id: UserIdSchema },
    responseSchema: UserPermissionOverridesResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await permissionService.getPermissionOverridesForUser(actor, {
            userId: params.id as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * POST /api/v1/admin/users/{id}/permissions
 * Create or update (upsert) a per-user permission override.
 */
export const adminAssignUserPermissionRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/permissions',
    summary: 'Grant or deny a permission override for a user (admin)',
    description:
        'Creates or updates a per-user permission override. Returns 400 when the target user is a SUPER_ADMIN (overrides are moot for a super).',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.PERMISSION_ASSIGN],
    requestParams: { id: UserIdSchema },
    requestBody: AssignUserPermissionOverrideBodySchema,
    responseSchema: PermissionAssignmentOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { permission, effect } = body as AssignUserPermissionOverrideBody;
        const result = await permissionService.assignPermissionToUser(actor, {
            userId: params.id as string,
            permission,
            effect
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * DELETE /api/v1/admin/users/{id}/permissions/{permission}
 * Remove a per-user override (grant or deny); the user falls back to role-only.
 */
export const adminRevokeUserPermissionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/permissions/{permission}',
    summary: 'Remove a permission override for a user (admin)',
    description: 'Removes a per-user permission override (grant or deny).',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.PERMISSION_REVOKE],
    requestParams: { id: UserIdSchema, permission: PermissionEnumSchema },
    responseSchema: PermissionRemovalOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await permissionService.removePermissionFromUser(actor, {
            userId: params.id as string,
            permission: params.permission as PermissionEnum
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
