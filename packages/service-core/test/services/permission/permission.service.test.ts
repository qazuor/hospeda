import { PermissionEnum, RoleEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission/permission.service';
import type { Actor } from '../../../src/types';
import { ServiceErrorCode } from '../../../src/types';

// Mocks deben estar antes de vi.mock
const mockDb = {
    transaction: vi.fn(),
    delete: vi.fn(() => ({
        where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve({ rows: [], rowCount: 0 }))
        }))
    })),
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([]))
            }))
        }))
    })),
    insert: vi.fn(() => ({
        values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve({ rows: [], rowCount: 0 }))
        }))
    }))
};

const mockUserModel = {
    findOne: vi.fn((params) => {
        if (params?.id === 'user1') {
            return Promise.resolve({ id: 'user1', role: RoleEnum.USER });
        }
        return Promise.resolve(null);
    })
};

const mockUserPermissionModel = {
    findAll: vi.fn((params) => {
        if (params?.userId === 'user1') {
            return Promise.resolve([{ userId: 'user1', permission: PermissionEnum.USER_CREATE }]);
        }
        return Promise.resolve([]);
    }),
    findOne: vi.fn(),
    create: vi.fn((data) => Promise.resolve(data)),
    hardDelete: vi.fn(() => Promise.resolve({ rows: [], rowCount: 1 }))
};

const mockRolePermissionModel = {
    findAll: vi.fn((params) => {
        if (params?.role === RoleEnum.USER) {
            return Promise.resolve([
                { role: RoleEnum.USER, permission: PermissionEnum.USER_DELETE }
            ]);
        }
        return Promise.resolve([]);
    }),
    create: vi.fn((data) => Promise.resolve(data)),
    hardDelete: vi.fn((params, _tx) => {
        if (params.role === RoleEnum.USER) {
            return Promise.resolve({ rows: [], rowCount: 1 });
        }
        throw new Error('DB Error');
    })
};

// Mock de withTransaction para probar el manejo de transacciones
vi.mock('@repo/db/client', () => {
    const withTransaction = vi.fn(async (cb) => await cb(mockDb));
    const getDb = vi.fn(() => mockDb);
    (globalThis as unknown as { withTransactionMock: typeof withTransaction }).withTransactionMock =
        withTransaction;
    return { withTransaction, getDb };
});

// Mock actors for diferentes escenarios
const adminActor: Actor = {
    id: 'admin1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.USER_READ_ALL]
};

const regularUserActor: Actor = {
    id: 'user1',
    role: RoleEnum.USER,
    permissions: []
};

const userWithAdminPermissionActor: Actor = {
    id: 'user2',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_UPDATE_ROLES]
};

