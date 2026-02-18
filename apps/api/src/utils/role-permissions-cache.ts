/**
 * Role-to-permissions cache.
 *
 * Resolves permissions for a given role by querying the `role_permission` table.
 * Results are cached in-memory with a configurable TTL since role-permission
 * mappings rarely change (only on re-seed or admin action).
 *
 * @module role-permissions-cache
 */

import { RRolePermissionModel } from '@repo/db';
import type { PermissionEnum, RoleEnum } from '@repo/schemas';
import { apiLogger } from './logger';

/** How long cached role permissions remain valid (10 minutes). */
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Maximum page size to fetch all permissions for a role in one query. */
const MAX_PERMISSIONS_PAGE_SIZE = 1000;

interface CachedRolePermissions {
    readonly permissions: PermissionEnum[];
    readonly timestamp: number;
}

const cache = new Map<string, CachedRolePermissions>();
const pendingQueries = new Map<string, Promise<PermissionEnum[]>>();

const rolePermissionModel = new RRolePermissionModel();

/**
 * Get all permissions assigned to a role.
 * Uses an in-memory cache with TTL to avoid repeated DB queries.
 *
 * @param role - The role to look up permissions for
 * @returns Array of PermissionEnum values assigned to the role
 */
export async function getPermissionsForRole(role: RoleEnum): Promise<PermissionEnum[]> {
    // Check cache first
    const cached = cache.get(role);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.permissions;
    }

    // Deduplicate concurrent queries for the same role
    const pending = pendingQueries.get(role);
    if (pending) {
        return pending;
    }

    const queryPromise = queryRolePermissions(role);
    pendingQueries.set(role, queryPromise);

    try {
        const permissions = await queryPromise;

        cache.set(role, {
            permissions,
            timestamp: Date.now()
        });

        apiLogger.debug(`Role permissions loaded for ${role}: ${permissions.length} permissions`);

        return permissions;
    } catch (error) {
        apiLogger.error(
            `Failed to load permissions for role ${role}: ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
    } finally {
        pendingQueries.delete(role);
    }
}

/**
 * Query role permissions from the database.
 */
async function queryRolePermissions(role: RoleEnum): Promise<PermissionEnum[]> {
    const result = await rolePermissionModel.findAll(
        { role },
        { page: 1, pageSize: MAX_PERMISSIONS_PAGE_SIZE }
    );

    return result.items.map((rp) => (rp as unknown as { permission: PermissionEnum }).permission);
}

/**
 * Invalidate cached permissions for a specific role or all roles.
 * Call this when role-permission mappings are updated.
 *
 * @param role - Optional role to invalidate. If omitted, clears entire cache.
 */
export function invalidateRolePermissionsCache(role?: RoleEnum): void {
    if (role) {
        cache.delete(role);
        apiLogger.debug(`Role permissions cache invalidated for ${role}`);
    } else {
        cache.clear();
        apiLogger.debug('Role permissions cache fully cleared');
    }
}
