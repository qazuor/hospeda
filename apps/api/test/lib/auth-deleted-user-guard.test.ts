/**
 * @file auth-deleted-user-guard.test.ts
 *
 * Regression tests for H-163 — "a deleted account keeps signing in and writing".
 *
 * Measured in production on 2026-08-15: an account was soft-deleted from the
 * admin panel (`users.deleted_at` set), yet a LATER sign-in succeeded and minted
 * a fresh 7-day session, `/auth/me` answered 200 with 25 permissions, and a
 * protected PATCH persisted to the row. Two symptoms, one absent invariant:
 * nothing in the auth pipeline ever consulted `users.deleted_at`.
 *
 * This file pins the authoritative predicate both gates are built on. It reads
 * the database on every call ON PURPOSE — `session.cookieCache` is enabled
 * (`COOKIE_CACHE_MAX_AGE = 5 * 60`), so the session user object can be served
 * from a signed cookie for up to five minutes after the row changed. A check
 * against that cached object would go stale exactly when it matters, which is
 * the same trap HOS-296 documents for the role set.
 */

import { describe, expect, it, vi } from 'vitest';

const { limitMock, whereMock, selectMock, getDbMock } = vi.hoisted(() => {
    const limit = vi.fn();
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return {
        limitMock: limit,
        whereMock: where,
        selectMock: select,
        getDbMock: vi.fn().mockReturnValue({ select })
    };
});

vi.mock('@repo/db', () => ({
    getDb: getDbMock,
    users: { id: 'users.id', deletedAt: 'users.deletedAt' },
    eq: (column: unknown, value: unknown) => ({ column, value })
}));

import { isUserSoftDeleted } from '../../src/lib/auth-deleted-user-guard';

const USER_ID = '43a7b0fb-bde8-4109-a553-1134f2f917fd';

describe('isUserSoftDeleted', () => {
    it('reports a soft-deleted user as deleted', async () => {
        // Arrange — the shape production was in: deleted_at populated.
        limitMock.mockResolvedValueOnce([{ deletedAt: new Date('2026-08-15T00:24:23Z') }]);

        // Act
        const result = await isUserSoftDeleted({ userId: USER_ID });

        // Assert
        expect(result).toBe(true);
    });

    it('reports a live user as NOT deleted (positive control)', async () => {
        // Without this the predicate could return a constant `true` and every
        // test above would still pass while the whole site was locked out.
        limitMock.mockResolvedValueOnce([{ deletedAt: null }]);

        const result = await isUserSoftDeleted({ userId: USER_ID });

        expect(result).toBe(false);
    });

    it('queries the DATABASE rather than trusting a caller-supplied object', async () => {
        // The gate is only worth anything if it is authoritative. `cookieCache`
        // means an in-memory check would answer from a five-minute-old snapshot.
        limitMock.mockResolvedValueOnce([{ deletedAt: null }]);

        await isUserSoftDeleted({ userId: USER_ID });

        expect(getDbMock).toHaveBeenCalled();
        expect(selectMock).toHaveBeenCalled();
        expect(whereMock).toHaveBeenCalledWith({ column: 'users.id', value: USER_ID });
    });

    it('treats a MISSING user row as deleted (fail closed)', async () => {
        // A session whose user row is gone must not authenticate. Answering
        // `false` here would reopen the hole for hard-deleted accounts.
        limitMock.mockResolvedValueOnce([]);

        const result = await isUserSoftDeleted({ userId: USER_ID });

        expect(result).toBe(true);
    });

    it('propagates a database failure instead of reporting the user as live', async () => {
        // Fail closed, never fail open: callers turn a throw into "no session".
        // Swallowing the error and returning `false` would grant access during
        // exactly the outage where the gate cannot be evaluated.
        limitMock.mockRejectedValueOnce(new Error('connection reset'));

        await expect(isUserSoftDeleted({ userId: USER_ID })).rejects.toThrow('connection reset');
    });
});
