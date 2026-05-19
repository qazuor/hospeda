/**
 * @route GET /api/v1/protected/profile/status
 *
 * Profile status endpoint (SPEC-113 T-113-06).
 *
 * Returns the two profile-completion flags plus account-type information for
 * the authenticated user.  The web middleware calls this in parallel with the
 * session check on every protected route so it can decide whether to redirect
 * the user to `completar-perfil/` or `agregar-contrasena/`.
 *
 * Deliberately returns only the minimum flags needed by the middleware — it is
 * NOT a full user profile endpoint.
 */

import { z } from '@hono/zod-openapi';
import { accounts, eq, getDb, users as usersTable } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Response schema for the profile status endpoint. */
const ProfileStatusResponseSchema = z.object({
    /** Whether the user has submitted the profile completion form. */
    profileCompleted: z.boolean(),
    /**
     * Whether the user has already been prompted to set a password
     * (either submitted or skipped the set-password screen).
     */
    setPasswordPrompted: z.boolean(),
    /** True when the user has at least one OAuth account (google / facebook). */
    hasOAuthAccount: z.boolean(),
    /** True when the user has a credential (email/password) account row. */
    hasCredentialAccount: z.boolean()
});

/** TypeScript type for the profile status response. */
export type ProfileStatusResponse = z.infer<typeof ProfileStatusResponseSchema>;

/**
 * GET /api/v1/protected/profile/status
 *
 * Returns profile completion flags and account-type info for the authenticated
 * user.  Runs two DB queries in parallel for efficiency.
 */
export const profileStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/status',
    summary: 'Get profile completion status for the authenticated user',
    description:
        'Returns profileCompleted, setPasswordPrompted, hasOAuthAccount, and hasCredentialAccount flags. Used by the web middleware to decide whether to redirect to the completion or set-password screens.',
    tags: ['Profile'],
    responseSchema: ProfileStatusResponseSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);
        const db = getDb();

        // Run user-row lookup and accounts lookup in parallel.
        const [userRows, userAccounts] = await Promise.all([
            db
                .select({
                    profileCompleted: usersTable.profileCompleted,
                    setPasswordPrompted: usersTable.setPasswordPrompted
                })
                .from(usersTable)
                .where(eq(usersTable.id, actor.id))
                .limit(1),
            db
                .select({ providerId: accounts.providerId })
                .from(accounts)
                .where(eq(accounts.userId, actor.id))
        ]);

        const userRow = userRows[0];
        if (!userRow) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
        }

        const hasOAuthAccount = userAccounts.some((a) =>
            ['google', 'facebook'].includes(a.providerId)
        );
        const hasCredentialAccount = userAccounts.some((a) => a.providerId === 'credential');

        return {
            profileCompleted: userRow.profileCompleted ?? false,
            setPasswordPrompted: userRow.setPasswordPrompted ?? false,
            hasOAuthAccount,
            hasCredentialAccount
        };
    }
});
