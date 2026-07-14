/**
 * Admin patch user endpoint
 * Allows admins to partially update any user
 */
import {
    BirthDateHttpInputSchema,
    PermissionEnum,
    UserAdminSchema,
    UserIdSchema,
    UserPatchInputSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';
import { withDomainBirthDate } from '../../../utils/user-birth-date';
import { userCache } from '../../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

/**
 * Body schema for the admin PATCH route. Same as `UserPatchInputSchema`
 * except `birthDate` is overridden with `BirthDateHttpInputSchema` (BETA-34):
 * the domain `z.date()` field, left as-is, gets converted by the
 * route-factory's OpenAPI conversion into a full ISO-8601 datetime
 * validator that rejects the plain `YYYY-MM-DD` string every user write
 * client sends. See `BirthDateHttpInputSchema`'s JSDoc for the full
 * rationale.
 */
const UserAdminPatchInputSchema = UserPatchInputSchema.extend({
    birthDate: BirthDateHttpInputSchema
});

/**
 * PATCH /api/v1/admin/users/:id
 * Partial update user - Admin endpoint
 */
export const adminPatchUserRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update user (admin)',
    description: 'Updates specific fields of any user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.MANAGE_USERS],
    requestParams: { id: UserIdSchema },
    requestBody: UserAdminPatchInputSchema,
    responseSchema: UserAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Transform API input (string dates) to domain format (Date objects).
        // `birthDate` is NOT touched by transformApiInputToDomain (its
        // `YYYY-MM-DD` shape doesn't match the ISO-datetime detector), so it
        // is converted explicitly afterwards (BETA-34).
        const domainInput = withDomainBirthDate(transformApiInputToDomain(body));

        // Fetch previous user state for permission change audit
        const prevResult = await userService.getById(actor, id);
        const previousUser = prevResult.data;

        const result = await userService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Audit role changes. Permissions are NOT auditable here: they have no
        // column on `users` and are not writable through the generic update
        // schema — the canonical path is PermissionService / the dedicated
        // `/admin/users/:id/permissions` endpoint.
        if (result.data && previousUser) {
            const patchRole = domainInput.role as string | undefined;
            if (patchRole !== undefined && patchRole !== previousUser.role) {
                auditLog({
                    auditEvent: AuditEventType.PERMISSION_CHANGE,
                    actorId: actor.id,
                    targetUserId: id,
                    changeType: 'role_assignment',
                    oldValue: previousUser.role,
                    newValue: patchRole
                });
            }
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});
