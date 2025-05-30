import type {
    NewPermissionInputType,
    PermissionId,
    PermissionType,
    RoleId,
    RoleType,
    UpdatePermissionInputType,
    UserId,
    UserType
} from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { PermissionModel } from '../../../../src/models/user/permission.model';
import { dbLogger } from '../../../../src/utils/logger';

vi.mock('../../../../src/utils/logger');
vi.mock('../../../../src/client');

const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    query: {
        permissions: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const basePermission: PermissionType = {
    id: 'perm-uuid' as PermissionId,
    name: 'edit_post',
    description: 'Edit posts',
    isBuiltIn: true,
    isDeprecated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'admin-uuid' as UserId,
    updatedById: 'admin-uuid' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

const baseRole: RoleType = {
    id: 'role-uuid' as RoleId,
    name: 'admin',
    description: 'Administrator',
    isBuiltIn: true,
    isDefault: true,
    isDeprecated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'admin-uuid' as UserId,
    updatedById: 'admin-uuid' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

const baseUser: UserType = {
    id: 'user-uuid' as UserId,
    userName: 'testuser',
    password: 'secret',
    firstName: 'Test',
    lastName: 'User',
    birthDate: new Date(),
    emailVerified: true,
    phoneVerified: false,
    contactInfo: undefined,
    location: undefined,
    socialNetworks: undefined,
    roleId: 'role-uuid' as RoleId,
    profile: undefined,
    settings: {
        notifications: { enabled: true, allowEmails: true, allowSms: false, allowPush: false }
    },
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'admin-uuid' as UserId,
    updatedById: 'admin-uuid' as UserId,
    deletedAt: undefined,
    deletedById: undefined
};

describe('PermissionModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns permission if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...basePermission }]);
            const perm = await PermissionModel.getById('perm-uuid');
            expect(perm).toEqual(basePermission);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const perm = await PermissionModel.getById('not-exist');
            expect(perm).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.getById('err')).rejects.toThrow(
                'Failed to get permission by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns permission if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...basePermission }]);
            const perm = await PermissionModel.getByName('edit_post');
            expect(perm).toEqual(basePermission);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const perm = await PermissionModel.getByName('not-exist');
            expect(perm).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.getByName('err')).rejects.toThrow(
                'Failed to get permission by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created permission', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...basePermission }]);
            const input: NewPermissionInputType = {
                name: 'edit_post',
                description: 'Edit posts',
                isBuiltIn: true,
                isDeprecated: false,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const perm = await PermissionModel.create(input);
            expect(perm).toEqual(basePermission);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                PermissionModel.create({
                    name: 'fail',
                    description: 'fail',
                    isBuiltIn: false,
                    isDeprecated: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                PermissionModel.create({
                    name: 'fail',
                    description: 'fail',
                    isBuiltIn: false,
                    isDeprecated: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Failed to create permission: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated permission', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...basePermission }]);
            const input: UpdatePermissionInputType = { description: 'Updated' };
            const perm = await PermissionModel.update('perm-uuid', input);
            expect(perm).toEqual(basePermission);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const perm = await PermissionModel.update('not-exist', { description: 'Updated' });
            expect(perm).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.update('err', { description: 'fail' })).rejects.toThrow(
                'Failed to update permission: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'perm-uuid' }]);
            const result = await PermissionModel.delete('perm-uuid', 'admin-uuid');
            expect(result).toEqual({ id: 'perm-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await PermissionModel.delete('not-exist', 'admin-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.delete('err', 'admin-uuid')).rejects.toThrow(
                'Failed to delete permission: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await PermissionModel.hardDelete('perm-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await PermissionModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete permission: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns permissions with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...basePermission }]);
            const perms = await PermissionModel.list({ limit: 10, offset: 0 });
            expect(perms).toEqual([basePermission]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const perms = await PermissionModel.list({ limit: 10, offset: 0 });
            expect(perms).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list permissions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns permissions matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...basePermission }]);
            const perms = await PermissionModel.search({ limit: 10, offset: 0 });
            expect(perms).toEqual([basePermission]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const perms = await PermissionModel.search({ limit: 10, offset: 0 });
            expect(perms).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search permissions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of permissions', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([{ count: 5 }]);
            const count = await PermissionModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no permissions', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([]);
            const count = await PermissionModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count permissions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns permission with relations', async () => {
            mockDb.query.permissions.findFirst.mockResolvedValueOnce({
                ...basePermission,
                roles: [{ ...baseRole }],
                users: [{ ...baseUser }]
            });
            const perm = await PermissionModel.getWithRelations('perm-uuid', {
                roles: true,
                users: true
            });
            expect(perm).toHaveProperty('roles');
            expect(perm).toHaveProperty('users');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.permissions.findFirst.mockResolvedValueOnce(undefined);
            const perm = await PermissionModel.getWithRelations('not-exist', { roles: true });
            expect(perm).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.permissions.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.getWithRelations('err', { roles: true })).rejects.toThrow(
                'Failed to get permission with relations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByRole', () => {
        it('returns permissions for given role', async () => {
            const joinResult = [{ permissions: { ...basePermission }, rRolePermission: {} }];
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce(joinResult);
            const perms = await PermissionModel.getByRole('role-uuid');
            expect(perms).toEqual([basePermission]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const perms = await PermissionModel.getByRole('not-exist');
            expect(perms).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.getByRole('err')).rejects.toThrow(
                'Failed to get permissions by role: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByUser', () => {
        it('returns permissions for given user (direct and via roles)', async () => {
            const direct = [{ permissions: { ...basePermission }, rUserPermission: {} }];
            const viaRoles = [{ permissions: { ...basePermission }, rRolePermission: {} }];
            mockDb.select.mockReturnThis().mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce(direct).mockReturnValueOnce(viaRoles);
            const perms = await PermissionModel.getByUser('user-uuid');
            expect(perms).toEqual([basePermission]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]).mockReturnValueOnce([]);
            const perms = await PermissionModel.getByUser('not-exist');
            expect(perms).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PermissionModel.getByUser('err')).rejects.toThrow(
                'Failed to get permissions by user: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
