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

        const result = await userService.update(actor, id as string, userData);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // HOS-296: no role audit here any more — see the equivalent note in
        // `patch.ts`. `role` is not a field on `UserUpdateInputSchema`, so this
        // route cannot change one; the grant/revoke endpoints own that
        // transition and write `user_role_audit` rows themselves.

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    }
});
