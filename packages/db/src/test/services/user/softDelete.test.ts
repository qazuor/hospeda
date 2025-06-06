import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { UserService } from '../../../services/user/user.service';
import { dbLogger } from '../../../utils/logger';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
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
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'softDelete:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'softDelete:end');
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
