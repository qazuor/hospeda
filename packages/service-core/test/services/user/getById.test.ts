/**
 * @file getById.test.ts
 *
 * Tests for UserService.getById method.
 * Covers: success (super admin, self), forbidden, not found, internal error, lifecycle hook errors, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum, type UserId } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN, id?: UserId) => createUser({ role, id });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Test suite for UserService.getById
 */
describe('UserService.getById', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as UserId;
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN, userId);
    const selfUser = getActor(RoleEnum.USER, userId);
    const otherUser = getActor(RoleEnum.USER, getMockId('user', 'other') as UserId);
    const inputId = userId;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should return a user by id (success, super admin)', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getById(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.id).toBe(inputId);
    });

    it('should return a user by id (success, self)', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getById(selfUser, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.id).toBe(inputId);
    });

    it('should return FORBIDDEN if actor is not self or super admin', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getById(otherUser, inputId);
        // Assert
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const result = await service.getById(superAdmin, inputId);
        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.getById(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getById(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getById(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });
});
