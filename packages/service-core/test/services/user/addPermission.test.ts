/**
 * @file addPermission.test.ts
 *
 * Tests for UserService.addPermission method.
 * Covers: success, forbidden, not found, validation, internal error, edge cases.
 */
import { UserModel } from '@repo/db';
import { PermissionEnum, RoleEnum, type UserId } from '@repo/types';
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

/**
 * Test suite for UserService.addPermission
 */
describe('UserService.addPermission', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1');
    const actor = getActor(RoleEnum.SUPER_ADMIN);
    const input = { userId: userId as UserId, permission: PermissionEnum.USER_CREATE };

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should add a permission to a user (success)', async () => {
        // Arrange
        const user = getUser({ id: userId, permissions: [] });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue({
            ...user,
            id: userId,
            permissions: [PermissionEnum.USER_CREATE]
        });
        // Act
        const result = await service.addPermission(actor, input);
        // Assert
        expectSuccess(result);
        expect(result.data?.user.permissions).toContain(PermissionEnum.USER_CREATE);
        expect(result.data?.user.id).toBe(userId);
        expect(asMock(userModelMock.findById)).toHaveBeenCalledWith(userId);
        expect(asMock(userModelMock.update)).toHaveBeenCalledWith(
            { id: userId },
            { permissions: [PermissionEnum.USER_CREATE] }
        );
    });

    it('should not duplicate permission if already present', async () => {
        // Arrange
        const user = getUser({ id: userId, permissions: [PermissionEnum.USER_CREATE] });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        // Act
        const result = await service.addPermission(actor, input);
        // Assert
        expectSuccess(result);
        expect(result.data?.user.permissions).toEqual([PermissionEnum.USER_CREATE]);
        expect(asMock(userModelMock.update)).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);
        // Act
        const result = await service.addPermission(actor, input);
        // Assert
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor is not super admin', async () => {
        // Arrange
        const user = getUser({ id: userId, permissions: [] });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const forbiddenActor = getActor(RoleEnum.ADMIN);
        // Act
        const result = await service.addPermission(forbiddenActor, input);
        // Assert
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if update fails', async () => {
        // Arrange
        const user = getUser({ id: userId, permissions: [] });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue(null);
        // Act
        const result = await service.addPermission(actor, input);
        // Assert
        expectInternalError(result);
    });

    it('should return VALIDATION_ERROR for invalid userId', async () => {
        // Act
        const result = await service.addPermission(actor, {
            userId: '' as UserId,
            permission: PermissionEnum.USER_CREATE
        });
        // Assert
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR for invalid permission', async () => {
        // Act
        const invalidPermission = undefined as unknown as PermissionEnum;
        const result = await service.addPermission(actor, {
            userId: userId as UserId,
            permission: invalidPermission
        });
        // Assert
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR if userId is empty', async () => {
        const result = await service.addPermission(actor, {
            userId: '' as UserId,
            permission: PermissionEnum.USER_READ_ALL
        });
        expectValidationError(result);
    });

    it('should return VALIDATION_ERROR if permission is invalid', async () => {
        const result = await service.addPermission(actor, {
            userId: 'some-id' as UserId,
            permission: 'INVALID' as PermissionEnum
        });
        expectValidationError(result);
    });

    it('should return UNAUTHORIZED if actor is undefined', async () => {
        const result = await service.addPermission(undefined as unknown as Actor, {
            userId: 'some-id' as UserId,
            permission: PermissionEnum.USER_READ_ALL
        });
        expectUnauthorizedError(result);
    });

    it('should return FORBIDDEN if actor has no role', async () => {
        const fakeActor = {
            id: 'x',
            permissions: [],
            role: undefined as unknown as RoleEnum
        } as Actor;
        const result = await service.addPermission(fakeActor, {
            userId: userId as UserId,
            permission: PermissionEnum.USER_READ_ALL
        });
        expectForbiddenError(result);
    });
});
