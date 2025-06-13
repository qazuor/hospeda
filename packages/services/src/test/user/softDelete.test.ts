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
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockUserId('user-1'),
    updatedById: getMockUserId('user-1'),
    ...overrides
});
const admin = getMockUser({ id: getMockUserId('admin-1'), role: RoleEnum.ADMIN });
const user = getMockUser({ id: getMockUserId('user-2'), role: RoleEnum.USER });
const disabledUser = getMockUser({
    id: getMockUserId('user-3'),
    role: RoleEnum.USER,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});

const validInput = { id: user.id };

describe('user.service.softDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to soft-delete a user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'update').mockImplementation(async (_id, input) => ({
            ...user,
            ...input
        }));
        const result = await UserService.softDelete(validInput, admin);
        expect(result.user.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        expect(result.user).not.toHaveProperty('password');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'softDelete:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'softDelete:end');
    });

    it('should not allow admin to soft-delete themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(UserService.softDelete({ id: admin.id }, admin)).rejects.toThrow(
            'Admin cannot soft-delete themselves'
        );
    });

    it('should not allow normal user to soft-delete', async () => {
        await expect(UserService.softDelete(validInput, user)).rejects.toThrow(
            'Only admin can soft-delete users'
        );
    });

    it('should not allow disabled user to soft-delete', async () => {
        await expect(UserService.softDelete(validInput, disabledUser)).rejects.toThrow(
            'Disabled users cannot soft-delete users'
        );
    });

    it('should not allow soft-deleting an already disabled user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(disabledUser);
        await expect(UserService.softDelete({ id: disabledUser.id }, admin)).rejects.toThrow(
            'User is already disabled'
        );
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(UserService.softDelete(validInput, admin)).rejects.toThrow('User not found');
    });
});
