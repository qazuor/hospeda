/**
 * Admin create user endpoint
 * Allows admins to create new users
 */
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    RoleGrantReason,
    ServiceErrorCode,
    UserAdminSchema,
    type UserCreateInput,
    UserCreateInputSchema,
    VisibilityEnum
} from '@repo/schemas';
import { grantRole, ServiceError, UserService, withServiceTransaction } from '@repo/service-core';
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
        //
        // Insert + grant share ONE transaction, so a failed grant rolls the
        // account back instead of leaving a zero-role user with the email
        // address taken (the same failure `auth-signup-baseline-role.ts` has to
        // compensate for with a DELETE — it cannot use a transaction because
        // Better Auth's `user.create.after` hook already runs post-commit; here
        // the route owns the whole unit of work, so a real boundary is both
        // available and strictly safer than a compensating write).
        //
        // Inside `withServiceTransaction`, both `userService.create` and
        // `grantRole` RE-THROW their errors rather than returning `{ error }`
        // (`ctx.tx` is set), which is exactly what triggers the rollback.
        const created = await withServiceTransaction(async (txCtx) => {
            const result = await userService.create(
                actor,
                {
                    email: userData.email,
                    emailVerified: userData.emailVerified ?? false,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    displayName: userData.displayName,
                    permissions: [],
                    slug: userData.slug || '', // Use provided slug or let the service auto-generate
                    lifecycleState: userData.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
                    visibility: userData.visibility ?? VisibilityEnum.PUBLIC,
                    // HOS-375: an admin creating an account through the panel is
                    // creating a person. System accounts come from the required
                    // seed fixtures and a data-migration, never from this route,
                    // so this is not exposed as an admin-settable field.
                    isSystemAccount: false
                },
                txCtx
            );

            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }

            const createdUserId = result.data?.id;
            if (!createdUserId) {
                // Never silently skip the grant: returning 200 here would hand
                // back an account that can sign in and hold no hat at all.
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'User was created without an id; cannot grant the baseline role.'
                );
            }

            // Every account holds at least one hat, and an admin-created one
            // has no signup hook to give it the baseline. Granting `USER` here
            // is what keeps `revokeRole`'s "never strand an account with zero
            // roles" guard (AC-5) meaningful for accounts born in the admin
            // panel. Additional hats are granted through the dedicated role
            // endpoints.
            const granted = await grantRole({
                userId: createdUserId,
                role: RoleEnum.USER,
                grantedBy: actor.id,
                reason: RoleGrantReason.ADMIN_USER_CREATED,
                ctx: txCtx
            });
            if (granted.error) {
                throw new ServiceError(granted.error.code, granted.error.message);
            }

            return result.data;
        });

        // Audit log: admin created a new user account (PII-sensitive operation).
        // Outside the transaction on purpose — it must only record a COMMITTED
        // creation.
        auditLog({
            auditEvent: AuditEventType.USER_ADMIN_MUTATION,
            actorId: actor.id,
            targetUserId: created?.id ?? '',
            operation: 'create'
        });

        return created;
    }
});
