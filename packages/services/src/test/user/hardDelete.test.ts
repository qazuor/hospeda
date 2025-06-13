import { UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../user/user.service';
import { getMockUserId } from '../factories/userFactory';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: getMockUserId('user-1'),
    userName: 'testuser',
    password: 'secret',
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockUserId('user-1'),
    updatedById: getMockUserId('user-1'),
    ...overrides
});
const admin = getMockUser({ id: getMockUserId('admin-1'), role: RoleEnum.ADMIN });
const user = getMockUser({ id: getMockUserId('user-2'), role: RoleEnum.USER });
const adminDisabled = getMockUser({
    id: getMockUserId('admin-2'),
    role: RoleEnum.ADMIN,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});

const validInput = { id: user.id };

describe('user.service.hardDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to hard-delete a user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const { password, ...userWithoutPassword } = user;
        vi.spyOn(UserModel, 'hardDelete').mockResolvedValue(userWithoutPassword);
        const result = await UserService.hardDelete(validInput, admin);
        expect(result.user).toBeDefined();
        expect(result.user?.id).toBe(user.id);
        expect(result.user).not.toHaveProperty('password');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'hardDelete:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'hardDelete:end');
    });

    it('should not allow admin to hard-delete themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(UserService.hardDelete({ id: admin.id }, admin)).rejects.toThrow(
            'Admin cannot hard-delete themselves'
        );
    });

    it('should not allow normal user to hard-delete', async () => {
        await expect(UserService.hardDelete(validInput, user)).rejects.toThrow(
            'Only admin can hard-delete users'
        );
    });

    it('should not allow disabled user to hard-delete', async () => {
        await expect(UserService.hardDelete(validInput, adminDisabled)).rejects.toThrow(
            'Disabled users cannot hard-delete users'
        );
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(UserService.hardDelete(validInput, admin)).rejects.toThrow('User not found');
    });

    it('should throw if hardDelete fails in the model', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'hardDelete').mockResolvedValue(null);
        await expect(UserService.hardDelete(validInput, admin)).rejects.toThrow(
            'Failed to hard-delete user'
        );
    });
});
