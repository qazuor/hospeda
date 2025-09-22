import { UserModel } from '@repo/db';
import type { AdminInfoType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, type User } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: UserModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

// Helper to cast a function to a Vitest mock
function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

describe('UserService - setAdminInfo', () => {
    let service: UserService;
    let superAdmin: Actor;
    let entity: User;

    beforeEach(() => {
        modelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new UserService({ logger: loggerMock }, modelMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.USER_UPDATE_PROFILE]
        });
        entity = createUser();
        asMock(modelMock.findById).mockResolvedValue(entity);
        asMock(modelMock.update).mockResolvedValue({
            ...entity,
            adminInfo: { favorite: true }
        });
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        // Arrange
        const forbiddenUser = createUser({ id: getMockId('user', 'user-entity-id') as string });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different') as string,
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenUser);
        // Act
        const result = await service.setAdminInfo({
            actor: forbiddenActor,
            id: forbiddenUser.id,
            adminInfo: { favorite: true }
        });
        // Assert
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(undefined);
        // Act
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: 'not-exist',
            adminInfo: { favorite: true }
        });
        // Assert
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid adminInfo', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue(entity);
        // Act
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: entity.id,
            adminInfo: {} as AdminInfoType
        });
        // Assert
        expectValidationError(result);
    });
});
