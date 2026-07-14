/**
 * Admin update user endpoint
 * Allows admins to update any user
 */
import {
    BirthDateHttpInputSchema,
    PermissionEnum,
    UserAdminSchema,
    UserIdSchema,
    type UserUpdateInput,
    UserUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { withDomainBirthDate } from '../../../utils/user-birth-date';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * Body schema for the admin PUT route. Same as `UserUpdateInputSchema`
 * except `birthDate` is overridden with `BirthDateHttpInputSchema` (BETA-34).
 * See that schema's JSDoc for why the domain `z.date()` field cannot be used
 * directly on an HTTP request schema.
 */
const UserAdminUpdateInputSchema = UserUpdateInputSchema.extend({
    birthDate: BirthDateHttpInputSchema
});

/**
 * PUT /api/v1/admin/users/:id
 * Update user - Admin endpoint
 */
export const adminUpdateUserRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update user (admin)',
    description: 'Updates any user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.MANAGE_USERS],
    requestParams: {
        id: UserIdSchema
    },
    requestBody: UserAdminUpdateInputSchema,
    responseSchema: UserAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        // `birthDate` arrives as a `YYYY-MM-DD` string / `''` / `null` per
        // `BirthDateHttpInputSchema` and is converted to the domain `Date |
        // null` shape `UserService.update` expects (BETA-34).
        const userData = withDomainBirthDate(body) as UserUpdateInput;

        // Fetch previous user state for permission change audit
        const prevResult = await userService.getById(actor, id as string);
        const previousUser = prevResult.data;

        const result = await userService.update(actor, id as string, userData);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Audit role changes. Permissions are NOT auditable here: they have no
        // column on `users` and are not writable through the generic update
        // schema — the canonical path is PermissionService / the dedicated
        // `/admin/users/:id/permissions` endpoint.
        if (result.data && previousUser) {
            if (userData.role !== undefined && userData.role !== previousUser.role) {
                auditLog({
                    auditEvent: AuditEventType.PERMISSION_CHANGE,
                    actorId: actor.id,
                    targetUserId: id as string,
                    changeType: 'role_assignment',
                    oldValue: previousUser.role,
                    newValue: userData.role
                });
            }
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    }
});
