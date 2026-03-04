/**
 * User-specific permissions cache.
 *
 * Resolves individual permissions assigned directly to a user via the
 * `user_permission` table. Results are cached in-memory with a shorter TTL
 * than role permissions since user-level overrides change more frequently.
 *
 * @module user-permissions-cache
 */

import { RUserPermissionModel } from '@repo/db';
import type { PermissionEnum } from '@repo/schemas';
import { apiLogger } from './logger';

/** How long cached user permissions remain valid (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum page size to fetch all permissions for a user in one query. */
const MAX_PERMISSIONS_PAGE_SIZE = 500;

interface CachedUserPermissions {
    readonly permissions: PermissionEnum[];
    readonly timestamp: number;
}

const cache = new Map<string, CachedUserPermissions>();
const pendingQueries = new Map<string, Promise<PermissionEnum[]>>();

const userPermissionModel = new RUserPermissionModel();

/**
 * Get all permissions assigned directly to a user.
 * Uses an in-memory cache with TTL to avoid repeated DB queries.
 *
 * @param params - Parameters object
 * @param params.userId - The user ID to look up permissions for
 * @returns Array of PermissionEnum values assigned to the user
 */
export async function getUserPermissions({
    userId
}: {
    readonly userId: string;
}): Promise<PermissionEnum[]> {
    // Check cache first
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.permissions;
    }

    // Deduplicate concurrent queries for the same user
    const pending = pendingQueries.get(userId);
    if (pending) {
        return pending;
    }

    const queryPromise = queryUserPermissions({ userId });
    pendingQueries.set(userId, queryPromise);

    try {
        const permissions = await queryPromise;

        cache.set(userId, {
            permissions,
            timestamp: Date.now()
        });

        apiLogger.debug(`User permissions loaded for ${userId}: ${permissions.length} permissions`);

        return permissions;
    } catch (error) {
        apiLogger.error(
            `Failed to load permissions for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
    } finally {
        pendingQueries.delete(userId);
    }
}

/**
 * Query user permissions from the database.
 */
async function queryUserPermissions({
    userId
}: {
    readonly userId: string;
}): Promise<PermissionEnum[]> {
    const result = await userPermissionModel.findAll(
        { userId },
        { page: 1, pageSize: MAX_PERMISSIONS_PAGE_SIZE }
    );

    return result.items.map((up) => (up as unknown as { permission: PermissionEnum }).permission);
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
