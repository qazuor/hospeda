/**
 * @file assignRole.test.ts
 *
 * Tests for UserService.assignRole method.
 * Covers: success, forbidden, not found, validation, internal error, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../../src';
import { UserService } from '../../../src/services/user/user.service';
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

const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN) => createUser({ role });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.assignRole', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const actor = getActor(RoleEnum.SUPER_ADMIN);
    const input = { userId, role: RoleEnum.ADMIN };

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should assign a new role to a user (success)', async () => {
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue({
            ...user,
            id: userId,
            role: RoleEnum.ADMIN
        });
        const result = await service.assignRole(actor, input);
        expectSuccess(result);
        expect(result.data?.user.role).toBe(RoleEnum.ADMIN);
        expect(result.data?.user.id).toBe(userId);
        expect(asMock(userModelMock.findById)).toHaveBeenCalledWith(userId);
        expect(asMock(userModelMock.update)).toHaveBeenCalledWith(
            { id: userId },
            { role: RoleEnum.ADMIN }
        );
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        asMock(userModelMock.findById).mockResolvedValue(null);
        const result = await service.assignRole(actor, input);
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const forbiddenActor = getActor(RoleEnum.ADMIN);
        const result = await service.assignRole(forbiddenActor, input);
        expectForbiddenError(result);
    });

    it('should return the user unchanged if role is already assigned', async () => {
        const user = getUser({ id: userId, role: RoleEnum.ADMIN });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const result = await service.assignRole(actor, input);
        expectSuccess(result);
        expect(result.data?.user.role).toBe(RoleEnum.ADMIN);
        expect(result.data?.user.id).toBe(userId);
        expect(asMock(userModelMock.update)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if update fails', async () => {
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue(null);
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

    it('should return VALIDATION_ERROR if userId is empty', async () => {
        const result = await service.assignRole(actor, {
            userId: '' as string,
            role: RoleEnum.USER
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
            role: undefined as unknown as RoleEnum
        } as Actor;
        const result = await service.assignRole(fakeActor, {
            userId: userId as string,
            role: RoleEnum.USER
        });
        expectForbiddenError(result);
    });
});
