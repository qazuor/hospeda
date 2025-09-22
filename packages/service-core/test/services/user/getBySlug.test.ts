/**
 * @file getBySlug.test.ts
 *
 * Tests for UserService.getBySlug method.
 * Covers: success (super admin, self), forbidden, not found, internal error, lifecycle hook errors, edge cases.
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
 * Test suite for UserService.getBySlug
 */
describe('UserService.getBySlug', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const slug = 'test-user-slug';
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN, userId);
    const selfUser = getActor(RoleEnum.USER, userId);
    const otherUser = getActor(RoleEnum.USER, getMockId('user', 'other') as string);

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should return a user by slug (success, super admin)', async () => {
        // Arrange
        const entity = getUser({ id: userId, slug });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getBySlug(superAdmin, slug);
        // Assert
        expectSuccess(result);
        expect(result.data?.slug).toBe(slug);
    });

    it('should return a user by slug (success, self)', async () => {
        // Arrange
        const entity = getUser({ id: userId, slug });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getBySlug(selfUser, slug);
        // Assert
        expectSuccess(result);
        expect(result.data?.slug).toBe(slug);
    });

    it('should return FORBIDDEN if actor is not self or super admin', async () => {
        // Arrange
        const entity = getUser({ id: userId, slug });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getBySlug(otherUser, slug);
        // Assert
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const result = await service.getBySlug(superAdmin, slug);
        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.getBySlug(superAdmin, slug);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: userId, slug });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getBySlug(superAdmin, slug);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: userId, slug });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getBySlug(superAdmin, slug);
        // Assert
        expectInternalError(result);
    });
});
