/**
 * Role-to-permissions cache.
 *
 * Resolves permissions for a SET of roles (HOS-296) by querying the
 * `role_permission` table once per distinct role and returning the union.
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

/**
 * Per-single-role cache. Keyed by the role value itself.
 *
 * Deliberately keyed per ROLE and not per role SET: the number of distinct
 * roles is bounded by `RoleEnum` (single digits) while the number of distinct
 * role COMBINATIONS grows as its power set, so a per-set cache would both blow
 * up in size and re-query roles it had already resolved under another
 * combination. The union is recomposed per call from these entries, which is a
 * few set inserts.
 */
const cache = new Map<string, CachedRolePermissions>();
const pendingQueries = new Map<string, Promise<PermissionEnum[]>>();

const rolePermissionModel = new RRolePermissionModel();

/**
 * Build the canonical cache key for a set of roles.
 *
 * Sorted and de-duplicated so `[HOST, USER]` and `[USER, HOST, USER]` resolve
 * to the SAME entry — an unsorted key would store the identical permission
 * union under as many entries as there are orderings of the set.
 *
 * Exported for the union-cache below and for tests that assert key stability.
 *
 * @param roles - The roles held by the actor, in any order, with any duplicates.
 * @returns A stable, order-independent key.
 */
const buildRoleSetKey = (roles: readonly RoleEnum[]): string =>
    Array.from(new Set(roles)).sort().join('|');

/**
 * Union cache, keyed by the sorted role-set key.
 *
 * Layered ON TOP of the per-role cache purely to skip re-computing the union
 * on every request for the (very few) role combinations a deployment actually
 * sees. It shares the same TTL, and a miss falls through to the per-role
 * entries, so it can never serve a permission set the per-role cache would not
 * have produced.
 */
const unionCache = new Map<string, CachedRolePermissions>();

/**
 * Get all permissions assigned to a single role.
 * Uses an in-memory cache with TTL to avoid repeated DB queries.
 *
 * @param role - The role to look up permissions for
 * @returns Array of PermissionEnum values assigned to the role
 */
async function getPermissionsForSingleRole(role: RoleEnum): Promise<PermissionEnum[]> {
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
 * Get the UNION of the permissions assigned to every role in the set (HOS-296).
 *
 * A user now wears several hats at once, so their role-derived permissions are
 * the union over the held roles — never the permissions of one "primary" role.
 * The result is cached under a sorted, de-duplicated key so role order at the
 * call site is irrelevant.
 *
 * @param params.roles - Every role the actor holds. An empty array yields an
 *   empty permission set (the caller decides whether that is an error).
 * @returns Array of distinct PermissionEnum values granted by any of the roles.
 *
 * @example
 * ```ts
 * const perms = await getPermissionsForRoles({ roles: [RoleEnum.HOST, RoleEnum.COMMERCE_OWNER] });
 * ```
 */
export async function getPermissionsForRoles(params: {
    roles: readonly RoleEnum[];
}): Promise<PermissionEnum[]> {
    const { roles } = params;
    const distinctRoles = Array.from(new Set(roles));

    if (distinctRoles.length === 0) {
        return [];
    }

    const key = buildRoleSetKey(distinctRoles);
    const cachedUnion = unionCache.get(key);
    if (cachedUnion && Date.now() - cachedUnion.timestamp < CACHE_TTL_MS) {
        return cachedUnion.permissions;
    }

    const perRole = await Promise.all(
        distinctRoles.map((role) => getPermissionsForSingleRole(role))
    );

    const union = new Set<PermissionEnum>();
    for (const permissions of perRole) {
        for (const permission of permissions) {
            union.add(permission);
        }
    }

    const permissions = Array.from(union);
    unionCache.set(key, { permissions, timestamp: Date.now() });

    return permissions;
}

/**
 * Query role permissions from the database.
 */
async function queryRolePermissions(role: RoleEnum): Promise<PermissionEnum[]> {
    const result = await rolePermissionModel.findAll(
        { role },
        { page: 1, pageSize: MAX_PERMISSIONS_PAGE_SIZE }
    );

    // TYPE-WORKAROUND: rolePermissionModel.findAll returns the base row shape but joined `permission` column is added by the model query; cast extracts the projected enum value.
    return result.items.map((rp) => (rp as unknown as { permission: PermissionEnum }).permission);
}

/**
 * Invalidate cached permissions for a specific role or all roles.
 * Call this when role-permission mappings are updated.
 *
 * Invalidating ONE role also clears the whole union cache: any cached union
 * that included that role is now stale, and the union keys are cheap to
 * rebuild, so a targeted sweep would cost more than it saves.
 *
 * @param role - Optional role to invalidate. If omitted, clears entire cache.
 */
export function invalidateRolePermissionsCache(role?: RoleEnum): void {
    unionCache.clear();
    if (role) {
        cache.delete(role);
        apiLogger.debug(`Role permissions cache invalidated for ${role}`);
    } else {
        cache.clear();
        apiLogger.debug('Role permissions cache fully cleared');
    }
}