describe('PermissionService', () => {
    let service: PermissionService;
    // Acceso al mock global
    const withTransactionMock = () =>
        (globalThis as unknown as { withTransactionMock: ReturnType<typeof vi.fn> })
            .withTransactionMock;

    beforeEach(() => {
        service = new PermissionService();
        // biome-ignore lint/suspicious/noExplicitAny: test override
        (service as any).userModel = mockUserModel;
        // biome-ignore lint/suspicious/noExplicitAny: test override
        (service as any).userPermissionModel = mockUserPermissionModel;
        // biome-ignore lint/suspicious/noExplicitAny: test override
        (service as any).rolePermissionModel = mockRolePermissionModel;
        vi.clearAllMocks();
    });

    describe('getUserPermissions', () => {
        describe('authorization', () => {
            it('allows admin to view any user permissions', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([]);
                const result = await service.getUserPermissions({
                    actor: adminActor,
                    userId: 'otherUser'
                });
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('allows users to view their own permissions', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([]);
                const result = await service.getUserPermissions({
                    actor: regularUserActor,
                    userId: regularUserActor.id
                });
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('allows users with admin permissions to view any user permissions', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([]);
                const result = await service.getUserPermissions({
                    actor: userWithAdminPermissionActor,
                    userId: 'otherUser'
                });
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('denies regular users from viewing other users permissions', async () => {
                const result = await service.getUserPermissions({
                    actor: regularUserActor,
                    userId: 'otherUser'
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('data retrieval', () => {
            it('returns all direct permissions for a user', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([
                    { userId: 'u1', permission: PermissionEnum.USER_CREATE },
                    { userId: 'u1', permission: PermissionEnum.USER_DELETE }
                ]);
                const result = await service.getUserPermissions({
                    actor: adminActor,
                    userId: 'u1'
                });
                expect(result.data).toEqual([
                    PermissionEnum.USER_CREATE,
                    PermissionEnum.USER_DELETE
                ]);
                expect(mockUserPermissionModel.findAll).toHaveBeenCalledWith({ userId: 'u1' });
            });

            it('returns empty array if user has no permissions', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([]);
                const result = await service.getUserPermissions({
                    actor: adminActor,
                    userId: 'u2'
                });
                expect(result.data).toEqual([]);
            });

            it('handles invalid userId gracefully', async () => {
                mockUserPermissionModel.findAll.mockResolvedValue([]);
                const result = await service.getUserPermissions({
                    actor: adminActor,
                    userId: ''
                });
                expect(result.data).toEqual([]);
            });
        });
    });

    describe('addPermissionToUser', () => {
        describe('authorization', () => {
            it('allows admin to add permissions', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue(null);
                const result = await service.addPermissionToUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeUndefined();
                expect(mockUserPermissionModel.create).toHaveBeenCalled();
            });

            it('allows users with admin permissions to add permissions', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue(null);
                const result = await service.addPermissionToUser({
                    actor: userWithAdminPermissionActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeUndefined();
                expect(mockUserPermissionModel.create).toHaveBeenCalled();
            });

            it('denies regular users from adding permissions', async () => {
                const result = await service.addPermissionToUser({
                    actor: regularUserActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(mockUserPermissionModel.create).not.toHaveBeenCalled();
            });
        });

        describe('validation', () => {
            it('prevents duplicate permission assignments', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                const result = await service.addPermissionToUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
                expect(mockUserPermissionModel.create).not.toHaveBeenCalled();
            });

            it('creates new permission assignment if not exists', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue(null);
                await service.addPermissionToUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(mockUserPermissionModel.create).toHaveBeenCalledWith({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
            });
        });
    });

    describe('removePermissionFromUser', () => {
        describe('authorization', () => {
            it('allows admin to remove permissions', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                const result = await service.removePermissionFromUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeUndefined();
                expect(mockUserPermissionModel.hardDelete).toHaveBeenCalled();
            });

            it('allows users with admin permissions to remove permissions', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                const result = await service.removePermissionFromUser({
                    actor: userWithAdminPermissionActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeUndefined();
                expect(mockUserPermissionModel.hardDelete).toHaveBeenCalled();
            });

            it('denies regular users from removing permissions', async () => {
                const result = await service.removePermissionFromUser({
                    actor: regularUserActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(mockUserPermissionModel.hardDelete).not.toHaveBeenCalled();
            });
        });

        describe('validation', () => {
            it('returns error if permission is not assigned', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue(null);
                const result = await service.removePermissionFromUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(mockUserPermissionModel.hardDelete).not.toHaveBeenCalled();
            });

            it('removes permission if it exists', async () => {
                mockUserPermissionModel.findOne.mockResolvedValue({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                await service.removePermissionFromUser({
                    actor: adminActor,
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
                expect(mockUserPermissionModel.hardDelete).toHaveBeenCalledWith({
                    userId: 'user1',
                    permission: PermissionEnum.USER_CREATE
                });
            });
        });
    });

    describe('setUserPermissions', () => {
        describe('authorization', () => {
            it('allows admin to set permissions', async () => {
                const result = await service.setUserPermissions({
                    actor: adminActor,
                    userId: 'user1',
                    permissions: [PermissionEnum.USER_CREATE]
                });
                expect(result.error).toBeUndefined();
                expect(withTransactionMock()).toHaveBeenCalled();
            });

            it('allows users with admin permissions to set permissions', async () => {
                const result = await service.setUserPermissions({
                    actor: userWithAdminPermissionActor,
                    userId: 'user1',
                    permissions: [PermissionEnum.USER_CREATE]
                });
                expect(result.error).toBeUndefined();
                expect(withTransactionMock()).toHaveBeenCalled();
            });

            it('denies regular users from setting permissions', async () => {
                const result = await service.setUserPermissions({
                    actor: regularUserActor,
                    userId: 'user1',
                    permissions: [PermissionEnum.USER_CREATE]
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(withTransactionMock()).not.toHaveBeenCalled();
            });
        });

        describe('transaction handling', () => {
            it('uses transaction for setting permissions', async () => {
                await service.setUserPermissions({
                    actor: adminActor,
                    userId: 'user1',
                    permissions: [PermissionEnum.USER_CREATE]
                });
                expect(withTransactionMock()).toHaveBeenCalled();
                expect(mockUserPermissionModel.hardDelete).toHaveBeenCalledWith(
                    { userId: 'user1' },
                    mockDb
                );
                expect(mockUserPermissionModel.create).toHaveBeenCalledWith(
                    { userId: 'user1', permission: PermissionEnum.USER_CREATE },
                    mockDb
                );
            });

            it('rolls back transaction on error', async () => {
                mockUserPermissionModel.create.mockRejectedValueOnce(new Error('DB error'));
                const result = await service.setUserPermissions({
                    actor: adminActor,
                    userId: 'user1',
                    permissions: [PermissionEnum.USER_CREATE]
                });
                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            });

            it('handles empty permissions array', async () => {
                const result = await service.setUserPermissions({
                    actor: adminActor,
                    userId: 'user1',
                    permissions: []
                });
                expect(result.error).toBeUndefined();
                expect(mockUserPermissionModel.hardDelete).toHaveBeenCalledWith(
                    { userId: 'user1' },
                    mockDb
                );
                expect(mockUserPermissionModel.create).not.toHaveBeenCalled();
            });
        });
    });

    describe('setRolePermissions', () => {
        describe('transaction handling', () => {
            it('uses transaction for setting role permissions', async () => {
                await service.setRolePermissions(RoleEnum.USER, [PermissionEnum.USER_CREATE]);
                expect(withTransactionMock()).toHaveBeenCalled();
            });

            it('deletes existing permissions y crea nuevas en transacción', async () => {
                let transactionCallback: ((tx: typeof mockDb) => Promise<void>) | undefined;
                withTransactionMock().mockImplementationOnce(
                    (cb: (tx: typeof mockDb) => Promise<void>) => {
                        transactionCallback = cb;
                        return cb(mockDb);
                    }
                );

                await service.setRolePermissions(RoleEnum.USER, [
                    PermissionEnum.USER_CREATE,
                    PermissionEnum.USER_DELETE
                ]);

                expect(withTransactionMock()).toHaveBeenCalled();
                expect(transactionCallback).toBeDefined();

                if (transactionCallback) {
                    await transactionCallback(mockDb);

                    expect(mockRolePermissionModel.hardDelete).toHaveBeenCalledWith(
                        { role: RoleEnum.USER },
                        mockDb
                    );
                    expect(mockRolePermissionModel.create).toHaveBeenCalledWith(
                        { role: RoleEnum.USER, permission: PermissionEnum.USER_CREATE },
                        mockDb
                    );
                    expect(mockRolePermissionModel.create).toHaveBeenCalledWith(
                        { role: RoleEnum.USER, permission: PermissionEnum.USER_DELETE },
                        mockDb
                    );
                }
            });

            it('rolls back transaction on error', async () => {
                mockRolePermissionModel.create.mockRejectedValueOnce(new Error('DB Error'));

                await expect(
                    service.setRolePermissions(RoleEnum.USER, [PermissionEnum.USER_CREATE])
                ).rejects.toThrow('DB Error');

                expect(withTransactionMock()).toHaveBeenCalled();
            });
        });
    });

    describe('getEffectivePermissions', () => {
        it('combines direct and role permissions', async () => {
            // Mock user permissions
            mockUserPermissionModel.findAll.mockResolvedValueOnce([
                { userId: 'user1', permission: PermissionEnum.USER_CREATE }
            ]);
            // Mock role permissions
            mockRolePermissionModel.findAll.mockResolvedValueOnce([
                { role: RoleEnum.USER, permission: PermissionEnum.USER_DELETE }
            ]);

            const permissions = await service.getEffectivePermissions('user1');

            expect(permissions).toContain(PermissionEnum.USER_CREATE);
            expect(permissions).toContain(PermissionEnum.USER_DELETE);
            expect(permissions.length).toBe(2);
        });

        it('returns empty array for non-existent user', async () => {
            mockUserModel.findOne.mockResolvedValueOnce(null);
            mockUserPermissionModel.findAll.mockResolvedValue([]);
            const permissions = await service.getEffectivePermissions('nonexistent');
            expect(permissions).toEqual([]);
        });

        it('removes duplicate permissions', async () => {
            // Mock user permissions
            mockUserPermissionModel.findAll.mockResolvedValueOnce([
                { userId: 'user1', permission: PermissionEnum.USER_CREATE }
            ]);
            // Mock role permissions (same permission as user)
            mockRolePermissionModel.findAll.mockResolvedValueOnce([
                { role: RoleEnum.USER, permission: PermissionEnum.USER_CREATE }
            ]);

            const permissions = await service.getEffectivePermissions('user1');

            expect(permissions).toEqual([PermissionEnum.USER_CREATE]);
            expect(permissions.length).toBe(1);
        });
    });

    describe('userHasPermission', () => {
        it('returns true if user has direct permission', async () => {
            mockUserPermissionModel.findAll.mockResolvedValueOnce([
                { userId: 'user1', permission: PermissionEnum.USER_CREATE }
            ]);
            mockRolePermissionModel.findAll.mockResolvedValueOnce([]);
            mockUserModel.findOne.mockResolvedValueOnce({ id: 'user1', role: RoleEnum.USER });

            const hasPermission = await service.userHasPermission(
                'user1',
                PermissionEnum.USER_CREATE
            );
            expect(hasPermission).toBe(true);
        });

        it('returns true if user has permission through role', async () => {
            // Mock user permissions (empty)
            mockUserPermissionModel.findAll.mockResolvedValueOnce([]);
            // Mock role permissions
            mockRolePermissionModel.findAll.mockResolvedValueOnce([
                { role: RoleEnum.USER, permission: PermissionEnum.USER_CREATE }
            ]);
            // Mock user with role
            mockUserModel.findOne.mockResolvedValueOnce({ id: 'user1', role: RoleEnum.USER });

            const hasPermission = await service.userHasPermission(
                'user1',
                PermissionEnum.USER_CREATE
            );
            expect(hasPermission).toBe(true);
        });

        it('returns false if user does not have permission', async () => {
            mockUserPermissionModel.findAll.mockResolvedValueOnce([]);
            mockRolePermissionModel.findAll.mockResolvedValueOnce([]);
            mockUserModel.findOne.mockResolvedValueOnce({ id: 'user1', role: RoleEnum.USER });

            const hasPermission = await service.userHasPermission(
                'user1',
                PermissionEnum.USER_CREATE
            );
            expect(hasPermission).toBe(false);
        });
    });
});
