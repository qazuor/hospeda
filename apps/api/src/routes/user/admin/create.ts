/**
 * Admin create user endpoint
 * Allows admins to create new users
 */
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    RoleGrantReason,
    UserAdminSchema,
    type UserCreateInput,
    UserCreateInputSchema,
    VisibilityEnum
} from '@repo/schemas';
import { grantRole, ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * POST /api/v1/admin/users
 * Create user - Admin endpoint
 */
export const adminCreateUserRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create user',
    description: 'Creates a new user. Admin only.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_CREATE],
    requestBody: UserCreateInputSchema,
    responseSchema: UserAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const userData = body as UserCreateInput;
        const actor = getActorFromContext(ctx);

        // HOS-296: `role` is NOT part of the create payload any more. It never
        // was an update here — `UserService.create` reaches the DB as an INSERT
        // through `BaseCrudService.create`, so the role rode along as a column
        // value. With `users.role` gone there is no column to ride, and the hat
        // has to be granted once the row exists and has an id.
        const result = await userService.create(actor, {
            email: userData.email,
            emailVerified: userData.emailVerified ?? false,
            firstName: userData.firstName,
            lastName: userData.lastName,
            displayName: userData.displayName,
            permissions: [],
            slug: userData.slug || '', // Use provided slug or let the service auto-generate
            lifecycleState: userData.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
            visibility: userData.visibility ?? VisibilityEnum.PUBLIC
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Every account holds at least one hat, and an admin-created one has no
        // signup hook to give it the baseline. Granting `USER` here is what
        // keeps `revokeRole`'s "never strand an account with zero roles" guard
        // (AC-5) meaningful for accounts born in the admin panel. Additional
        // hats are granted through the dedicated role endpoints.
        const createdUserId = result.data?.id;
        if (createdUserId) {
            const granted = await grantRole({
                userId: createdUserId,
                role: RoleEnum.USER,
                grantedBy: actor.id,
                reason: RoleGrantReason.ADMIN_USER_CREATED
            });
            if (granted.error) {
                throw new ServiceError(granted.error.code, granted.error.message);
            }
        }

        // Audit log: admin created a new user account (PII-sensitive operation)
        auditLog({
            auditEvent: AuditEventType.USER_ADMIN_MUTATION,
            actorId: actor.id,
            targetUserId: result.data?.id ?? '',
            operation: 'create'
        });

        return result.data;
    }
});
