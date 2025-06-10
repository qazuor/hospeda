import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { UserService } from '../../../services/user/user.service';

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

const validInput = {
    id: user.id,
    userName: 'updateduser',
    email: 'updated@email.com'
};

describe('user.service.update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to update any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'getByEmail').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'update').mockImplementation(async (_id, input) => ({
            ...user,
            ...input
        }));
        const result = await UserService.update(validInput, admin);
        expect(result.user.userName).toBe(validInput.userName);
        expect(result.user.email).toBe(validInput.email);
        expect(result.user).not.toHaveProperty('password');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'update:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'update:end');
    });

    it('should allow user to update themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'getByEmail').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'update').mockImplementation(async (_id, input) => ({
            ...user,
            ...input
        }));
        const result = await UserService.update(validInput, user);
        expect(result.user.userName).toBe(validInput.userName);
        expect(result.user.email).toBe(validInput.email);
    });

    it('should not allow user to update another user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(
            UserService.update({ id: admin.id, userName: 'hacker' }, user)
        ).rejects.toThrow('Only admin or the user themselves can update');
    });

    it('should not allow disabled user to update', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        await expect(UserService.update(validInput, disabledUser)).rejects.toThrow(
            'Disabled users cannot update users'
        );
    });

    it('should not allow duplicate userName', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(
            getMockUser({ userName: validInput.userName })
        );
        await expect(UserService.update(validInput, admin)).rejects.toThrow(
            'User name already exists'
        );
    });

    it('should not allow duplicate email', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'getByUserName').mockResolvedValue(undefined);
        vi.spyOn(UserModel, 'getByEmail').mockResolvedValue(
            getMockUser({ email: validInput.email })
        );
        await expect(UserService.update(validInput, admin)).rejects.toThrow('Email already exists');
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(UserService.update(validInput, admin)).rejects.toThrow('User not found');
    });
});
