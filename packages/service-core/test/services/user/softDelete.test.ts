/**
 * @file softDelete.test.ts
 *
 * Tests for UserService.softDelete method.
 * Covers: success, forbidden, not found, already deleted, internal error, lifecycle hook errors, edge cases.
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
 * Test suite for UserService.softDelete
 */
describe('UserService.softDelete', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as UserId;
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const admin = getActor(RoleEnum.ADMIN);
    const user = getActor(RoleEnum.USER);
    const inputId = userId;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should soft delete a user (success, super admin)', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.softDelete).mockResolvedValue(1);
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(asMock(userModelMock.softDelete)).toHaveBeenCalledWith({ id: inputId });
    });

    it('should return FORBIDDEN if actor is not super admin', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        // Act
        const resultAdmin = await service.softDelete(admin, inputId);
        const resultUser = await service.softDelete(user, inputId);
        // Assert
        expectForbiddenError(resultAdmin);
        expectForbiddenError(resultUser);
        expect(asMock(userModelMock.softDelete)).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectNotFoundError(result);
    });

    it('should return count 0 if user is already deleted', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(asMock(userModelMock.softDelete)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.softDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.softDelete).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeSoftDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeSoftDelete: () => void },
            '_beforeSoftDelete'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterSoftDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.softDelete).mockResolvedValue(1);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterSoftDelete: () => void },
            '_afterSoftDelete'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.softDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });
});
