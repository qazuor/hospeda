/**
 * Admin multi-role management endpoints (HOS-296 §7).
 *
 * Replace the scalar `role` field that used to be part of the generic user
 * update body. `users.role` no longer exists, so a user's hats can ONLY be
 * mutated here:
 * - GET    /{id}/role-grants   → held roles + when each was granted and by whom
 * - POST   /{id}/roles         → grant a hat (additive, idempotent)
 * - DELETE /{id}/roles/{role}  → revoke a hat (idempotent, never the last one)
 *
 * Both mutations are gated on `PermissionEnum.USER_UPDATE_ROLES` — the exact
 * permission the retired single-select already required, so no operator gains
 * or loses the capability in this cut (AC-10). The read is gated on
 * `USER_READ_ALL`, matching the `view` permission of the admin panel's
 * Role & Permissions section.
 *
 * **The read lives on its OWN path, and that is load-bearing.** Route-level
 * middlewares are registered with `app.use(path, mw)` (see
 * `applyRouteMiddlewares` in `utils/route-factory.ts`), which is
 * method-AGNOSTIC. Had the read stayed on `GET /{id}/roles` it would have
 * inherited the POST's `USER_UPDATE_ROLES` gate on the shared path, so reading
 * a user's roles would have demanded BOTH permissions. That is not moot:
 * `CLIENT_MANAGER` is seeded with `USER_READ_ALL` but NOT `USER_UPDATE_ROLES`
 * (`packages/seed/src/required/rolePermissions.seed.ts`), so it would have
 * received 403 on the user view / edit / permissions / activity pages, whose
 * header reads this endpoint. Do NOT move the read back onto `/{id}/roles`
 * without first making the factory gate per method.
 *
 * `DELETE /{id}/roles/{role}` shares no path with either — `/:id/roles/:role`
 * does not match `/:id/roles` — and both writes require the same permission
 * anyway, so nothing stacks between them.
 *
 * Audit: the `grantRole` / `revokeRole` primitives write the `user_role_audit`
 * row themselves, inside the same transaction as the mutation. These routes
 * pass the REAL actor id as `grantedBy` / `revokedBy` and forward the
 * operator's free-text `reason`, so an admin-initiated change is always
 * distinguishable from an automatic one (which passes `null` and one of the
 * canonical `RoleGrantReason` values) — AC-6.
 *
 * @module routes/user/admin/roles
 */

import {
    type GrantUserRoleBody,
    GrantUserRoleBodySchema,
    PermissionEnum,
    RevokeUserRoleQuerySchema,
    type RoleEnum,
    RoleEnumSchema,
    UserIdSchema,
    UserRoleGrantsResponseSchema,
    UserRoleMutationResponseSchema
} from '@repo/schemas';
import {
    getUserRoleGrants,
    getUserRoles,
    grantRole,
    revokeRole,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/users/{id}/role-grants
 *
 * Returns every hat the user wears, oldest grant first, each carrying its
 * `grantedAt` / `grantedBy` / `grantedByName` / `grantReason`. That provenance
 * is what makes an accumulated role set administrable rather than mysterious
 * (spec §6.5, R-1 mitigation).
 *
 * The path is deliberately NOT `/{id}/roles` — see the module note on
 * method-agnostic route middlewares.
 */
export const adminGetUserRolesRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/role-grants',
    summary: 'Get the roles a user holds (admin)',
    description:
        'Returns every role held by the user, each with when it was granted, by whom, and why. Ordered oldest grant first.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_READ_ALL],
    requestParams: { id: UserIdSchema },
    responseSchema: UserRoleGrantsResponseSchema,
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const userId = params.id as string;
        const roles = await getUserRoleGrants({ userId });

        return { userId, roles: [...roles] };
    }
});

/**
 * POST /api/v1/admin/users/{id}/roles
 *
 * Grants one hat. Additive by contract: it never removes another role, which
 * is the entire point of the change — the old single-select overwrote.
 * Idempotent, so re-granting a hat the user already wears succeeds and writes
 * no audit row (an audit trail records state changes, not requests).
 */
export const adminGrantUserRoleRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/roles',
    summary: 'Grant a role to a user (admin)',
    description:
        'Adds a role to the user without removing any other. Idempotent: granting a role the user already holds succeeds as a no-op.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_UPDATE_ROLES],
    requestParams: { id: UserIdSchema },
    requestBody: GrantUserRoleBodySchema,
    responseSchema: UserRoleMutationResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const userId = params.id as string;
        const { role, reason } = body as GrantUserRoleBody;

        const result = await grantRole({
            userId,
            role,
            // The REAL operator, never a placeholder: `by` is the only thing
            // that distinguishes an admin grant from an automatic one in the
            // audit trail (AC-6).
            grantedBy: actor.id,
            reason: reason ?? null
        });

        if (result.error) {
            // `reason` is forwarded, not dropped: it is the machine-readable
            // discriminator the admin panel uses to translate a refusal instead
            // of echoing the raw English message.
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        // No cache invalidation here: `getUserRoles` is an uncached read (a
        // per-user role cache was tried and removed — see its JSDoc), so the
        // post-mutation set is always current. The old `userCache.invalidate`
        // was dead code anyway — `userCache` holds `User` entities, which no
        // longer carry roles.
        const roles = await getUserRoles({ userId });
        return { userId, role, roles: [...roles] };
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

/**
 * DELETE /api/v1/admin/users/{id}/roles/{role}
 *
 * Revokes one hat. Idempotent when the user does not wear it.
 *
 * Refuses to remove the user's LAST role (AC-5): `revokeRole` returns a
 * `VALIDATION_ERROR`, which the shared error handler maps to **HTTP 400** —
 * deliberately a client error, not a 500. An account with zero roles resolves
 * to no permissions at all and is unrecoverable through this same endpoint
 * (there would be nothing left to revoke and nothing to authorise the fix), so
 * the guard is a hard rule rather than a warning.
 */
export const adminRevokeUserRoleRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/roles/{role}',
    summary: 'Revoke a role from a user (admin)',
    description:
        "Removes a role from the user. Idempotent when the user does not hold it. Returns 400 when the role is the user's last one — an account must always keep at least one.",
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_UPDATE_ROLES],
    requestParams: { id: UserIdSchema, role: RoleEnumSchema },
    // Hono discards DELETE bodies, so the operator's justification travels as
    // a query parameter — otherwise it would vanish silently from the audit
    // row (see `apps/api/CLAUDE.md`, "DELETE-body factory gotcha").
    requestQuery: RevokeUserRoleQuerySchema.shape,
    responseSchema: UserRoleMutationResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const userId = params.id as string;
        const role = params.role as RoleEnum;
        const reason = typeof query?.reason === 'string' ? query.reason : null;

        const result = await revokeRole({
            userId,
            role,
            revokedBy: actor.id,
            reason
        });

        if (result.error) {
            // See the grant handler: the `reason` (e.g. the last-role refusal)
            // has to survive so the panel can translate it.
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        // Uncached read — see the grant handler for why no invalidation lives
        // here.
        const roles = await getUserRoles({ userId });
        return { userId, role, roles: [...roles] };
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
