import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { hardDelete } from '../../../services/user/user.service';
import { dbLogger } from '../../../utils/logger';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: 'user-1' as UserId,
    userName: 'testuser',
    password: 'secret',
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
const adminDisabled = getMockUser({
    id: 'admin-2' as UserId,
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
        const result = await hardDelete(validInput, admin);
        expect(result.user).toBeDefined();
        expect(result.user?.id).toBe(user.id);
        expect(result.user).not.toHaveProperty('password');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'hardDelete:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'hardDelete:end');
    });

    it('should not allow admin to hard-delete themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(hardDelete({ id: admin.id }, admin)).rejects.toThrow(
            'Admin cannot hard-delete themselves'
        );
    });

    it('should not allow normal user to hard-delete', async () => {
        await expect(hardDelete(validInput, user)).rejects.toThrow(
            'Only admin can hard-delete users'
        );
    });

    it('should not allow disabled user to hard-delete', async () => {
        await expect(hardDelete(validInput, adminDisabled)).rejects.toThrow(
            'Disabled users cannot hard-delete users'
        );
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(hardDelete(validInput, admin)).rejects.toThrow('User not found');
    });

    it('should throw if hardDelete fails in the model', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'hardDelete').mockResolvedValue(null);
        await expect(hardDelete(validInput, admin)).rejects.toThrow('Failed to hard-delete user');
    });
});
