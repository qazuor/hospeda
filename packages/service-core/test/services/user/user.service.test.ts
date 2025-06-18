import { RRolePermissionModel } from '@repo/db/models/user/rRolePermission.model';
import { RUserPermissionModel } from '@repo/db/models/user/rUserPermission.model';
import { UserModel } from '@repo/db/models/user/user.model';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    type UserType,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import type { ServiceInput } from '../../../src/types';

/**
 * Mock implementation of UserModel for testing purposes.
 */
class MockUserModel extends UserModel {
    findOne = vi.fn();
    findById = vi.fn();
    update = vi.fn();
    create = vi.fn();
    findAll = vi.fn();
    count = vi.fn();
}
/**
 * Mock implementation of RUserPermissionModel for testing purposes.
 */
class MockUserPermissionModel extends RUserPermissionModel {
    findOne = vi.fn();
    create = vi.fn();
    hardDelete = vi.fn();
    findAll = vi.fn();
}
/**
 * Mock implementation of RRolePermissionModel for testing purposes.
 */
class MockRolePermissionModel extends RRolePermissionModel {
    findAll = vi.fn();
}
/**
 * Testable version of UserService exposing protected models for mocking.
 */
class TestableUserService extends UserService {
    public model: MockUserModel;
    public userPermissionModel: MockUserPermissionModel;
    public rolePermissionModel: MockRolePermissionModel;
    constructor(entityName: string) {
        super(entityName);
        this.model = new MockUserModel();
        this.userPermissionModel = new MockUserPermissionModel();
        this.rolePermissionModel = new MockRolePermissionModel();
    }
}

