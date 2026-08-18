/**
 * @file auth-deleted-user-guard.ts
 *
 * The single authoritative answer to "is this account deleted?", shared by every
 * gate that has to refuse a soft-deleted user (H-163).
 *
 * ## Why this exists
 *
 * Deleting an account from the admin panel writes `users.deleted_at` and nothing
 * else — `BaseModel.softDelete` only sets `deleted_at`/`updated_at`. The FK from
 * `session` and `account` to `users` is declared `onDelete: 'cascade'`, which
 * makes the schema LOOK like it handles this, but a cascade only fires on a
 * physical DELETE. A soft delete never triggers it, so the credential row and
 * every live session survive untouched.
 *
 * Nothing downstream compensated: Better Auth's `drizzleAdapter` reads the
 * `users` table raw with no soft-delete filter, and `actorMiddleware` builds the
 * actor from the session user without ever consulting `deleted_at`. The result,
 * measured in production on 2026-08-15, was a deleted account signing in anew
 * and writing to the database fifteen minutes after being deleted.
 *
 * ## Why it reads the database every time
 *
 * `session.cookieCache` is enabled (`COOKIE_CACHE_MAX_AGE = 5 * 60`), so the
 * session user object may be reconstructed from a signed cookie without touching
 * Postgres. Exposing `deletedAt` as a Better Auth `additionalField` and checking
 * it in memory would therefore answer from a snapshot up to five minutes stale —
 * a window in which a just-deleted account still authenticates. That is the same
 * staleness trap `apps/api/src/lib/auth.ts` documents for the role set when it
 * rejects the `customSession` plugin. The lookup here is a primary-key read, and
 * an authenticated request already performs an uncached `user_role` query in
 * `actorMiddleware`, so it adds no round-trip the request was not already paying.
 */

import { eq, getDb, users } from '@repo/db';

/**
 * Reports whether an account must be refused access.
 *
 * Answers `true` for a soft-deleted account AND for one whose row is absent
 * entirely, so a session pointing at a hard-deleted user is refused too.
 *
 * Failure is never swallowed: a database error propagates rather than resolving
 * to `false`, so an outage cannot be mistaken for "this account is fine". Every
 * caller is expected to treat a throw as "refuse the session".
 *
 * @param params - Receive-object payload.
 * @param params.userId - The account id carried by the session being validated.
 * @returns `true` when the account is soft-deleted or missing, `false` when live.
 * @throws Whatever the database driver raises; callers must fail closed.
 */
export const isUserSoftDeleted = async (params: { userId: string }): Promise<boolean> => {
    const { userId } = params;

    // The table reference is resolved INSIDE the function on purpose. Reading a
    // `@repo/db` column at module scope makes every test that boots the app fail
    // at import time, before a single assertion runs.
    const rows = await getDb()
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    const row = rows[0];
    if (!row) {
        return true;
    }

    return row.deletedAt !== null && row.deletedAt !== undefined;
};
