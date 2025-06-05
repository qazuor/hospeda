import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { restore } from '../../../services/user/user.service';
import { dbLogger } from '../../../utils/logger';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: 'user-1' as UserId,
    userName: 'testuser',
    password: '',
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    ...overrides
});
const admin = getMockUser({
    id: 'admin-1' as UserId,
    role: RoleEnum.ADMIN,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const user = getMockUser({
    id: 'user-2' as UserId,
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const activeUser = getMockUser({
    id: 'user-4' as UserId,
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const disabledUser = getMockUser({
    id: 'user-3' as UserId,
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const activeUserForPerm = getMockUser({
    id: 'user-2' as UserId,
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
        const result = await restore(validInput, admin);
        expect(result.user.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.user).not.toHaveProperty('password');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'restore:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'restore:end');
    });

    it('should not allow admin to restore themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(restore({ id: admin.id }, admin)).rejects.toThrow(
            'Admin cannot restore themselves'
        );
    });

    it('should not allow normal user to restore', async () => {
        await expect(restore(validInput, activeUserForPerm)).rejects.toThrow(
            'Only admin can restore users'
        );
    });

    it('should not allow disabled user to restore', async () => {
        await expect(restore(validInput, disabledUser)).rejects.toThrow(
            'Disabled users cannot restore users'
        );
    });

    it('should not allow restoring an already active user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(activeUser);
        await expect(restore({ id: activeUser.id }, admin)).rejects.toThrow(
            'User is already active'
        );
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(restore(validInput, admin)).rejects.toThrow('User not found');
    });
});
