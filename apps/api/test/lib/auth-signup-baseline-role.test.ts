/**
 * @file auth-signup-baseline-role.test.ts
 *
 * Tests the baseline-role grant of the Better Auth `user.create.after` hook
 * (HOS-296).
 *
 * The regression that matters: the hook runs AFTER the `users` row is
 * committed, so throwing does not roll it back. Without a compensating delete a
 * failed grant returns a 500 while permanently reserving the email address on
 * an account that holds no roles — the user cannot retry and cannot be helped
 * without an operator. `routes/auth/signup-as-host.ts` already does the
 * compensation; this asserts the signup path does too.
 */

import { describe, expect, it, vi } from 'vitest';

const { grantRoleMock, deleteWhereMock, deleteMock, getDbMock } = vi.hoisted(() => {
    const deleteWhere = vi.fn().mockResolvedValue([]);
    const del = vi.fn().mockReturnValue({ where: deleteWhere });
    return {
        grantRoleMock: vi.fn(),
        deleteWhereMock: deleteWhere,
        deleteMock: del,
        getDbMock: vi.fn().mockReturnValue({ delete: del })
    };
});

vi.mock('@repo/db', () => ({
    getDb: getDbMock,
    users: { id: 'users.id' },
    eq: (column: unknown, value: unknown) => ({ column, value })
}));

vi.mock('@repo/service-core', () => ({ grantRole: grantRoleMock }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import { grantBaselineUserRole } from '../../src/lib/auth-signup-baseline-role';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'ana@example.com';

describe('grantBaselineUserRole', () => {
    it('grants USER as a system grant and leaves the account alone on success', async () => {
        // Arrange
        grantRoleMock.mockResolvedValueOnce({ data: undefined });

        // Act
        await grantBaselineUserRole({ userId: USER_ID, email: EMAIL });

        // Assert
        expect(grantRoleMock).toHaveBeenCalledWith({
            userId: USER_ID,
            role: 'USER',
            grantedBy: null,
            reason: 'signup'
        });
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it('deletes the just-created account when the grant fails, then rethrows', async () => {
        // Arrange
        deleteMock.mockClear();
        const error = { code: 'INTERNAL_ERROR', message: 'boom' };
        grantRoleMock.mockResolvedValueOnce({ error });

        // Act & Assert — without the delete the email stays taken forever on an
        // account holding zero roles.
        await expect(grantBaselineUserRole({ userId: USER_ID, email: EMAIL })).rejects.toBe(error);
        expect(deleteMock).toHaveBeenCalledTimes(1);
        expect(deleteWhereMock).toHaveBeenCalledWith({ column: 'users.id', value: USER_ID });
    });

    it('still rethrows the original error when the cleanup delete also fails', async () => {
        // Arrange
        deleteMock.mockClear();
        const error = { code: 'INTERNAL_ERROR', message: 'boom' };
        grantRoleMock.mockResolvedValueOnce({ error });
        deleteWhereMock.mockRejectedValueOnce(new Error('connection lost'));

        // Act & Assert — the grant failure is what explains the outage; the
        // cleanup failure must not mask it.
        await expect(grantBaselineUserRole({ userId: USER_ID, email: EMAIL })).rejects.toBe(error);
    });
});
