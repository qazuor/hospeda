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
    RUserPermissionModel: vi.fn(function () {
        return { findAll: findAllMock };
    })
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

        // TEST:M1674:1 — a failed read must never degrade to "no overrides":
        // that would drop the deny overrides and fail OPEN (HOS-1674).
        it('rethrows the original error when the query fails (fails closed)', async () => {
            // Arrange
            const failure = new Error('db down');
            findAllMock.mockRejectedValue(failure);

            // Act + Assert
            await expect(getUserPermissionsWithEffect({ userId: 'u4' })).rejects.toThrow(failure);
            await expect(getUserPermissions({ userId: 'u4' })).rejects.toThrow(failure);
        });

        // TEST:M1674:2 (a) — an error is never cached.
        it('does not cache a failed read: the next call re-queries and caches its success', async () => {
            // Arrange
            findAllMock.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({
                items: [{ permission: PermissionEnum.USER_DELETE, effect: 'deny' }]
            });

            // Act
            await expect(getUserPermissionsWithEffect({ userId: 'u7' })).rejects.toThrow('db down');
            const second = await getUserPermissionsWithEffect({ userId: 'u7' });
            const third = await getUserPermissionsWithEffect({ userId: 'u7' });

            // Assert
            expect(second).toEqual({ grants: [], denies: [PermissionEnum.USER_DELETE] });
            expect(third).toEqual(second);
            expect(findAllMock).toHaveBeenCalledTimes(2);
        });

        // TEST:M1674:2 (b) — concurrent callers sharing the pending read all reject,
        // and the deduplication map is left clean.
        it('rejects every concurrent caller of a failed read and does not poison deduplication', async () => {
            // Arrange
            findAllMock.mockRejectedValueOnce(new Error('db down'));

            // Act
            const results = await Promise.allSettled([
                getUserPermissionsWithEffect({ userId: 'u8' }),
                getUserPermissionsWithEffect({ userId: 'u8' })
            ]);

            // Assert
            expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
            expect(findAllMock).toHaveBeenCalledTimes(1);

            findAllMock.mockResolvedValueOnce({
                items: [{ permission: PermissionEnum.USER_DELETE, effect: 'deny' }]
            });
            const after = await getUserPermissionsWithEffect({ userId: 'u8' });
            expect(after.denies).toEqual([PermissionEnum.USER_DELETE]);
            expect(findAllMock).toHaveBeenCalledTimes(2);
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
