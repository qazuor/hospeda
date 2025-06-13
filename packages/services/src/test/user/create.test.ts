import { UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../user/user.service';
import { getMockUserId } from '../factories/userFactory';

const getMockUser = (
    overrides: Partial<UserType & { email?: string }> = {}
): UserType & { email?: string } => ({
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
            id: getMockUserId('user-99'),
            password: 'hashed',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockUserId('admin-1'),
            updatedById: getMockUserId('admin-1')
        }));
        const result = await UserService.create(validInput, admin);
        expect(result.user.userName).toBe(validInput.userName);
        expect(result.user.role).toBe(validInput.role);
        expect(result.user.email).toBe(validInput.email);
        expect(result.user).not.toHaveProperty('password');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:end');
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
