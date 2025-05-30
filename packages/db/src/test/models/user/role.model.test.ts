import type { NewRoleInputType, RoleId, RoleType, UpdateRoleInputType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { RoleModel } from '../../../../src/models/user/role.model';
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
        roles: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseRole: RoleType = {
    id: 'role-uuid' as RoleId,
    name: 'admin',
    description: 'Administrator',
    isBuiltIn: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'admin-uuid' as UserId,
    updatedById: 'admin-uuid' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE
    // otros campos opcionales omitidos
};

describe('RoleModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns role if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseRole }]);
            const role = await RoleModel.getById('role-uuid');
            expect(role).toEqual(baseRole);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const role = await RoleModel.getById('not-exist');
            expect(role).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.getById('err')).rejects.toThrow(
                'Failed to get role by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns role if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseRole }]);
            const role = await RoleModel.getByName('admin');
            expect(role).toEqual(baseRole);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const role = await RoleModel.getByName('not-exist');
            expect(role).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.getByName('err')).rejects.toThrow(
                'Failed to get role by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created role', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseRole }]);
            const input: NewRoleInputType = {
                name: 'admin',
                description: 'Administrator',
                isBuiltIn: true,
                isDefault: true,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const role = await RoleModel.create(input);
            expect(role).toEqual(baseRole);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                RoleModel.create({
                    name: 'fail',
                    description: 'fail',
                    isBuiltIn: false,
                    isDefault: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                RoleModel.create({
                    name: 'fail',
                    description: 'fail',
                    isBuiltIn: false,
                    isDefault: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Failed to create role: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated role', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseRole }]);
            const input: UpdateRoleInputType = { description: 'Updated' };
            const role = await RoleModel.update('role-uuid', input);
            expect(role).toEqual(baseRole);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const role = await RoleModel.update('not-exist', { description: 'Updated' });
            expect(role).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.update('err', { description: 'fail' })).rejects.toThrow(
                'Failed to update role: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'role-uuid' }]);
            const result = await RoleModel.delete('role-uuid', 'admin-uuid');
            expect(result).toEqual({ id: 'role-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await RoleModel.delete('not-exist', 'admin-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.delete('err', 'admin-uuid')).rejects.toThrow(
                'Failed to delete role: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await RoleModel.hardDelete('role-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await RoleModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete role: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns roles with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseRole }]);
            const roles = await RoleModel.list({ limit: 10, offset: 0 });
            expect(roles).toEqual([baseRole]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const roles = await RoleModel.list({ limit: 10, offset: 0 });
            expect(roles).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list roles: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns roles matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseRole }]);
            const roles = await RoleModel.search({ limit: 10, offset: 0 });
            expect(roles).toEqual([baseRole]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const roles = await RoleModel.search({ limit: 10, offset: 0 });
            expect(roles).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search roles: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of roles', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([{ count: 5 }]);
            const count = await RoleModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no roles', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([]);
            const count = await RoleModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count roles: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns role with relations', async () => {
            mockDb.query.roles.findFirst.mockResolvedValueOnce({
                ...baseRole,
                permissions: [{ id: 'perm-uuid' }],
                users: [{ id: 'user-uuid' }]
            });
            const role = await RoleModel.getWithRelations('role-uuid', {
                permissions: true,
                users: true
            });
            expect(role).toHaveProperty('permissions');
            expect(role).toHaveProperty('users');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.roles.findFirst.mockResolvedValueOnce(undefined);
            const role = await RoleModel.getWithRelations('not-exist', { permissions: true });
            expect(role).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.roles.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.getWithRelations('err', { permissions: true })).rejects.toThrow(
                'Failed to get role with relations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByPermission', () => {
        it('returns roles with given permission', async () => {
            const joinResult = [{ roles: { ...baseRole }, rRolePermission: {} }];
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce(joinResult);
            const roles = await RoleModel.getByPermission('perm-uuid');
            expect(roles).toEqual([baseRole]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const roles = await RoleModel.getByPermission('not-exist');
            expect(roles).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(RoleModel.getByPermission('err')).rejects.toThrow(
                'Failed to get roles by permission: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
