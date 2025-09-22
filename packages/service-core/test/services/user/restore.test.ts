/**
 * @file restore.test.ts
 *
 * Tests for UserService.restore method.
 * Covers: success, forbidden, not found, already restored, internal error, edge cases.
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
 * Test suite for UserService.restore
 */
describe('UserService.restore', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN);
    const admin = getActor(RoleEnum.ADMIN);
    const user = getActor(RoleEnum.USER);
    const inputId = userId;

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should restore a user (success, super admin, deleted)', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.restore).mockResolvedValue(1);
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(asMock(userModelMock.restore)).toHaveBeenCalledWith({ id: inputId });
    });

    it('should return FORBIDDEN if actor is not super admin', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        // Act
        const resultAdmin = await service.restore(admin, inputId);
        const resultUser = await service.restore(user, inputId);
        // Assert
        expectForbiddenError(resultAdmin);
        expectForbiddenError(resultUser);
        expect(asMock(userModelMock.restore)).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectNotFoundError(result);
    });

    it('should return count 0 if user is not deleted', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: null });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(asMock(userModelMock.restore)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.restore throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.restore).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeRestore throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeRestore: () => void },
            '_beforeRestore'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterRestore throws', async () => {
        // Arrange
        const entity = getUser({ id: inputId, deletedAt: new Date() });
        asMock(userModelMock.findById).mockResolvedValue(entity);
        asMock(userModelMock.restore).mockResolvedValue(1);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterRestore: () => void },
            '_afterRestore'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.restore(superAdmin, inputId);
        // Assert
        expectInternalError(result);
    });
});
