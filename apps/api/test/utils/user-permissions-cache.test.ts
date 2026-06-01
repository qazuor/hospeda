/**
 * Unit tests for the user-permissions cache (SPEC-170).
 *
 * Verifies that `getUserPermissionsWithEffect` splits `user_permission` rows
 * into grant/deny buckets, that the backward-compatible `getUserPermissions`
 * returns only the grant overrides, and that caching/error handling behave.
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findAllMock } = vi.hoisted(() => ({ findAllMock: vi.fn() }));

vi.mock('@repo/db', () => ({
    RUserPermissionModel: vi.fn(() => ({ findAll: findAllMock }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import {
    destroyUserPermissionsCache,
    getUserPermissions,
    getUserPermissionsWithEffect
} from '../../src/utils/user-permissions-cache';

describe('user-permissions-cache (SPEC-170)', () => {
    beforeEach(() => {
        findAllMock.mockReset();
        destroyUserPermissionsCache();
    });

    describe('getUserPermissionsWithEffect', () => {
        it('splits rows into grants and denies by effect', async () => {
            findAllMock.mockResolvedValue({
                items: [
                    { permission: PermissionEnum.USER_CREATE, effect: 'grant' },
                    { permission: PermissionEnum.USER_DELETE, effect: 'deny' }
                ]
            });

            const result = await getUserPermissionsWithEffect({ userId: 'u1' });

            expect(result.grants).toEqual([PermissionEnum.USER_CREATE]);
            expect(result.denies).toEqual([PermissionEnum.USER_DELETE]);
        });

        it('returns empty arrays when the user has no overrides', async () => {
            findAllMock.mockResolvedValue({ items: [] });

            const result = await getUserPermissionsWithEffect({ userId: 'u2' });

            expect(result).toEqual({ grants: [], denies: [] });
        });

        it('treats rows with a grant effect as grants', async () => {
            findAllMock.mockResolvedValue({
                items: [{ permission: PermissionEnum.POST_CREATE, effect: 'grant' }]
            });

            const result = await getUserPermissionsWithEffect({ userId: 'u3' });

            expect(result.grants).toEqual([PermissionEnum.POST_CREATE]);
            expect(result.denies).toEqual([]);
        });

        it('returns empty arrays and does not throw when the query fails', async () => {
            findAllMock.mockRejectedValue(new Error('db down'));

            const result = await getUserPermissionsWithEffect({ userId: 'u4' });

            expect(result).toEqual({ grants: [], denies: [] });
        });

        it('caches the result so a second call does not re-query', async () => {
            findAllMock.mockResolvedValue({
                items: [{ permission: PermissionEnum.USER_CREATE, effect: 'grant' }]
            });

            await getUserPermissionsWithEffect({ userId: 'u5' });
            await getUserPermissionsWithEffect({ userId: 'u5' });

            expect(findAllMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('getUserPermissions (backward compat)', () => {
        it('returns only the grant overrides as a flat array', async () => {
            findAllMock.mockResolvedValue({
                items: [
                    { permission: PermissionEnum.USER_CREATE, effect: 'grant' },
                    { permission: PermissionEnum.USER_DELETE, effect: 'deny' }
                ]
            });

            const result = await getUserPermissions({ userId: 'u6' });

            expect(result).toEqual([PermissionEnum.USER_CREATE]);
        });
    });
});
