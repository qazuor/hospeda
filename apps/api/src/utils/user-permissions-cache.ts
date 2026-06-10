/**
 * User-specific permissions cache.
 *
 * Resolves individual permission overrides assigned directly to a user via the
 * `user_permission` table. Each override carries an `effect` (`grant` | `deny`):
 * a `grant` adds the permission on top of the user's role, a `deny` subtracts a
 * role-granted permission from that single user (SPEC-170).
 *
 * Results are cached in-memory with a shorter TTL than role permissions since
 * user-level overrides change more frequently.
 *
 * NOTE (multi-instance caveat): this cache is process-local. If the API is ever
 * scaled horizontally, invalidating one instance does not invalidate the others;
 * each instance's entry self-heals within `CACHE_TTL_MS`. The platform runs a
 * single instance per tier today, so this is theoretical. A Redis-backed cache
 * would remove the caveat entirely.
 *
 * @module user-permissions-cache
 */

import { RUserPermissionModel } from '@repo/db';
import { type PermissionEffect, PermissionEffectEnum, type PermissionEnum } from '@repo/schemas';
import { apiLogger } from './logger';

/** How long cached user permissions remain valid (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum page size to fetch all permissions for a user in one query. */
const MAX_PERMISSIONS_PAGE_SIZE = 500;

/**
 * A user's direct permission overrides split by effect, ready for the
 * `(role ∪ grants) \ denies` resolution in `actor.ts`.
 */
export interface UserPermissionsWithEffect {
    readonly grants: readonly PermissionEnum[];
    readonly denies: readonly PermissionEnum[];
}

interface CachedUserPermissions {
    readonly value: UserPermissionsWithEffect;
    readonly timestamp: number;
}

const cache = new Map<string, CachedUserPermissions>();
const pendingQueries = new Map<string, Promise<UserPermissionsWithEffect>>();

const userPermissionModel = new RUserPermissionModel();

/**
 * Get a user's direct permission overrides split into `grants` and `denies`.
 * Uses an in-memory cache with TTL to avoid repeated DB queries.
 *
 * @param params - Parameters object
 * @param params.userId - The user ID to look up overrides for
 * @returns The user's grant and deny overrides
 */
export async function getUserPermissionsWithEffect({
    userId
}: {
    readonly userId: string;
}): Promise<UserPermissionsWithEffect> {
    // Check cache first
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }

    // Deduplicate concurrent queries for the same user
    const pending = pendingQueries.get(userId);
    if (pending) {
        return pending;
    }

    const queryPromise = queryUserPermissionsWithEffect({ userId });
    pendingQueries.set(userId, queryPromise);

    try {
        const value = await queryPromise;

        cache.set(userId, {
            value,
            timestamp: Date.now()
        });

        apiLogger.debug(
            `User permission overrides loaded for ${userId}: ${value.grants.length} grant(s), ${value.denies.length} deny(s)`
        );

        return value;
    } catch (error) {
        apiLogger.error(
            `Failed to load permission overrides for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
        );
        return { grants: [], denies: [] };
    } finally {
        pendingQueries.delete(userId);
    }
}

/**
 * Get all permissions assigned directly to a user (the `grant` overrides only).
 *
 * Backward-compatible wrapper around {@link getUserPermissionsWithEffect}.
 * Pre-SPEC-170 every `user_permission` row was an additive grant, so returning
 * the grant set preserves the original semantics. `deny` overrides are NOT
 * included here — they subtract role permissions and are applied in `actor.ts`.
 *
 * @param params - Parameters object
 * @param params.userId - The user ID to look up permissions for
 * @returns Array of PermissionEnum values granted directly to the user
 */
export async function getUserPermissions({
    userId
}: {
    readonly userId: string;
}): Promise<PermissionEnum[]> {
    const { grants } = await getUserPermissionsWithEffect({ userId });
    return [...grants];
}

/**
 * Query a user's permission overrides from the database, split by effect.
 */
async function queryUserPermissionsWithEffect({
    userId
}: {
    readonly userId: string;
}): Promise<UserPermissionsWithEffect> {
    const result = await userPermissionModel.findAll(
        { userId },
        { page: 1, pageSize: MAX_PERMISSIONS_PAGE_SIZE }
    );

    const grants: PermissionEnum[] = [];
    const denies: PermissionEnum[] = [];

    for (const item of result.items) {
        // TYPE-WORKAROUND: userPermissionModel.findAll returns the base row shape; the
        // `permission` and `effect` columns are projected by the model query. Cast to
        // extract the typed enum values.
        const row = item as unknown as { permission: PermissionEnum; effect: PermissionEffect };
        if (row.effect === PermissionEffectEnum.DENY) {
            denies.push(row.permission);
        } else {
            grants.push(row.permission);
        }
    }

    return { grants, denies };
}

/**
 * Invalidate cached permissions for a specific user or all users.
 * Call this when user-permission assignments are updated.
 *
 * @param params - Optional parameters object
 * @param params.userId - Optional user ID to invalidate. If omitted, clears entire cache.
 */
export function invalidateUserPermissionsCache(params?: {
    readonly userId?: string;
}): void {
    if (params?.userId) {
        cache.delete(params.userId);
        apiLogger.debug(`User permissions cache invalidated for ${params.userId}`);
    } else {
        cache.clear();
        apiLogger.debug('User permissions cache fully cleared');
    }
}

/**
 * Destroy the user permissions cache entirely.
 * Clears both the results cache and any pending query promises.
 * Call this during graceful shutdown to release resources.
 */
export function destroyUserPermissionsCache(): void {
    cache.clear();
    pendingQueries.clear();
    apiLogger.debug('User permissions cache destroyed');
}