describe('UserService', () => {
    let service: TestableUserService;
    let mockUser: UserType;
    let actor: { id: string; role: RoleEnum; permissions: PermissionEnum[] };

    beforeEach(() => {
        service = new TestableUserService('user');
        mockUser = {
            id: 'user-1' as UserId,
            userName: 'testuser',
            password: 'Password123!',
            role: RoleEnum.USER,
            permissions: [PermissionEnum.USER_VIEW_PROFILE],
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: 'admin-1' as UserId,
            updatedById: 'admin-1' as UserId,
            deletedById: undefined,
            adminInfo: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PUBLIC,
            profile: undefined,
            settings: undefined
        };
        actor = {
            id: 'admin-1',
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.USER_UPDATE_ROLES]
        };
        service.model.findOne.mockImplementation(async (where: { email: string }) =>
            where.email === `${mockUser.userName}@mail.com` ? mockUser : null
        );
        service.model.findById.mockImplementation(async (id: string) =>
            id === mockUser.id ? mockUser : null
        );
        service.model.update.mockResolvedValue(mockUser);
        service.userPermissionModel.findOne.mockResolvedValue(null);
        service.userPermissionModel.create.mockResolvedValue({});
        service.userPermissionModel.hardDelete.mockResolvedValue(1);
        service.userPermissionModel.findAll.mockResolvedValue([
            { userId: mockUser.id, permission: PermissionEnum.USER_VIEW_PROFILE }
        ]);
        service.rolePermissionModel.findAll.mockResolvedValue([
            { role: RoleEnum.USER, permission: PermissionEnum.USER_VIEW_PROFILE }
        ]);
    });

    describe('getByEmail', () => {
        it('returns user if found', async () => {
            const input: ServiceInput<{ email: string }> = { actor, email: 'testuser@mail.com' };
            const result = await service.getByEmail(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns null if not found', async () => {
            const input: ServiceInput<{ email: string }> = { actor, email: 'notfound@mail.com' };
            const result = await service.getByEmail(input);
            expect(result.data).toBeNull();
        });
        it('returns error if email is missing', async () => {
            const input: ServiceInput<{ email: string }> = { actor, email: '' };
            const result = await service.getByEmail(input);
            expect(result.error).toBeDefined();
        });
        it('returns error if email is invalid', async () => {
            const input: ServiceInput<{ email: string }> = { actor, email: 'invalid-email' };
            const result = await service.getByEmail(input);
            expect(result.error).toBeDefined();
        });
        it('is case-insensitive if model implements it', async () => {
            service.model.findOne.mockImplementation(async (where: { email: string }) =>
                where.email.toLowerCase() === 'testuser@mail.com' ? mockUser : null
            );
            const input: ServiceInput<{ email: string }> = { actor, email: 'TestUser@Mail.com' };
            const result = await service.getByEmail(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns error if model throws', async () => {
            service.model.findOne.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            const input: ServiceInput<{ email: string }> = { actor, email: 'testuser@mail.com' };
            const result = await service.getByEmail(input);
            expect(result.error).toBeDefined();
        });
    });

    describe('setRole', () => {
        it('updates user role', async () => {
            const input: ServiceInput<{ userId: UserId; role: RoleEnum }> = {
                actor,
                userId: mockUser.id,
                role: RoleEnum.ADMIN
            };
            const result = await service.setRole(input);
            expect(result.data?.role).toBe(RoleEnum.ADMIN);
        });
        it('returns error if user not found', async () => {
            service.model.findById.mockResolvedValueOnce(null);
            const input: ServiceInput<{ userId: UserId; role: RoleEnum }> = {
                actor,
                userId: 'notfound' as UserId,
                role: RoleEnum.ADMIN
            };
            const result = await service.setRole(input);
            expect(result.error).toBeDefined();
        });
        it('returns error if role is invalid', async () => {
            // Attempts to assign an invalid value using type assertion to force the error
            const input = { actor, userId: mockUser.id, role: 'INVALID' as RoleEnum };
            const result = await service.setRole(input);
            expect(result.error).toBeDefined();
        });
        it('no-ops if assigning the same role', async () => {
            const input: ServiceInput<{ userId: UserId; role: RoleEnum }> = {
                actor,
                userId: mockUser.id,
                role: RoleEnum.USER
            };
            const result = await service.setRole(input);
            expect(result.data?.role).toBe(RoleEnum.USER);
        });
        it('returns error if model throws', async () => {
            service.model.findById.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            const input: ServiceInput<{ userId: UserId; role: RoleEnum }> = {
                actor,
                userId: mockUser.id,
                role: RoleEnum.ADMIN
            };
            const result = await service.setRole(input);
            expect(result.error).toBeDefined();
        });
    });

    describe('addPermission', () => {
        it('adds permission if not present', async () => {
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.addPermission(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns error if user not found', async () => {
            service.model.findById.mockResolvedValueOnce(null);
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: 'notfound' as UserId,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.addPermission(input);
            expect(result.error).toBeDefined();
        });
        it('does not duplicate permission if already assigned', async () => {
            service.userPermissionModel.findOne.mockResolvedValueOnce({
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            });
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.addPermission(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns error if permission is invalid', async () => {
            // Intenta asignar un valor inválido usando type assertion para forzar el error
            const input = { actor, userId: mockUser.id, permission: 'INVALID' as PermissionEnum };
            const result = await service.addPermission(input);
            expect(result.error).toBeDefined();
        });
        it('returns error if model throws', async () => {
            service.model.findById.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.addPermission(input);
            expect(result.error).toBeDefined();
        });
    });

    describe('removePermission', () => {
        it('removes permission if present', async () => {
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.removePermission(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns error if user not found', async () => {
            service.model.findById.mockResolvedValueOnce(null);
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: 'notfound' as UserId,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.removePermission(input);
            expect(result.error).toBeDefined();
        });
        it('is idempotent if permission not assigned', async () => {
            service.userPermissionModel.findOne.mockResolvedValueOnce(null);
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.removePermission(input);
            expect(result.data).toEqual(mockUser);
        });
        it('returns error if permission is invalid', async () => {
            // Intenta asignar un valor inválido usando type assertion para forzar el error
            const input = { actor, userId: mockUser.id, permission: 'INVALID' as PermissionEnum };
            const result = await service.removePermission(input);
            expect(result.error).toBeDefined();
        });
        it('returns error if model throws', async () => {
            service.model.findById.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            const input: ServiceInput<{ userId: UserId; permission: PermissionEnum }> = {
                actor,
                userId: mockUser.id,
                permission: PermissionEnum.USER_DELETE
            };
            const result = await service.removePermission(input);
            expect(result.error).toBeDefined();
        });
    });

    describe('getPermissions', () => {
        it('returns merged permissions (direct + role)', async () => {
            const input: ServiceInput<{ userId: UserId }> = { actor, userId: mockUser.id };
            const result = await service.getPermissions(input);
            expect(result.data).toContain(PermissionEnum.USER_VIEW_PROFILE);
        });
        it('returns error if user not found', async () => {
            service.model.findById.mockResolvedValueOnce(null);
            const input: ServiceInput<{ userId: UserId }> = { actor, userId: 'notfound' as UserId };
            const result = await service.getPermissions(input);
            expect(result.error).toBeDefined();
        });
        it('returns empty array if user has no permissions', async () => {
            service.userPermissionModel.findAll.mockResolvedValueOnce([]);
            service.rolePermissionModel.findAll.mockResolvedValueOnce([]);
            const input: ServiceInput<{ userId: UserId }> = { actor, userId: mockUser.id };
            const result = await service.getPermissions(input);
            expect(result.data).toEqual([]);
        });
        it('deduplicates permissions from direct and role', async () => {
            service.userPermissionModel.findAll.mockResolvedValueOnce([
                { userId: mockUser.id, permission: PermissionEnum.USER_VIEW_PROFILE },
                { userId: mockUser.id, permission: PermissionEnum.USER_DELETE }
            ]);
            service.rolePermissionModel.findAll.mockResolvedValueOnce([
                { role: RoleEnum.USER, permission: PermissionEnum.USER_VIEW_PROFILE },
                { role: RoleEnum.USER, permission: PermissionEnum.USER_UPDATE_PROFILE }
            ]);
            const input: ServiceInput<{ userId: UserId }> = { actor, userId: mockUser.id };
            const result = await service.getPermissions(input);
            expect(result.data).toContain(PermissionEnum.USER_VIEW_PROFILE);
            expect(result.data).toContain(PermissionEnum.USER_DELETE);
            expect(result.data).toContain(PermissionEnum.USER_UPDATE_PROFILE);
            expect(result.data?.filter((p) => p === PermissionEnum.USER_VIEW_PROFILE).length).toBe(
                1
            );
        });
        it('returns error if model throws', async () => {
            service.model.findById.mockImplementationOnce(() => {
                throw new Error('DB error');
            });
            const input: ServiceInput<{ userId: UserId }> = { actor, userId: mockUser.id };
            const result = await service.getPermissions(input);
            expect(result.error).toBeDefined();
        });
    });

    describe('generateSlug', () => {
        it('generates a slug from name', async () => {
            const slug = await service.generateSlug('', 'John Doe', async () => false);
            expect(slug).toBe('john-doe');
        });
        it('appends suffix if slug exists', async () => {
            const slug = await service.generateSlug('', 'John Doe', async (s) => s === 'john-doe');
            expect(slug).toBe('john-doe-2');
        });
        it('throws if name is empty', async () => {
            await expect(service.generateSlug('', '', async () => false)).rejects.toThrow();
        });
        it('slug handles special characters and spaces', async () => {
            const slug = await service.generateSlug('', '  Jöhn   Dóe!@# ', async () => false);
            expect(slug).toBe('john-doe');
        });
        it('slug handles long names', async () => {
            const longName = 'a'.repeat(100);
            const slug = await service.generateSlug('', longName, async () => false);
            expect(slug.startsWith('a')).toBe(true);
            expect(slug.length).toBeGreaterThan(10);
        });
        it('slug increments suffix for multiple duplicates', async () => {
            let call = 0;
            const slug = await service.generateSlug('', 'John Doe', async () => {
                call++;
                return call < 4; // first 3 are taken
            });
            expect(slug).toBe('john-doe-4');
        });
    });
});
