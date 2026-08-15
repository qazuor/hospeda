/**
 * @file user.session-revocation.test.ts
 *
 * Regression tests for H-163 — deleting an account must revoke the sessions it
 * already holds.
 *
 * Measured in production on 2026-08-15: two accounts were deleted from the admin
 * panel and both kept a live session — one valid for another six days. The FK
 * from `session` to `users` is declared `onDelete: 'cascade'`, which reads like
 * it covers this, but a cascade only fires on a physical DELETE. A soft delete
 * writes `deleted_at` and nothing else, so the rows survive.
 *
 * The third assertion here is the one that matters most: revoking one account's
 * sessions must not touch anybody else's. A `delete(sessions)` with a broken or
 * absent predicate would log out every user on the platform, which is a far
 * worse outage than the bug being fixed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    sessions: { userId: 'sessions.user_id' },
    eq: (column: unknown, value: unknown) => ({ column, value }),
    getDb: vi.fn()
}));

import * as dbModule from '@repo/db';
import { revokeUserSessions } from '../../../src/services/user/user.session-revocation';

const mockGetDb = dbModule.getDb as unknown as ReturnType<typeof vi.fn>;

const DELETED_USER_ID = '43a7b0fb-bde8-4109-a553-1134f2f917fd';

/**
 * Builds a Drizzle-shaped delete chain that records what it was asked to remove.
 *
 * @returns The fake client plus the spies for `delete` and its `where` clause.
 */
const createDeleteSpy = () => {
    const whereSpy = vi.fn().mockResolvedValue([{ id: 'session-1' }]);
    const deleteSpy = vi.fn().mockReturnValue({ where: whereSpy });
    return { client: { delete: deleteSpy }, deleteSpy, whereSpy };
};

describe('revokeUserSessions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deletes the session rows of the account being removed', async () => {
        // Arrange
        const { client, deleteSpy } = createDeleteSpy();
        mockGetDb.mockReturnValue(client);

        // Act
        await revokeUserSessions({ userId: DELETED_USER_ID });

        // Assert
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith(dbModule.sessions);
    });

    it('scopes the delete to that ONE account (positive control)', async () => {
        // The blast-radius assertion. An unscoped delete would sign out every
        // account on the platform and every test above would still pass.
        const { client, whereSpy } = createDeleteSpy();
        mockGetDb.mockReturnValue(client);

        await revokeUserSessions({ userId: DELETED_USER_ID });

        expect(whereSpy).toHaveBeenCalledTimes(1);
        expect(whereSpy).toHaveBeenCalledWith({
            column: 'sessions.user_id',
            value: DELETED_USER_ID
        });
    });

    it('runs inside the caller transaction when one is supplied', async () => {
        // The delete has to be part of the same transaction as the soft delete,
        // otherwise a rollback leaves the account alive with its sessions gone.
        const { client: txClient, deleteSpy: txDelete } = createDeleteSpy();
        const { client: globalClient, deleteSpy: globalDelete } = createDeleteSpy();
        mockGetDb.mockReturnValue(globalClient);

        await revokeUserSessions({
            userId: DELETED_USER_ID,
            tx: txClient as unknown as Parameters<typeof revokeUserSessions>[0]['tx']
        });

        expect(txDelete).toHaveBeenCalledTimes(1);
        expect(globalDelete).not.toHaveBeenCalled();
        expect(mockGetDb).not.toHaveBeenCalled();
    });

    it('reports how many sessions it revoked', async () => {
        const whereSpy = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
        mockGetDb.mockReturnValue({ delete: vi.fn().mockReturnValue({ where: whereSpy }) });

        const result = await revokeUserSessions({ userId: DELETED_USER_ID });

        expect(result.revokedCount).toBe(2);
    });
});
