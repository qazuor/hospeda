import { UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../user/user.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockUserId } from '../factories';
import { expectInfoLog } from '../utils/log-assertions';

// --- Mock helpers ---
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
const publicActor = { role: RoleEnum.GUEST };

vi.mock('../../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('Forbidden');
    })
}));

describe('user.service.getById', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow admin to view any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await UserService.getById({ id: user.id }, admin);
        expect(result.user).toEqual(user);
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });

    it('should allow user to view themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await UserService.getById({ id: user.id }, user);
        expect(result.user).toEqual(user);
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });

    it('should not allow user to view another user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden');
        });
        // Ambos usuarios son normales y tienen ids distintos
        const userToView = getMockUser({
            id: getMockUserId('user-to-view-unique'),
            role: RoleEnum.USER
        });
        const normalUser = getMockUser({
            id: getMockUserId('user-actor-unique'),
            role: RoleEnum.USER
        });
        vi.spyOn(UserModel, 'getById').mockResolvedValue(userToView);
        const result = await UserService.getById({ id: userToView.id }, normalUser);
        expect(result.user).toBeNull();
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });

    it('should not allow disabled user to view any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await UserService.getById({ id: user.id }, disabledUser);
        expect(result.user).toBeNull();
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });

    it('should return null if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        const result = await UserService.getById({ id: getMockUserId('nonexistent') }, admin);
        expect(result.user).toBeNull();
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });

    it('should not allow public actor to view any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await UserService.getById({ id: user.id }, publicActor);
        expect(result.user).toBeNull();
        expectInfoLog({}, 'getById:start');
        expectInfoLog({}, 'getById:end');
    });
});
