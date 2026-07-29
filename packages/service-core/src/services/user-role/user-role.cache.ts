/**
 * Process-local cache for a user's set of held roles (HOS-296).
 *
 * ## Why this exists
 *
 * `users.role` used to ride on the Better Auth session, so the actor
 * middleware got the role for free on every request. It now lives in
 * `user_role`, and the middleware is global — without a cache every
 * authenticated request, on every route including public ones, pays an extra
 * `SELECT`. Its two sibling reads in that same middleware
 * (`role-permissions-cache`, `user-permissions-cache`) are both cached; this
 * closes the gap.
 *
 * ## Why the TTL is SHORT (60s, not the permission cache's 10 minutes)
 *
 * Stale roles after a grant is exactly the failure mode that ruled out Better
 * Auth's `customSession` for this change: a role set baked into a long-lived
 * artefact means an operator's grant does not take effect until that artefact
 * expires. The cache is therefore explicitly invalidated by `grantRole` and
 * `revokeRole` themselves — every writer goes through one of those two — and
 * the TTL is only a backstop for writes this process did not perform.
 *
 * ## Multi-instance caveat
 *
 * The cache is per-process, like `user-permissions-cache` in `apps/api`. If the
 * API is scaled horizontally, a grant served by instance A does NOT invalidate
 * instance B's entry; B self-heals within {@link USER_ROLES_CACHE_TTL_MS}. That
 * bounded window is the entire reason the TTL is one minute rather than ten.
 * A shared (Redis-backed) cache would remove the caveat; the platform runs a
 * single instance per tier today.
 *
 * Transaction reads (`ctx.tx`) never touch this cache — neither reading from it
 * nor writing to it — because a value read inside a transaction may be rolled
 * back and must never outlive it.
 *
 * @module services/user-role/user-role.cache
 */

import type { RoleEnum } from '@repo/schemas';

/** How long a cached role set stays valid. Deliberately short — see module doc. */
export const USER_ROLES_CACHE_TTL_MS = 60 * 1000;

interface CachedUserRoles {
    readonly roles: readonly RoleEnum[];
    readonly timestamp: number;
}

const cache = new Map<string, CachedUserRoles>();

/**
 * Reads a user's cached role set.
 *
 * @param params.userId - User whose hats to read.
 * @returns The cached set, or `undefined` when absent or expired.
 */
export const readCachedUserRoles = (params: {
    userId: string;
}): readonly RoleEnum[] | undefined => {
    const entry = cache.get(params.userId);
    if (!entry) {
        return undefined;
    }
    if (Date.now() - entry.timestamp >= USER_ROLES_CACHE_TTL_MS) {
        cache.delete(params.userId);
        return undefined;
    }
    return entry.roles;
};

/**
 * Stores a user's role set.
 *
 * @param params.userId - User whose hats were resolved.
 * @param params.roles - The resolved set.
 */
export const writeCachedUserRoles = (params: {
    userId: string;
    roles: readonly RoleEnum[];
}): void => {
    cache.set(params.userId, { roles: params.roles, timestamp: Date.now() });
};

/**
 * Drops the cached role set for one user, or the whole cache.
 *
 * Called by `grantRole` / `revokeRole` on every invocation — including the
 * idempotent no-op and the failed one. Dropping an entry only costs one extra
 * query; keeping a stale one costs an operator a minute of "the grant did
 * nothing".
 *
 * @param params.userId - User to invalidate. Omit to clear every entry.
 */
export const invalidateUserRolesCache = (params?: { userId?: string }): void => {
    if (params?.userId) {
        cache.delete(params.userId);
        return;
    }
    cache.clear();
};
