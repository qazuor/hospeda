/**
 * @file getById.test.ts
 *
 * Tests for UserService.getById method.
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
 * Test suite for UserService.getById
 */
describe('UserService.getById', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const userId = getMockId('user', 'user-1') as string;
    const superAdmin = getActor(RoleEnum.SUPER_ADMIN, userId);
    const selfUser = getActor(RoleEnum.USER, userId);
    const otherUser = getActor(RoleEnum.USER, getMockId('user', 'other') as string);
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
        expect(userModelMock.findOne).toHaveBeenCalledWith({ id: inputId }, undefined);
        expect(userModelMock.findOneWithRelations).not.toHaveBeenCalled();
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

    it('answers a foreign account exactly as it answers an id that does not exist (HOS-600)', async () => {
        // These two used to be separate assertions — "FORBIDDEN if not self"
        // sitting next to "NOT_FOUND if the user does not exist" — and both
        // passed while the endpoint was an existence oracle: a caller holding
        // any id learned from the status alone whether it named a real account.
        // Because `findOne` still returns soft-deleted rows, the 403 disclosed
        // DELETED accounts too. Asserting the two side by side, as one value,
        // is what makes the leak visible.

        // Arrange — the row exists and belongs to somebody else.
        asMock(userModelMock.findOne).mockResolvedValue(getUser({ id: inputId }));
        // Act
        const foreign = await service.getById(otherUser, inputId);

        // Arrange — nothing at that id.
        asMock(userModelMock.findOne).mockResolvedValue(null);
        // Act
        const missing = await service.getById(superAdmin, inputId);

        // Assert — whole-result equality, not `objectContaining`: a field one
        // side carries and the other does not is exactly the difference this
        // has to catch.
        expect(foreign).toEqual(missing);
        expectNotFoundError(foreign);
        expectNotFoundError(missing);
        // ...and the refusal no longer hands the caller the name of the
        // permission they would need.
        expect(foreign.error?.message).not.toMatch(/USER_READ_ALL|permission/i);
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
