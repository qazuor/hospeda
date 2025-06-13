import { UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../user/user.service';
import { getMockUserId } from '../factories/userFactory';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: getMockUserId('user-1'),
    userName: 'testuser',
    password: '',
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockUserId('user-1'),
    updatedById: getMockUserId('user-1'),
    ...overrides
});
const admin = getMockUser({
    id: getMockUserId('admin-1'),
    role: RoleEnum.ADMIN,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const user = getMockUser({
    id: getMockUserId('user-2'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const activeUser = getMockUser({
    id: getMockUserId('user-4'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const disabledUser = getMockUser({
    id: getMockUserId('user-3'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const activeUserForPerm = getMockUser({
    id: getMockUserId('user-2'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});

const validInput = { id: user.id };

describe('user.service.restore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to restore a user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'update').mockImplementation(async (_id, input) => ({
            ...user,
            ...input,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        }));
        const result = await UserService.restore(validInput, admin);
        expect(result.user.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.user).not.toHaveProperty('password');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'restore:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'restore:end');
    });

    it('should not allow admin to restore themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(UserService.restore({ id: admin.id }, admin)).rejects.toThrow(
            'Admin cannot restore themselves'
        );
    });

    it('should not allow normal user to restore', async () => {
        await expect(UserService.restore(validInput, activeUserForPerm)).rejects.toThrow(
            'Only admin can restore users'
        );
    });

    it('should not allow disabled user to restore', async () => {
        await expect(UserService.restore(validInput, disabledUser)).rejects.toThrow(
            'Disabled users cannot restore users'
        );
    });

    it('should not allow restoring an already active user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(activeUser);
        await expect(UserService.restore({ id: activeUser.id }, admin)).rejects.toThrow(
            'User is already active'
        );
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(UserService.restore(validInput, admin)).rejects.toThrow('User not found');
    });
});
