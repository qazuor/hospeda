/**
 * @file softDelete.revokes-sessions.test.ts
 *
 * Regression test for H-163: `UserService.softDelete` must revoke the deleted
 * account's sessions.
 *
 * `user.session-revocation.test.ts` proves the helper deletes the right rows.
 * That is only worth anything if the soft-delete path actually CALLS it — and it
 * would not be caught otherwise, because the call is wrapped in a try/catch that
 * swallows failures by design. Without this file the hook could be deleted
 * outright and all 320 sibling user-service tests would stay green.
 */

import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const { revokeUserSessionsMock } = vi.hoisted(() => ({
    revokeUserSessionsMock: vi.fn().mockResolvedValue({ revokedCount: 1 })
}));

vi.mock('../../../src/services/user/user.session-revocation', () => ({
    revokeUserSessions: revokeUserSessionsMock
}));

import { UserService } from '../../../src/services/user/user.service';
import { createActor, createSuperAdminActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.softDelete — session revocation (H-163)', () => {
    let service: UserService;
    let userModelMock: UserModel;
    const targetUserId = getMockId('user', 'user-1') as string;
    const otherUserId = getMockId('user', 'user-2') as string;
    const superAdmin = createSuperAdminActor();

    beforeEach(() => {
        vi.clearAllMocks();
        revokeUserSessionsMock.mockResolvedValue({ revokedCount: 1 });
        userModelMock = createTypedModelMock(UserModel, ['findById', 'softDelete']);
        service = createServiceTestInstance(UserService, userModelMock, createLoggerMock());
    });

    it('revokes the sessions of the account it just deleted', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(
            createUser({ id: targetUserId, deletedAt: null })
        );
        asMock(userModelMock.softDelete).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(superAdmin, targetUserId);

        // Assert
        expectSuccess(result);
        expect(revokeUserSessionsMock).toHaveBeenCalledTimes(1);
        expect(revokeUserSessionsMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: targetUserId })
        );
    });

    it('never revokes a DIFFERENT account (positive control)', async () => {
        // Deleting one account must not sign anybody else out. This is the
        // blast-radius check the production incident makes non-negotiable.
        asMock(userModelMock.findById).mockResolvedValue(
            createUser({ id: targetUserId, deletedAt: null })
        );
        asMock(userModelMock.softDelete).mockResolvedValue(1);

        await service.softDelete(superAdmin, targetUserId);

        const revokedIds = revokeUserSessionsMock.mock.calls.map(
            (call) => (call[0] as { userId: string }).userId
        );
        expect(revokedIds).toEqual([targetUserId]);
        expect(revokedIds).not.toContain(otherUserId);
    });

    it('does NOT revoke anything when the account was already deleted', async () => {
        // `softDelete` short-circuits with count 0 for an already-deleted row;
        // no rows changed, so there is nothing to revoke.
        asMock(userModelMock.findById).mockResolvedValue(
            createUser({ id: targetUserId, deletedAt: new Date() })
        );

        const result = await service.softDelete(superAdmin, targetUserId);

        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(revokeUserSessionsMock).not.toHaveBeenCalled();
    });

    it('does NOT revoke anything when the delete was refused', async () => {
        // A non-super-admin gets FORBIDDEN before any write. Revoking sessions
        // there would let an unauthorised actor sign a user out at will.
        asMock(userModelMock.findById).mockResolvedValue(
            createUser({ id: targetUserId, deletedAt: null })
        );

        await service.softDelete(
            createActor({ roles: [RoleEnum.ADMIN], permissions: [] }),
            targetUserId
        );

        expect(revokeUserSessionsMock).not.toHaveBeenCalled();
    });

    it('still reports the delete as successful when revocation fails', async () => {
        // Best-effort on purpose: `authMiddleware` re-checks `deleted_at` on
        // every request, so a leftover session row grants nothing. Failing the
        // whole delete over stale rows would be the worse trade.
        asMock(userModelMock.findById).mockResolvedValue(
            createUser({ id: targetUserId, deletedAt: null })
        );
        asMock(userModelMock.softDelete).mockResolvedValue(1);
        revokeUserSessionsMock.mockRejectedValueOnce(new Error('connection reset'));

        const result = await service.softDelete(superAdmin, targetUserId);

        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });
});
