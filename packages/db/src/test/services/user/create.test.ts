import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { UserService } from '../../../services/user/user.service';
import { dbLogger } from '../../../utils/logger';

const getMockUser = (
    overrides: Partial<UserType & { email?: string }> = {}
): UserType & { email?: string } => ({
    id: 'user-1' as UserId,
    userName: 'testuser',
    password: '',
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    ...overrides
});
const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
const user = getMockUser({ id: 'user-2' as UserId, role: RoleEnum.USER });
const disabledUser = getMockUser({
    id: 'user-3' as UserId,
    role: RoleEnum.ADMIN,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});

const validInput = {
    userName: 'newuser',
    password: 'supersecret',
    role: RoleEnum.USER,
    email: 'newuser@email.com'
};

describe('user.service.create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to create a user', async () => {
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'getByEmail').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'create').mockImplementation(async (input) => ({
            ...input,
            id: 'user-99' as UserId,
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: 'admin-1' as UserId,
            updatedById: 'admin-1' as UserId
        }));
        const result = await UserService.create(validInput, admin);
        expect(result.user.userName).toBe(validInput.userName);
        expect(result.user.role).toBe(validInput.role);
        expect(result.user.email).toBe(validInput.email);
        expect(result.user).not.toHaveProperty('password');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:end');
    });

    it('should not allow normal user to create a user', async () => {
        await expect(UserService.create(validInput, user)).rejects.toThrow(
            'Only admin can create users'
        );
    });

    it('should not allow disabled admin to create a user', async () => {
        await expect(UserService.create(validInput, disabledUser)).rejects.toThrow(
            'Disabled users cannot create users'
        );
    });

    it('should not allow duplicate userName', async () => {
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(
            getMockUser({ userName: validInput.userName })
        );
        await expect(UserService.create(validInput, admin)).rejects.toThrow(
            'User name already exists'
        );
    });

    it('should not allow duplicate email', async () => {
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'getByEmail').mockResolvedValue(
            getMockUser({ email: validInput.email })
        );
        await expect(UserService.create(validInput, admin)).rejects.toThrow('Email already exists');
    });
});
