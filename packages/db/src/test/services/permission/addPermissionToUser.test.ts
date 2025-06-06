import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    type UserType
} from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { PermissionService } from '../../../services/permission/permission.service';
import { dbLogger } from '../../../utils/logger';

const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: 'user-1' as UserId,
    userName: 'testuser',
    password: 'secret',
    role: RoleEnum.USER,
    permissions: [],
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1' as UserId,
    updatedById: 'user-1' as UserId,
    ...overrides
});
const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
const user = getMockUser({ id: 'user-2' as UserId, role: RoleEnum.USER });
const userWithPerm = getMockUser({
    id: 'user-3' as UserId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_CREATE]
});
const adminDisabled = getMockUser({
    id: 'admin-2' as UserId,
    role: RoleEnum.ADMIN,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});

const validInput = { id: user.id, permission: PermissionEnum.USER_CREATE };

describe('permission.service.addPermissionToUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to add permission to a user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const { password, ...userWithPermOut } = {
            ...user,
            permissions: [PermissionEnum.USER_CREATE]
        };
        vi.spyOn(UserModel, 'addPermission').mockResolvedValue(userWithPermOut);
        const result = await PermissionService.addPermissionToUser(validInput, admin);
        expect(result.user).toBeDefined();
        expect(result.user?.id).toBe(user.id);
        expect(result.user?.permissions).toContain(PermissionEnum.USER_CREATE);
        expect(result.user).not.toHaveProperty('password');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'addPermissionToUser:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'addPermissionToUser:end');
    });

    it('should not allow admin to add duplicate permission', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(userWithPerm);
        await expect(
            PermissionService.addPermissionToUser(
                { id: userWithPerm.id, permission: PermissionEnum.USER_CREATE },
                admin
            )
        ).rejects.toThrow('User already has this permission');
    });

    it('should not allow admin to add permission to themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        await expect(
            PermissionService.addPermissionToUser(
                { id: admin.id, permission: PermissionEnum.USER_CREATE },
                admin
            )
        ).rejects.toThrow('Admin cannot add permission to themselves');
    });

    it('should not allow normal user to add permission', async () => {
        await expect(PermissionService.addPermissionToUser(validInput, user)).rejects.toThrow(
            'Only admin can add permissions'
        );
    });

    it('should not allow disabled admin to add permission', async () => {
        await expect(
            PermissionService.addPermissionToUser(validInput, adminDisabled)
        ).rejects.toThrow('Disabled users cannot add permissions');
    });

    it('should throw if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        await expect(PermissionService.addPermissionToUser(validInput, admin)).rejects.toThrow(
            'User not found'
        );
    });

    it('should throw if addPermission fails in the model', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        vi.spyOn(UserModel, 'addPermission').mockResolvedValue(undefined);
        await expect(PermissionService.addPermissionToUser(validInput, admin)).rejects.toThrow(
            'Failed to add permission'
        );
    });
});
