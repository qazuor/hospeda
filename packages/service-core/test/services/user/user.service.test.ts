import { UserModel } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

// Mock logger
const loggerMock: ServiceLogger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    registerCategory: vi.fn(() => loggerMock),
    configure: vi.fn(),
    resetConfig: vi.fn(),
    createLogger: vi.fn(() => loggerMock),
    registerLogMethod: vi.fn(() => loggerMock),
    permission: vi.fn()
};

const getActor = (role: RoleEnum = RoleEnum.SUPER_ADMIN) => createUser({ role });
const getUser = (overrides = {}) => createUser({ ...overrides });

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('UserService.assignRole', () => {
    let service: UserService;
    let userModelMock: UserModel;
    const userId = getMockId('user', 'user-1');
    const actor = getActor(RoleEnum.SUPER_ADMIN);
    const input = { userId, role: RoleEnum.ADMIN };

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        service = createServiceTestInstance(UserService, userModelMock, loggerMock);
    });

    it('should assign a new role to a user (success)', async () => {
        // Arrange
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue({
            ...user,
            id: userId,
            role: RoleEnum.ADMIN
        });

        // Act
        const result = await service.assignRole({ actor, ...input });

        // Assert
        expect(result.data?.user.role).toBe(RoleEnum.ADMIN);
        expect(result.data?.user.id).toBe(userId);
        expect(result.error).toBeUndefined();
        expect(asMock(userModelMock.findById)).toHaveBeenCalledWith(userId);
        expect(asMock(userModelMock.update)).toHaveBeenCalledWith(
            { id: userId },
            { role: RoleEnum.ADMIN }
        );
    });

    it('should return NOT_FOUND if user does not exist', async () => {
        // Arrange
        asMock(userModelMock.findById).mockResolvedValue(null);

        // Act
        const result = await service.assignRole({ actor, ...input });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.error?.message).toBe('User not found');
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        const forbiddenActor = getActor(RoleEnum.ADMIN);

        // Act
        const result = await service.assignRole({ actor: forbiddenActor, ...input });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toBe('FORBIDDEN: Only super admin can assign roles');
    });

    it('should return the user unchanged if role is already assigned', async () => {
        // Arrange
        const user = getUser({ id: userId, role: RoleEnum.ADMIN });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });

        // Act
        const result = await service.assignRole({ actor, ...input });

        // Assert
        expect(result.data?.user.role).toBe(RoleEnum.ADMIN);
        expect(result.data?.user.id).toBe(userId);
        expect(asMock(userModelMock.update)).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if update fails', async () => {
        // Arrange
        const user = getUser({ id: userId, role: RoleEnum.USER });
        asMock(userModelMock.findById).mockResolvedValue({ ...user, id: userId });
        asMock(userModelMock.update).mockResolvedValue(null);

        // Act
        const result = await service.assignRole({ actor, ...input });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe('Failed to update user role');
    });
});
