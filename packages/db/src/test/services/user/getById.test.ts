import { LifecycleStatusEnum, RoleEnum, type UserId, type UserType } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../../models/user/user.model';
import { getById } from '../../../services/user/user.service';
import { dbLogger } from '../../../utils/logger';

// --- Mock helpers ---
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
        const result = await getById({ id: user.id }, admin);
        expect(result.user).toEqual(user);
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });

    it('should allow user to view themselves', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await getById({ id: user.id }, user);
        expect(result.user).toEqual(user);
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });

    it('should not allow user to view another user without permission', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(admin);
        const result = await getById({ id: admin.id }, user);
        expect(result.user).toBeNull();
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });

    it('should not allow disabled user to view any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await getById({ id: user.id }, disabledUser);
        expect(result.user).toBeNull();
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });

    it('should return null if user not found', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(undefined);
        const result = await getById({ id: 'nonexistent' as UserId }, admin);
        expect(result.user).toBeNull();
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });

    it('should not allow public actor to view any user', async () => {
        vi.spyOn(UserModel, 'getById').mockResolvedValue(user);
        const result = await getById({ id: user.id }, publicActor);
        expect(result.user).toBeNull();
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:start');
        expect(dbLogger.info).toHaveBeenCalledWith(expect.anything(), 'getById:end');
    });
});
