/**
 * @file getByName.test.ts
 *
 * Tests for UserService.getByName method.
 * Covers: success (super admin, self), forbidden, not found, internal error, lifecycle hook errors, edge cases.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// HOS-296: a `User` fixture is NOT an `Actor` any more — `Actor.roles` has no
// counterpart on the entity now that hats live in `user_role`. Actors come from
// the actor factory; the user row carries identity only.
const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN, id?: string) =>
    createActor({
        ...(id === undefined ? {} : { id }),
        roles: [role],
        // Permissions stay EMPTY, exactly as the pre-HOS-296 `User` fixture was:
        // these suites gate on self-ownership, not on a permission grant.
        permissions: []
    });
const getUser = (overrides = {}) => createUser({ ...overrides });
const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Test suite for UserService.getByName
 */
describe('UserService.getByName', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const name = 'Test User';
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN, userId);
    const selfUser = getActor(RoleEnum.USER, userId);
    const otherUser = getActor(RoleEnum.USER, getMockId('user', 'other') as string);

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should return a user by name (success, super admin)', async () => {
        // Arrange
        const entity = getUser({ id: userId, displayName: name });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getByName(superAdmin, name);
        // Assert
        expectSuccess(result);
        expect(result.data?.displayName).toBe(name);
    });

    it('should return a user by name (success, self)', async () => {
        // Arrange
        const entity = getUser({ id: userId, displayName: name });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const result = await service.getByName(selfUser, name);
        // Assert
        expectSuccess(result);
        expect(result.data?.displayName).toBe(name);
    });

    it('answers a foreign account exactly as it answers a lookup that matches nothing (HOS-600)', async () => {
        // The pair used to be two separate assertions, FORBIDDEN next to
        // NOT_FOUND, and both passed while the lookup was an existence oracle.
        // Compared side by side as one value, the difference is unmissable.

        // Arrange — the row exists and belongs to somebody else.
        const entity = getUser({ id: userId, displayName: name });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        // Act
        const foreign = await service.getByName(otherUser, name);

        // Arrange — nothing matches.
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const missing = await service.getByName(superAdmin, name);

        // Assert — whole-result equality, never `objectContaining`.
        expect(foreign).toEqual(missing);
        expectNotFoundError(foreign);
        expect(foreign.error?.message).not.toMatch(/USER_READ_ALL|permission/i);
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const result = await service.getByName(superAdmin, name);
        // Assert
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(userModelMock.findOne).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.getByName(superAdmin, name);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: userId, displayName: name });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getByName(superAdmin, name);
        // Assert
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterGetByField throws', async () => {
        // Arrange
        const entity = getUser({ id: userId, displayName: name });
        asMock(userModelMock.findOne).mockResolvedValue(entity);
        const hookError = new Error('hook error');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        // Act
        const result = await service.getByName(superAdmin, name);
        // Assert
        expectInternalError(result);
    });
});
