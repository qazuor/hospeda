/**
 * Baseline role grant for a freshly created account (HOS-296).
 *
 * Extracted from the `betterAuth()` call in `auth.ts` for the same reason
 * `auth-signup-analytics.ts` was: the `databaseHooks.user.create.after` hook
 * lives inside that call and cannot be imported, so anything with a real
 * failure path has to live beside it to be testable.
 *
 * @module lib/auth-signup-baseline-role
 */

import { eq, getDb, users } from '@repo/db';
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { grantRole } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/**
 * Grants the baseline `USER` hat to a just-created account, deleting the
 * account when the grant fails.
 *
 * An account with zero hats resolves to zero permissions: it can sign in and
 * then do nothing, with no error anywhere but a log line. So the grant is the
 * one step of the signup hook that is NOT swallowed.
 *
 * **The compensating delete is the point.** `user.create.after` runs after the
 * `users` row is committed, so throwing does not roll it back — the caller
 * gets a 500 while the email stays taken and cannot be re-registered. Removing
 * the row first turns that into a clean, retryable failure, mirroring
 * `routes/auth/signup-as-host.ts`. Log-and-continue was rejected: it would lean
 * on `actorMiddleware`'s `[USER]` fallback, which exists as a data-integrity
 * siren (it warns on every single request) and not as a supported steady state,
 * and would leave an account with no `user_role` rows for an operator to see.
 *
 * A failed cleanup is logged and swallowed so the original error — the one that
 * explains what actually went wrong — is what propagates.
 *
 * @param params.userId - Id of the freshly inserted user.
 * @param params.email - Email, for the log lines only.
 * @throws {Error} The grant's error, after the account has been removed.
 *
 * @example
 * ```ts
 * after: async (user) => {
 *     await grantBaselineUserRole({ userId: user.id, email: user.email });
 * }
 * ```
 */
export const grantBaselineUserRole = async (params: {
    userId: string;
    email: string;
}): Promise<void> => {
    const { userId, email } = params;

    const granted = await grantRole({
        userId,
        role: RoleEnum.USER,
        grantedBy: null,
        reason: RoleGrantReason.SIGNUP
    });

    if (!granted.error) {
        return;
    }

    apiLogger.error(
        `Failed to grant the baseline USER role on signup (userId=${userId}, email=${email}): ${granted.error.message}. Deleting the freshly created account so the address can be re-registered.`
    );

    try {
        await getDb().delete(users).where(eq(users.id, userId));
    } catch (cleanupError) {
        apiLogger.error(
            `Signup cleanup DELETE also failed (userId=${userId}, email=${email}): ${
                cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            }. The account exists holding no roles and needs manual intervention.`
        );
    }

    throw granted.error;
};
