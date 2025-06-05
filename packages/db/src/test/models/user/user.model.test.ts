import type { NewUserInputType, UpdateUserInputType, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { UserModel } from '../../../../src/models/user/user.model';
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
        users: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseUser: UserType = {
    id: 'user-uuid' as UserId,
    userName: 'john_doe',
    password: 'hashed',
    role: RoleEnum.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'admin-uuid' as UserId,
    updatedById: 'admin-uuid' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    settings: {
        notifications: {
            enabled: true,
            allowEmails: true,
            allowSms: false,
            allowPush: false
        }
    }
    // other optional fields omitted
};

describe('UserModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns user if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseUser }]);
            const user = await UserModel.getById('user-uuid');
            expect(user).toEqual(baseUser);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const user = await UserModel.getById('not-exist');
            expect(user).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.getById('err')).rejects.toThrow(
                'Failed to get user by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByUserName', () => {
        it('returns user if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseUser }]);
            const user = await UserModel.getByUserName('john_doe');
            expect(user).toEqual(baseUser);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const user = await UserModel.getByUserName('not-exist');
            expect(user).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.getByUserName('err')).rejects.toThrow(
                'Failed to get user by userName: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns users matching name', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseUser }]);
            const users = await UserModel.getByName('john');
            expect(users).toEqual([baseUser]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const users = await UserModel.getByName('nope');
            expect(users).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.getByName('err')).rejects.toThrow(
                'Failed to get users by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created user', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseUser }]);
            const input: NewUserInputType = {
                userName: 'john_doe',
                password: 'hashed',
                role: RoleEnum.ADMIN,
                settings: {
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: false,
                        allowPush: false
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: 'admin-uuid' as UserId,
                updatedById: 'admin-uuid' as UserId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const user = await UserModel.create(input);
            expect(user).toEqual(baseUser);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                UserModel.create({
                    userName: 'fail',
                    password: 'fail',
                    role: RoleEnum.ADMIN,
                    settings: {
                        notifications: {
                            enabled: true,
                            allowEmails: true,
                            allowSms: false,
                            allowPush: false
                        }
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: 'admin-uuid' as UserId,
                    updatedById: 'admin-uuid' as UserId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                UserModel.create({
                    userName: 'fail',
                    password: 'fail',
                    role: RoleEnum.ADMIN,
                    settings: {
                        notifications: {
                            enabled: true,
                            allowEmails: true,
                            allowSms: false,
                            allowPush: false
                        }
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: 'admin-uuid' as UserId,
                    updatedById: 'admin-uuid' as UserId,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                })
            ).rejects.toThrow('Failed to create user: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated user', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseUser }]);
            const input: UpdateUserInputType = { firstName: 'Jane' };
            const user = await UserModel.update('user-uuid', input);
            expect(user).toEqual(baseUser);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const user = await UserModel.update('not-exist', { firstName: 'Jane' });
            expect(user).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.update('err', { firstName: 'fail' })).rejects.toThrow(
                'Failed to update user: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'user-uuid' }]);
            const result = await UserModel.delete('user-uuid', 'admin-uuid');
            expect(result).toEqual({ id: 'user-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await UserModel.delete('not-exist', 'admin-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.delete('err', 'admin-uuid')).rejects.toThrow(
                'Failed to delete user: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns the deleted user if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            // Simular que getById retorna el usuario base
            UserModel.getById = vi.fn().mockResolvedValue(baseUser);
            const { password, ...userWithoutPassword } = baseUser;
            const result = await UserModel.hardDelete('user-uuid');
            expect(result).toEqual(userWithoutPassword);
        });
        it('returns null if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            // Simular que getById retorna undefined
            UserModel.getById = vi.fn().mockResolvedValue(undefined);
            const result = await UserModel.hardDelete('not-exist');
            expect(result).toBeNull();
        });
        it('logs and throws on db error', async () => {
            // getById debe devolver un usuario válido para que se llegue al delete
            UserModel.getById = vi.fn().mockResolvedValue(baseUser);
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete user: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns users with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseUser }]);
            const users = await UserModel.list({ limit: 10, offset: 0 });
            expect(users).toEqual([baseUser]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const users = await UserModel.list({ limit: 10, offset: 0 });
            expect(users).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list users: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns users matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseUser }]);
            const users = await UserModel.search({ limit: 10, offset: 0 });
            expect(users).toEqual([baseUser]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const users = await UserModel.search({ limit: 10, offset: 0 });
            expect(users).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search users: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of users', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([{ count: 5 }]);
            const count = await UserModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no users', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([]);
            const count = await UserModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count users: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns user with relations', async () => {
            mockDb.query.users.findFirst.mockResolvedValueOnce({
                ...baseUser,
                role: { id: 'role-uuid', name: 'admin' }
            });
            const user = await UserModel.getWithRelations('user-uuid', { role: true });
            expect(user).toHaveProperty('role');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.users.findFirst.mockResolvedValueOnce(undefined);
            const user = await UserModel.getWithRelations('not-exist', { role: true });
            expect(user).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.users.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.getWithRelations('err', { role: true })).rejects.toThrow(
                'Failed to get user with relations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByRole', () => {
        it('returns users with given role', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseUser, role: RoleEnum.ADMIN }]);
            const users = await UserModel.getByRole(RoleEnum.ADMIN);
            expect(users).toEqual([{ ...baseUser, role: RoleEnum.ADMIN }]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const users = await UserModel.getByRole(RoleEnum.EDITOR);
            expect(users).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserModel.getByRole(RoleEnum.USER)).rejects.toThrow(
                'Failed to get users by role: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByPermission', () => {
        it('returns users with given permission', async () => {
            const joinResult = [
                {
                    users: { ...baseUser, permissions: [PermissionEnum.USER_CREATE] },
                    userPermission: {}
                }
            ];
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce(joinResult);
            const users = await UserModel.getByPermission(PermissionEnum.USER_CREATE);
            expect(users).toEqual([{ ...baseUser, permissions: [PermissionEnum.USER_CREATE] }]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const users = await UserModel.getByPermission(PermissionEnum.USER_DELETE);
            expect(users).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                UserModel.getByPermission(PermissionEnum.USER_UPDATE_PROFILE)
            ).rejects.toThrow('Failed to get users by permission: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
