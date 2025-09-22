/**
 * @file update.test.ts
 *
 * Tests for UserService.update method.
 * Covers: success (self, super admin), forbidden, not found, validation, internal error, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const getActor = (
    role: RoleEnum = RoleEnum.SUPER_ADMIN,
    id: string = getMockId('user') as string
) => createUser({ id, role });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.update', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const user = getUser({
        id: getMockId('user') as string,
        displayName: 'Original',
        role: RoleEnum.USER
    });
    const updateInput = { displayName: 'Updated Name', slug: user.slug };

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should allow self-update (success)', async () => {
        // Arrange
        const actor = getActor(RoleEnum.USER, user.id);
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, ...updateInput });
        // Act
        const result = await service.update(actor, user.id, updateInput);
        // Assert
        expectSuccess(result);
        expect(result.data?.displayName).toBe('Updated Name');
    });

    it('should allow super admin to update any user (success)', async () => {
        // Arrange
        const actor = getActor(RoleEnum.SUPER_ADMIN, getMockId('user') as string);
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue({ ...user, ...updateInput });
        // Act
        const result = await service.update(actor, user.id, updateInput);
        // Assert
        expectSuccess(result);
        expect(result.data?.displayName).toBe('Updated Name');
    });

    it('should return FORBIDDEN if actor is not self or super admin', async () => {
        // Arrange
        const actor = getActor(RoleEnum.USER, getMockId('user', 'other-user') as string);
        asMock(userModelMock.findById).mockResolvedValue(user);
        // Act
        const result = await service.update(actor, user.id, updateInput);
        // Assert
        expectForbiddenError(result);
        expect(userModelMock.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        const actor = getActor(RoleEnum.SUPER_ADMIN);
        const nonExistentId = getMockId('user') as string;
        asMock(userModelMock.findById).mockResolvedValue(null);
        // Act
        const result = await service.update(actor, nonExistentId, {
            ...updateInput
        });
        // Assert
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Arrange
        const actor = getActor(RoleEnum.SUPER_ADMIN);
        asMock(userModelMock.findById).mockResolvedValue(user);
        // Act
        const result = await service.update(actor, user.id, {
            slug: user.slug,
            displayName: ''
        });
        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model update fails', async () => {
        // Arrange
        const actor = getActor(RoleEnum.SUPER_ADMIN);
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue(null);
        // Act
        const result = await service.update(actor, user.id, updateInput);
        // Assert
        expectInternalError(result);
    });
});
