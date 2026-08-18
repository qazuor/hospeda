/**
 * @file user.session-revocation.ts
 *
 * Revokes the Better Auth sessions belonging to an account (H-163).
 *
 * ## Why this is not automatic
 *
 * `session.user_id` references `users.id` with `onDelete: 'cascade'`, so the
 * schema reads as though deleting an account disposes of its sessions. That
 * cascade only fires for a physical DELETE. Hospeda's admin panel performs a
 * SOFT delete — `BaseModel.softDelete` writes `deleted_at` and `updated_at` and
 * touches nothing else — so the cascade never runs and every session the account
 * holds stays valid until it expires on its own, up to seven days later.
 *
 * Measured in production on 2026-08-15: two accounts deleted from the panel both
 * retained live sessions, one good for another six days.
 *
 * ## Why the credential row is deliberately left alone
 *
 * Only `session` rows are removed. The `account` row — which carries the
 * password hash — is untouched, because a soft delete is reversible
 * (`UserService.restore`) and destroying the credential would leave a restored
 * account permanently unable to sign in. Refusing a deleted account at sign-in
 * is the job of the `session.create.before` gate in `apps/api/src/lib/auth.ts`,
 * which does not have to destroy anything to be effective.
 */

import { type DrizzleClient, eq, getDb, sessions } from '@repo/db';

/**
 * Deletes every session row belonging to one account.
 *
 * Always scoped to the single `userId` it is given: an unscoped delete here
 * would sign out every account on the platform.
 *
 * @param params - Receive-object payload.
 * @param params.userId - The account whose sessions are being revoked.
 * @param params.tx - Optional transaction, so the revocation commits or rolls
 *   back together with the delete that triggered it.
 * @returns The number of session rows removed.
 */
export const revokeUserSessions = async (params: {
    userId: string;
    tx?: DrizzleClient;
}): Promise<{ revokedCount: number }> => {
    const { userId, tx } = params;

    // Table references are resolved inside the function: reading a `@repo/db`
    // column at module scope breaks every test that boots the app at import
    // time, before a single assertion runs.
    const db = tx ?? getDb();
    const removed = await db.delete(sessions).where(eq(sessions.userId, userId));

    return { revokedCount: Array.isArray(removed) ? removed.length : 0 };
};
