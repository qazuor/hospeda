/**
 * @file create.test.ts
 *
 * Tests for UserService.create method.
 * Covers: success, forbidden, validation, internal error, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createUser, createUserForCreation } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN) => createUser({ role });
const getUserForCreation = (overrides = {}) => createUserForCreation({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Test suite for UserService.create
 */
describe('UserService.create', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actor = getActor(RoleEnum.SUPER_ADMIN);
    const input = getUserForCreation({ displayName: 'Test User', role: RoleEnum.USER });

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['create']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should create a user (success)', async () => {
        // Arrange
        const createdUser = createUser({ displayName: 'Test User', role: RoleEnum.USER });
        asMock(userModelMock.create).mockResolvedValue(createdUser);
        // Act
        const result = await service.create(actor, input);
        // Assert
        expectSuccess(result);
        expect(result.data?.id).toBe(createdUser.id);
        expect(asMock(userModelMock.create)).toHaveBeenCalledWith(
            expect.objectContaining({ displayName: 'Test User' })
        );
    });

    it('should return FORBIDDEN if actor is not super admin', async () => {
        // Arrange
        const forbiddenActor = getActor(RoleEnum.ADMIN);
        // Act
        const result = await service.create(forbiddenActor, input);
        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Act
        const result = await service.create(actor, { ...input, displayName: '' });
        // Assert
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model create fails', async () => {
        // Arrange
        asMock(userModelMock.create).mockResolvedValue(null);
        // Act
        const result = await service.create(actor, input);
        // Assert
        expectInternalError(result);
    });
});
