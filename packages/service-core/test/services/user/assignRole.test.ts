/**
 * @file assignRole.test.ts
 *
 * Tests for `UserService.assignRole`.
 *
 * ## Why this file was rewritten rather than adapted (HOS-296 §12)
 *
 * The previous version encoded the destructive contract directly:
 * `userModel.update({ id }, { role })` was asserted as the write, a
 * "role is already assigned" case asserted the update was SKIPPED, and the
 * success case asserted the returned user's `role` had changed.
 *
 * None of those survive:
 *
 * - The write is now `grantRole`, which is additive and idempotent. There is
 *   no same-role short-circuit here any more, because the primitive's
 *   `(user_id, role)` primary key already makes a repeat grant a no-op — and a
 *   short-circuit in this method would have been a second, divergent copy of
 *   that rule.
 * - `users.role` is gone, so `result.data.user.role` cannot change. The method
 *   returns the subject user unchanged; the hat is read back from `user_role`.
 * - The `INTERNAL_ERROR if update fails` case moved from "model.update returned
 *   null" to "grantRole returned an error".
 *
 * The permission/validation cases are unchanged in intent and kept.
 */
import { UserModel } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { Actor } from '../../../src';
import { UserService } from '../../../src/services/user/user.service';
import { ServiceError } from '../../../src/types';
import { createActor, createSuperAdminActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectUnauthorizedError,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const grantRoleMock = vi.hoisted(() => vi.fn());
const getUserRolesMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: grantRoleMock,
    // HOS-296: the module also exports the read primitive, and the
    // billing-exempt-owner branch of publish/update calls it. A module mock
    // that omits it turns that branch into "getUserRoles is not a function"
    // — an INTERNAL_ERROR that looks nothing like a role problem.
    getUserRoles: getUserRolesMock
}));

const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.assignRole', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const actor = createSuperAdminActor();
    const input = { userId, role: RoleEnum.ADMIN };

    beforeEach(() => {
        vi.clearAllMocks();
        grantRoleMock.mockResolvedValue({ data: undefined });
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('grants the role additively and never writes users.role', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });

        const result = await service.assignRole(actor, input);

        expectSuccess(result);
        expect(result.data?.user.id).toBe(userId);
        expect(grantRoleMock).toHaveBeenCalledTimes(1);
        expect(grantRoleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId,
                role: RoleEnum.ADMIN,
                grantedBy: actor.id,
                reason: 'admin_assign_role'
            })
        );
        // The destructive second write path this method used to own.
        expect(asMock(userModelMock.update)).not.toHaveBeenCalled();
    });

    it('still calls grantRole when the user already holds the role', async () => {
        // The old version short-circuited here. Idempotency belongs to the
        // primitive, not to a duplicate check in every caller.
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });

        const result = await service.assignRole(actor, input);

        expectSuccess(result);
        expect(grantRoleMock).toHaveBeenCalledTimes(1);
    });

    it('forwards the caller transaction so the grant and its audit row enlist in it', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const tx = { marker: 'caller-tx' } as unknown as never;

        await service.assignRole(actor, input, { tx });

        expect(grantRoleMock).toHaveBeenCalledWith(
            expect.objectContaining({ ctx: expect.objectContaining({ tx }) })
        );
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        asMock(userModelMock.findById).mockResolvedValue(null);
        const result = await service.assignRole(actor, input);
        expectNotFoundError(result);
        expect(grantRoleMock).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const forbiddenActor = createActor({ roles: [RoleEnum.ADMIN], permissions: [] });
        const result = await service.assignRole(forbiddenActor, input);
        expectForbiddenError(result);
        expect(grantRoleMock).not.toHaveBeenCalled();
    });

    it('should surface an INTERNAL_ERROR when the grant fails', async () => {
        const user = getUser({ id: userId });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        grantRoleMock.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'grant exploded')
        });

        const result = await service.assignRole(actor, input);

        expectInternalError(result);
    });

    it('should return VALIDATION_ERROR for invalid userId', async () => {
        const result = await service.assignRole(actor, {
            userId: '' as string,
            role: RoleEnum.ADMIN
        });
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR for invalid role', async () => {
        const invalidRole = undefined as unknown as RoleEnum;
        const result = await service.assignRole(actor, {
            userId: userId as string,
            role: invalidRole
        });
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR if role is invalid', async () => {
        const result = await service.assignRole(actor, {
            userId: 'some-id' as string,
            role: 'INVALID' as RoleEnum
        });
        expectValidationError(result);
    });

    it('should return UNAUTHORIZED if actor is undefined', async () => {
        const result = await service.assignRole(undefined as unknown as Actor, {
            userId: 'some-id' as string,
            role: RoleEnum.USER
        });
        expectUnauthorizedError(result);
    });

    it('should return FORBIDDEN if actor has no role', async () => {
        const fakeActor = {
            id: 'x',
            permissions: [],
            roles: [undefined] as unknown as readonly RoleEnum[]
        } as Actor;
        const result = await service.assignRole(fakeActor, {
            userId: userId as string,
            role: RoleEnum.USER
        });
        expectForbiddenError(result);
    });
});
