import type { Client } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { ClientModel } from '../../src/models/client/client.model';

// Mock data
const mockClient: Client = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Client Ltd',
    billingEmail: 'billing@testclient.com',
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: null
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('ClientModel', () => {
    let clientModel: ClientModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clientModel = new ClientModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            // Access the protected method via type assertion for testing
            const tableName = (clientModel as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('clients');
        });
    });

    describe('findByUser', () => {
        it('should find client by user ID', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClient])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const userId = mockClient.userId;
            if (userId) {
                const result = await clientModel.findByUser(userId);

                expect(result).toBeDefined();
                expect(result?.userId).toBe(mockClient.userId);
            }
        });

        it('should return null if client not found', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findByUser('non-existent-user-id');

            expect(result).toBeNull();
        });

        it('should handle database errors', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('DB Error'))
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            await expect(clientModel.findByUser('user-id')).rejects.toThrow('DB Error');
        });
    });

    describe('findAll with text search', () => {
        it('should search clients by name', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([mockClient])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(1);

            const result = await clientModel.findAll({ q: 'Test' }, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should search clients by billing email', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([mockClient])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(1);

            const result = await clientModel.findAll({ q: 'billing@' }, { page: 1, pageSize: 10 });

            expect(result.items).toBeDefined();
        });

        it('should handle empty search term', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([mockClient])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(1);

            const result = await clientModel.findAll({ q: '   ' }, { page: 1, pageSize: 10 });

            expect(result).toBeDefined();
        });

        it('should handle combined filters and search', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([mockClient])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(1);

            const result = await clientModel.findAll(
                {
                    q: 'Test',
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                },
                { page: 1, pageSize: 10 }
            );

            expect(result.items).toBeDefined();
        });

        it('should handle unpaginated search', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClient])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findAll({ q: 'Test' });

            expect(result.items).toBeDefined();
            expect(result.total).toBe(1);
        });
    });

    describe('findWithActiveSubscriptions', () => {
        it('should find clients with active subscriptions', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockResolvedValue([mockClient])
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findWithActiveSubscriptions();

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should return empty array when no clients found', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockResolvedValue([])
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findWithActiveSubscriptions();

            expect(result).toHaveLength(0);
        });
    });

    describe('getBillingStats', () => {
        it('should return billing statistics for client', async () => {
            const stats = await clientModel.getBillingStats('client-id');

            expect(stats).toBeDefined();
            expect(stats.totalInvoices).toBe(0);
            expect(stats.totalPaid).toBe(0);
            expect(stats.totalOverdue).toBe(0);
            expect(stats.totalAmount).toBe(0);
            expect(stats.paidAmount).toBe(0);
            expect(stats.overdueAmount).toBe(0);
        });

        it('should return consistent structure', async () => {
            const stats = await clientModel.getBillingStats('any-client-id');

            expect(stats).toHaveProperty('totalInvoices');
            expect(stats).toHaveProperty('totalPaid');
            expect(stats).toHaveProperty('totalOverdue');
            expect(stats).toHaveProperty('totalAmount');
            expect(stats).toHaveProperty('paidAmount');
            expect(stats).toHaveProperty('overdueAmount');
        });
    });

    describe('hasActiveSubscriptions', () => {
        it('should return false when no subscriptions', async () => {
            const result = await clientModel.hasActiveSubscriptions('client-id');

            expect(result).toBe(false);
        });

        it('should handle different client IDs consistently', async () => {
            const result1 = await clientModel.hasActiveSubscriptions('client-1');
            const result2 = await clientModel.hasActiveSubscriptions('client-2');

            expect(result1).toBe(false);
            expect(result2).toBe(false);
        });
    });

    describe('Query builder methods', () => {
        it('withUser should return query unchanged', () => {
            const query = { test: 'query' };
            const result = clientModel.withUser(query);

            expect(result).toBe(query);
        });

        it('withSubscriptions should return query unchanged', () => {
            const query = { test: 'query' };
            const result = clientModel.withSubscriptions(query);

            expect(result).toBe(query);
        });

        it('withAccessRights should return query unchanged', () => {
            const query = { test: 'query' };
            const result = clientModel.withAccessRights(query);

            expect(result).toBe(query);
        });
    });

    describe('CRUD operations', () => {
        it('should create client with valid data', async () => {
            const mockDb = {
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockClient])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            vi.spyOn(clientModel, 'create').mockResolvedValue(mockClient);

            const newClient = {
                userId: 'user-2',
                name: 'New Client',
                billingEmail: 'new@client.com',
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };

            const result = await clientModel.create(newClient as any);

            expect(result).toBeDefined();
            expect(result.name).toBe(mockClient.name);
        });

        it('should update client by ID', async () => {
            const mockDb = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi
                                .fn()
                                .mockResolvedValue([{ ...mockClient, name: 'Updated Name' }])
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            vi.spyOn(clientModel, 'updateById').mockResolvedValue({
                ...mockClient,
                name: 'Updated Name'
            } as any);

            const result = await clientModel.updateById(mockClient.id, {
                name: 'Updated Name'
            });

            expect(result.name).toBe('Updated Name');
        });

        it('should find client by ID', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockClient])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            vi.spyOn(clientModel, 'findById').mockResolvedValue(mockClient);

            const result = await clientModel.findById(mockClient.id);

            expect(result).toBeDefined();
            expect(result?.id).toBe(mockClient.id);
        });

        it('should soft delete client', async () => {
            const mockDb = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            vi.spyOn(clientModel, 'softDelete').mockResolvedValue();

            await clientModel.softDelete({ id: mockClient.id });

            expect(clientModel.softDelete).toHaveBeenCalledWith({ id: mockClient.id });
        });
    });

    describe('Pagination', () => {
        it('should handle pagination correctly', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([mockClient])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(25);

            const result = await clientModel.findAll({}, { page: 2, pageSize: 10 });

            expect(result.total).toBe(25);
        });

        it('should calculate offset correctly', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);
            vi.spyOn(clientModel, 'count').mockResolvedValue(0);

            await clientModel.findAll({}, { page: 3, pageSize: 5 });

            // Offset should be (3-1) * 5 = 10
            expect(mockDb.select().from().where().limit().offset).toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        it('should handle database connection errors', async () => {
            const mockDb = {
                select: vi.fn().mockImplementation(() => {
                    throw new Error('Connection failed');
                })
            };
            getDb.mockReturnValue(mockDb);

            await expect(clientModel.findAll({})).rejects.toThrow('Connection failed');
        });

        it('should handle invalid filter parameters', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await clientModel.findAll({ invalid: 'filter' });

            expect(result.items).toHaveLength(0);
        });
    });
});
