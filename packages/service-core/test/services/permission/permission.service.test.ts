import type { RRolePermissionModel } from '@repo/db/models/user/rRolePermission.model';
import type { RUserPermissionModel } from '@repo/db/models/user/rUserPermission.model';
import type { UserModel } from '@repo/db/models/user/user.model';
import type { RolePermissionAssignmentType, UserPermissionAssignmentType } from '@repo/types';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import type { Actor } from '../../../src/types';

// Mock models with proper types
const mockUserModel = {
    findOne: vi.fn(),
    findById: vi.fn()
} as unknown as UserModel;

const mockUserPermissionModel = {
    findOne: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    hardDelete: vi.fn()
} as unknown as RUserPermissionModel;

const mockRolePermissionModel = {
    findOne: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    hardDelete: vi.fn()
} as unknown as RRolePermissionModel;

// Mock the models in the PermissionService
vi.mock('@repo/db/models/user/user.model', () => ({
    UserModel: vi.fn().mockImplementation(() => mockUserModel)
}));

vi.mock('@repo/db/models/user/rUserPermission.model', () => ({
    RUserPermissionModel: vi.fn().mockImplementation(() => mockUserPermissionModel)
}));

vi.mock('@repo/db/models/user/rRolePermission.model', () => ({
    RRolePermissionModel: vi.fn().mockImplementation(() => mockRolePermissionModel)
}));

describe('PermissionService', () => {
    let service: PermissionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PermissionService();

        // Setup default mock implementations
        vi.spyOn(mockUserModel, 'findOne').mockResolvedValue({
            id: 'user1' as UserId,
            userName: 'testUser',
            password: 'hashedPassword',
            role: RoleEnum.USER,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            isActive: true,
            email: 'test@example.com',
            createdById: 'admin' as UserId,
            updatedById: 'admin' as UserId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PUBLIC
        } as UserType);

        vi.spyOn(mockUserPermissionModel, 'findOne').mockResolvedValue(null);
        vi.spyOn(mockRolePermissionModel, 'findOne').mockResolvedValue(null);
    });

    describe('getUserPermissions', () => {
        it('should return user permissions when authorized', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'admin', role: RoleEnum.ADMIN, permissions: [] };

            vi.spyOn(mockUserPermissionModel, 'findAll').mockResolvedValue([
                { permission: PermissionEnum.USER_READ_ALL },
                { permission: PermissionEnum.USER_CREATE }
            ] as UserPermissionAssignmentType[]);

            const result = await service.getUserPermissions({ actor, userId });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual([PermissionEnum.USER_READ_ALL, PermissionEnum.USER_CREATE]);
        });

        it('should return error when unauthorized', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'user2', role: RoleEnum.USER, permissions: [] };

            const result = await service.getUserPermissions({ actor, userId });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('FORBIDDEN');
        });
    });

    describe('addPermissionToUser', () => {
        it('should add permission when authorized', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'admin', role: RoleEnum.ADMIN, permissions: [] };
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findOne').mockResolvedValue(null);
            vi.spyOn(mockUserPermissionModel, 'create').mockResolvedValue({
                userId,
                permission
            } as UserPermissionAssignmentType);

            const result = await service.addPermissionToUser({ actor, userId, permission });

            expect(result.error).toBeUndefined();
            expect(mockUserPermissionModel.create).toHaveBeenCalledWith({ userId, permission });
        });

        it('should return error when permission already exists', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'admin', role: RoleEnum.ADMIN, permissions: [] };
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findOne').mockResolvedValue({
                userId,
                permission
            } as UserPermissionAssignmentType);

            const result = await service.addPermissionToUser({ actor, userId, permission });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('ALREADY_EXISTS');
        });
    });

    describe('removePermissionFromUser', () => {
        it('should remove permission when authorized', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'admin', role: RoleEnum.ADMIN, permissions: [] };
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findOne').mockResolvedValue({
                userId,
                permission
            } as UserPermissionAssignmentType);
            vi.spyOn(mockUserPermissionModel, 'hardDelete').mockResolvedValue(1);

            const result = await service.removePermissionFromUser({ actor, userId, permission });

            expect(result.error).toBeUndefined();
            expect(mockUserPermissionModel.hardDelete).toHaveBeenCalledWith({ userId, permission });
        });

        it('should return error when permission does not exist', async () => {
            const userId = 'user1' as UserId;
            const actor: Actor = { id: 'admin', role: RoleEnum.ADMIN, permissions: [] };
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findOne').mockResolvedValue(null);

            const result = await service.removePermissionFromUser({ actor, userId, permission });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('getEffectivePermissions', () => {
        it('should return combined permissions from direct assignments and role', async () => {
            const userId = 'user1' as UserId;

            vi.spyOn(mockUserPermissionModel, 'findAll').mockResolvedValue([
                { permission: PermissionEnum.USER_CREATE }
            ] as UserPermissionAssignmentType[]);

            vi.spyOn(mockRolePermissionModel, 'findAll').mockResolvedValue([
                { permission: PermissionEnum.USER_READ_ALL }
            ] as RolePermissionAssignmentType[]);

            const permissions = await service.getEffectivePermissions(userId);

            expect(permissions).toEqual([PermissionEnum.USER_CREATE, PermissionEnum.USER_READ_ALL]);
        });
    });

    describe('userHasPermission', () => {
        it('should return true when user has permission', async () => {
            const userId = 'user1' as UserId;
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findAll').mockResolvedValue([
                { permission: PermissionEnum.USER_CREATE }
            ] as UserPermissionAssignmentType[]);

            vi.spyOn(mockRolePermissionModel, 'findAll').mockResolvedValue([]);

            const hasPermission = await service.userHasPermission(userId, permission);

            expect(hasPermission).toBe(true);
        });

        it('should return false when user does not have permission', async () => {
            const userId = 'user1' as UserId;
            const permission = PermissionEnum.USER_CREATE;

            vi.spyOn(mockUserPermissionModel, 'findAll').mockResolvedValue([]);
            vi.spyOn(mockRolePermissionModel, 'findAll').mockResolvedValue([]);

            const hasPermission = await service.userHasPermission(userId, permission);

            expect(hasPermission).toBe(false);
        });
    });
});
