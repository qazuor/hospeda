/**
 * Unit tests for the role-permissions cache (HOS-296).
 *
 * `getPermissionsForRole(role)` became `getPermissionsForRoles({ roles })`,
 * returning the UNION over every hat the actor wears. Two properties matter and
 * neither is visible from the actor middleware's own tests:
 *
 * 1. **The union is real** — one DB query per distinct role, results merged and
 *    de-duplicated.
 * 2. **The cache key is order-independent** — `[HOST, USER]` and
 *    `[USER, HOST]` are the same set and must resolve to the SAME entry.
 *    An unsorted key would store the identical permission union once per
 *    ordering, which is both a memory leak and a source of confusing
 *    cache-hit-rate behaviour.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findAllMock } = vi.hoisted(() => ({ findAllMock: vi.fn() }));

vi.mock('@repo/db', () => ({
    RRolePermissionModel: vi.fn(function () {
        return { findAll: findAllMock };
    })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import {
    getPermissionsForRoles,
    invalidateRolePermissionsCache
} from '../../src/utils/role-permissions-cache';

/** Per-role permission fixtures, deliberately overlapping on `ACCESS_API_PUBLIC`. */
const PERMISSIONS_BY_ROLE: Record<string, PermissionEnum[]> = {
    [RoleEnum.USER]: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.USER_UPDATE_PROFILE],
    [RoleEnum.HOST]: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCOMMODATION_CREATE],
    [RoleEnum.COMMERCE_OWNER]: [PermissionEnum.COMMERCE_EDIT_OWN]
};

describe('role-permissions-cache — getPermissionsForRoles (HOS-296)', () => {
    beforeEach(() => {
        invalidateRolePermissionsCache();
        findAllMock.mockReset();
        findAllMock.mockImplementation(async (filter: { role: string }) => ({
            items: (PERMISSIONS_BY_ROLE[filter.role] ?? []).map((permission) => ({ permission }))
        }));
    });

    it('returns the union of every held role, de-duplicated', async () => {
        const permissions = await getPermissionsForRoles({
            roles: [RoleEnum.USER, RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]
        });

        expect([...permissions].sort()).toEqual(
            [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.USER_UPDATE_PROFILE,
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.COMMERCE_EDIT_OWN
            ].sort()
        );
        // ACCESS_API_PUBLIC comes from two roles and must appear exactly once.
        expect(permissions.filter((p) => p === PermissionEnum.ACCESS_API_PUBLIC)).toHaveLength(1);
    });

    it('queries the DB once per DISTINCT role', async () => {
        await getPermissionsForRoles({ roles: [RoleEnum.USER, RoleEnum.HOST, RoleEnum.USER] });

        expect(findAllMock).toHaveBeenCalledTimes(2);
    });

    it('treats [HOST, USER] and [USER, HOST] as the SAME cache entry', async () => {
        const first = await getPermissionsForRoles({ roles: [RoleEnum.HOST, RoleEnum.USER] });
        const callsAfterFirst = findAllMock.mock.calls.length;

        const second = await getPermissionsForRoles({ roles: [RoleEnum.USER, RoleEnum.HOST] });

        // No further DB work: the reversed order hit the same entry.
        expect(findAllMock).toHaveBeenCalledTimes(callsAfterFirst);
        expect([...second].sort()).toEqual([...first].sort());
    });

    it('ignores duplicate roles when building the cache key', async () => {
        const first = await getPermissionsForRoles({ roles: [RoleEnum.HOST, RoleEnum.USER] });
        const callsAfterFirst = findAllMock.mock.calls.length;

        const second = await getPermissionsForRoles({
            roles: [RoleEnum.USER, RoleEnum.HOST, RoleEnum.USER, RoleEnum.HOST]
        });

        expect(findAllMock).toHaveBeenCalledTimes(callsAfterFirst);
        expect([...second].sort()).toEqual([...first].sort());
    });

    it('returns an empty set for an empty role list without touching the DB', async () => {
        const permissions = await getPermissionsForRoles({ roles: [] });

        expect(permissions).toEqual([]);
        expect(findAllMock).not.toHaveBeenCalled();
    });

    it('invalidating one role also drops the cached unions that contained it', async () => {
        await getPermissionsForRoles({ roles: [RoleEnum.HOST, RoleEnum.USER] });
        const callsAfterFirst = findAllMock.mock.calls.length;

        invalidateRolePermissionsCache(RoleEnum.HOST);
        await getPermissionsForRoles({ roles: [RoleEnum.HOST, RoleEnum.USER] });

        // HOST is re-queried; USER is still cached per-role, so exactly one more call.
        expect(findAllMock).toHaveBeenCalledTimes(callsAfterFirst + 1);
    });

    it('falls back to an empty permission list when a role query fails', async () => {
        findAllMock.mockRejectedValueOnce(new Error('db down'));

        const permissions = await getPermissionsForRoles({ roles: [RoleEnum.HOST] });

        expect(permissions).toEqual([]);
    });
});
