/**
 * @file hardDelete.test.ts
 *
 * Tests for UserService.hardDelete method.
 * Covers: success, forbidden, not found, internal error, lifecycle hook errors, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
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

const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN, id?: string) => createUser({ role, id });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Test suite for UserService.hardDelete
 */
describe('UserService.hardDelete', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const admin = getActor(RoleEnum.ADMIN);
    const user = getActor(RoleEnum.USER);
    const inputId = userId;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should hard delete a user (success, super admin)', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.hardDelete).mockResolvedValue(1);
        // Act
        const result = await service.hardDelete(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(asMock(userModelMock.hardDelete)).toHaveBeenCalledWith({ id: inputId });
    });

    it('should return FORBIDDEN if actor is not super admin', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        // Act
        const resultAdmin = await service.hardDelete(admin, inputId);
        const resultUser = await service.hardDelete(user, inputId);
        // Assert
        expectForbiddenError(resultAdmin);
        expectForbiddenError(resultUser);
        expect(asMock(userModelMock.hardDelete)).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);
        // Act
        const result = await service.hardDelete(superAdmin, inputId);
        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model.hardDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.hardDelete).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.hardDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeHardDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeHardDelete: () => void },
            '_beforeHardDelete'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.hardDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterHardDelete throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.hardDelete).mockResolvedValue(1);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterHardDelete: () => void },
            '_afterHardDelete'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.hardDelete(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });
});
