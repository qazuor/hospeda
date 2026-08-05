import { RRolePermissionModel, RUserPermissionModel } from '@repo/db';
/**
 * Admin per-user permission override endpoints (SPEC-170).
 *
 * Manage the `user_permission` overrides that sit on top of a user's role:
 * - GET    /{id}/permissions               → split view (fromRole / grant / deny)
 * - POST   /{id}/permissions               → create or update an override
 * - DELETE /{id}/permissions/{permission}  → remove an override
 *
 * Plus the atomic trusted-editor action (HOS-374 §5.1.2 / OQ-1), which moves the
 * four `TRUSTED_EDITOR_PERMISSIONS` together instead of four separate clicks:
 * - PUT    /{id}/trusted-editor            → `{ trusted }` grants or deletes all four
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
    type SetTrustedEditorBody,
    SetTrustedEditorBodySchema,
    TrustedEditorResultSchema,
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

/**
 * PUT /api/v1/admin/users/{id}/trusted-editor
 *
 * Sets a user's trusted-editor status (HOS-374 §5.1.2 / OQ-1). `trusted: true`
 * grants all four `TRUSTED_EDITOR_PERMISSIONS` in a single transaction;
 * `trusted: false` hard-deletes them so the user falls back to role defaults.
 * One action rather than four `PermissionPicker` clicks, because "publish but
 * not delete" is a state nobody intends. Both directions are idempotent, and
 * marking normalizes (an existing `deny` becomes `grant`).
 *
 * WHY ONE `PUT` AND NOT A `POST`/`DELETE` PAIR:
 * route-factory middlewares are registered per PATH and are method-agnostic —
 * the same behavior `roles.ts` documents for `/{id}/roles`. Two methods sharing
 * this path would both be gated by whichever route was registered first, so the
 * second one's declared `requiredPermissions` would be a claim the router never
 * honors. Collapsing to a single path makes the declared gate exactly the
 * enforced gate. It also matches the domain: the spec treats marking and
 * unmarking as one atomic capability, not two.
 *
 * Consequently the gate is BOTH permissions, in either direction. That is the
 * honest reading of what a single shared middleware can enforce, and it is moot
 * in practice — only SUPER_ADMIN holds the trio (SPEC-170 T-011).
 */
export const adminSetTrustedEditorRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/trusted-editor',
    summary: 'Set a user trusted-editor status (admin)',
    description:
        'Atomically grants or removes the four trusted-editor permission overrides (post/event publish-own and delete-own). Idempotent; granting normalizes any pre-existing deny to grant, removing deletes the rows whatever their effect. Returns 400 when the target user is a SUPER_ADMIN (overrides are moot for a super).',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.PERMISSION_ASSIGN, PermissionEnum.PERMISSION_REVOKE],
    requestParams: { id: UserIdSchema },
    requestBody: SetTrustedEditorBodySchema,
    responseSchema: TrustedEditorResultSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { trusted } = body as SetTrustedEditorBody;
        const userId = params.id as string;

        const result = trusted
            ? await permissionService.setTrustedEditor(actor, { userId })
            : await permissionService.unsetTrustedEditor(actor, { userId });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
