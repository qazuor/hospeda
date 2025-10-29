import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { DiscountCodeUsageModel } from '../../../src/models/promotion/discountCodeUsage.model';
import type { DiscountCodeUsage } from '../../../src/schemas/promotion/discountCodeUsage.dbschema';

// Mock data
const mockDiscountCodeUsage: DiscountCodeUsage = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    discountCodeId: '550e8400-e29b-41d4-a716-446655440000',
    clientId: 'client-123',
    usageCount: 1,
    firstUsedAt: new Date('2024-01-01T00:00:00Z'),
    lastUsedAt: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const mockMultipleUsage: DiscountCodeUsage = {
    ...mockDiscountCodeUsage,
    id: '550e8400-e29b-41d4-a716-446655440002',
    usageCount: 3,
    lastUsedAt: new Date('2024-01-15T00:00:00Z')
};

vi.mock('../../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('DiscountCodeUsageModel', () => {
    let discountCodeUsageModel: DiscountCodeUsageModel;
    let getDb: ReturnType<typeof vi.fn>;
    let mockDb: any;

    beforeEach(() => {
        discountCodeUsageModel = new DiscountCodeUsageModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;

        // Common mock DB structure
        mockDb = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                        offset: vi.fn().mockReturnValue([])
                    }),
                    limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockReturnValue([])
                    }),
                    leftJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue([])
                    })
                })
            }),
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    onConflictDoUpdate: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockDiscountCodeUsage])
                    })
                })
            }),
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn()
                    })
                })
            }),
            delete: vi.fn().mockReturnValue({
                where: vi.fn()
            }),
            query: {
                discountCodeUsages: {
                    findMany: vi.fn(),
                    findFirst: vi.fn()
                }
            }
        };

        getDb.mockReturnValue(mockDb);
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (discountCodeUsageModel as any).getTableName();
            expect(tableName).toBe('discount_code_usage');
        });
    });

    describe('recordUsage', () => {
        const discountCodeId = 'discount-code-123';
        const clientId = 'client-123';

        it('should create new usage record for first-time user', async () => {
            // Mock existing usage query - no existing record
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            // Mock insert returning new record
            mockDb.insert.mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockDiscountCodeUsage])
                })
            });

            const result = await discountCodeUsageModel.recordUsage(discountCodeId, clientId);

            expect(result).toEqual(mockDiscountCodeUsage);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should update existing usage record for repeat user', async () => {
            // Mock existing usage query - existing record found
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockDiscountCodeUsage])
                    })
                })
            });

            // Mock update returning updated record
            const updatedRecord = { ...mockDiscountCodeUsage, usageCount: 2 };
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([updatedRecord])
                    })
                })
            });

            const result = await discountCodeUsageModel.recordUsage(discountCodeId, clientId);

            expect(result).toEqual(updatedRecord);
            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('getUsageHistory', () => {
        const discountCodeId = 'discount-code-123';

        it('should return paginated usage history', async () => {
            const usageHistory = [mockDiscountCodeUsage, mockMultipleUsage];

            // Mock main query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue(usageHistory)
                            })
                        })
                    })
                })
            });

            // Mock count query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 10 }])
                })
            });

            const result = await discountCodeUsageModel.getUsageHistory(discountCodeId, {
                page: 1,
                pageSize: 2
            });

            expect(result.items).toEqual(usageHistory);
            expect(result.total).toBe(10);
        });

        it('should return all usage history without pagination', async () => {
            const usageHistory = [mockDiscountCodeUsage, mockMultipleUsage];

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue(usageHistory)
                    })
                })
            });

            const result = await discountCodeUsageModel.getUsageHistory(discountCodeId);

            expect(result.items).toEqual(usageHistory);
            expect(result.total).toBe(2);
        });
    });

    describe('getUsageStats', () => {
        const discountCodeId = 'discount-code-123';

        it('should return comprehensive usage statistics', async () => {
            const statsData = {
                totalUsers: 5,
                totalUsages: '15',
                firstUsed: new Date('2024-01-01T00:00:00Z'),
                lastUsed: new Date('2024-01-15T00:00:00Z')
            };

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([statsData])
                })
            });

            const result = await discountCodeUsageModel.getUsageStats(discountCodeId);

            expect(result).toEqual({
                totalUsers: 5,
                totalUsages: 15,
                averageUsagesPerUser: 3,
                firstUsed: statsData.firstUsed,
                lastUsed: statsData.lastUsed
            });
        });

        it('should handle empty stats gracefully', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            totalUsers: 0,
                            totalUsages: null,
                            firstUsed: null,
                            lastUsed: null
                        }
                    ])
                })
            });

            const result = await discountCodeUsageModel.getUsageStats(discountCodeId);

            expect(result).toEqual({
                totalUsers: 0,
                totalUsages: 0,
                averageUsagesPerUser: 0,
                firstUsed: null,
                lastUsed: null
            });
        });
    });

    describe('findByCode', () => {
        it('should find usage records by discount code', async () => {
            const discountCode = 'SAVE20';
            const usageHistory = [mockDiscountCodeUsage];

            // Mock get discount code ID
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: 'discount-code-123' }])
                    })
                })
            });

            // Mock getUsageHistory call
            vi.spyOn(discountCodeUsageModel, 'getUsageHistory').mockResolvedValue({
                items: usageHistory,
                total: 1
            });

            const result = await discountCodeUsageModel.findByCode(discountCode);

            expect(result.items).toEqual(usageHistory);
            expect(result.total).toBe(1);
        });

        it('should return empty result for non-existent code', async () => {
            // Mock get discount code ID - not found
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            const result = await discountCodeUsageModel.findByCode('NONEXISTENT');

            expect(result.items).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    describe('findByClient', () => {
        const clientId = 'client-123';

        it('should find usage records by client with pagination', async () => {
            const usageHistory = [mockDiscountCodeUsage];

            // Mock main query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue(usageHistory)
                            })
                        })
                    })
                })
            });

            // Mock count query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 5 }])
                })
            });

            const result = await discountCodeUsageModel.findByClient(clientId, {
                page: 1,
                pageSize: 10
            });

            expect(result.items).toEqual(usageHistory);
            expect(result.total).toBe(5);
        });
    });

    describe('getUsageCount', () => {
        it('should return usage count for specific code and client', async () => {
            const discountCodeId = 'discount-code-123';
            const clientId = 'client-123';

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ usageCount: 3 }])
                    })
                })
            });

            const result = await discountCodeUsageModel.getUsageCount(discountCodeId, clientId);

            expect(result).toBe(3);
        });

        it('should return 0 for non-existent usage', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            });

            const result = await discountCodeUsageModel.getUsageCount('code-123', 'client-123');

            expect(result).toBe(0);
        });
    });

    describe('getPopularCodes', () => {
        it('should return popular discount codes with statistics', async () => {
            const popularCodes = [
                {
                    discountCodeId: 'code-1',
                    code: 'SAVE20',
                    totalUsages: '150',
                    uniqueUsers: 50
                },
                {
                    discountCodeId: 'code-2',
                    code: 'FIXED10',
                    totalUsages: '100',
                    uniqueUsers: 25
                }
            ];

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue(popularCodes)
                            })
                        })
                    })
                })
            });

            const result = await discountCodeUsageModel.getPopularCodes(10);

            expect(result).toEqual([
                {
                    discountCodeId: 'code-1',
                    code: 'SAVE20',
                    totalUsages: 150,
                    uniqueUsers: 50,
                    averageUsagesPerUser: 3
                },
                {
                    discountCodeId: 'code-2',
                    code: 'FIXED10',
                    totalUsages: 100,
                    uniqueUsers: 25,
                    averageUsagesPerUser: 4
                }
            ]);
        });
    });

    describe('getUsageTrends', () => {
        it('should return usage trends over time', async () => {
            const discountCodeId = 'discount-code-123';
            const trendsData = [
                {
                    date: '2024-01-01',
                    newUsers: 5,
                    totalUsages: '10'
                },
                {
                    date: '2024-01-02',
                    newUsers: 3,
                    totalUsages: '8'
                }
            ];

            mockDb.select.mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(trendsData)
                        })
                    })
                })
            });

            const result = await discountCodeUsageModel.getUsageTrends(discountCodeId, 30);

            expect(result).toEqual([
                {
                    date: '2024-01-01',
                    newUsers: 5,
                    totalUsages: 10
                },
                {
                    date: '2024-01-02',
                    newUsers: 3,
                    totalUsages: 8
                }
            ]);
        });
    });

    describe('calculateSavings', () => {
        it('should calculate savings for specific discount code', async () => {
            const discountCodeId = 'discount-code-123';

            const result = await discountCodeUsageModel.calculateSavings(discountCodeId);

            expect(result).toEqual({
                totalSavings: 0, // Since no usages in mock
                totalUsages: 0,
                averageSavingsPerUsage: 0
            });
        });

        it('should calculate global savings when no code specified', async () => {
            mockDb.select.mockReturnValue({
                from: vi.fn().mockResolvedValue([{ totalUsages: '100' }])
            });

            const result = await discountCodeUsageModel.calculateSavings();

            expect(result).toEqual({
                totalSavings: 1000, // 100 usages * $10 estimated savings
                totalUsages: 100,
                averageSavingsPerUsage: 10
            });
        });
    });

    describe('findWithCodeDetails', () => {
        it('should return usage records with discount code details', async () => {
            const usageWithDetails = [
                {
                    id: mockDiscountCodeUsage.id,
                    discountCodeId: mockDiscountCodeUsage.discountCodeId,
                    clientId: mockDiscountCodeUsage.clientId,
                    usageCount: mockDiscountCodeUsage.usageCount,
                    firstUsedAt: mockDiscountCodeUsage.firstUsedAt,
                    lastUsedAt: mockDiscountCodeUsage.lastUsedAt,
                    createdAt: mockDiscountCodeUsage.createdAt,
                    updatedAt: mockDiscountCodeUsage.updatedAt,
                    deletedAt: mockDiscountCodeUsage.deletedAt,
                    createdById: mockDiscountCodeUsage.createdById,
                    updatedById: mockDiscountCodeUsage.updatedById,
                    deletedById: mockDiscountCodeUsage.deletedById,
                    code: 'SAVE20',
                    discountType: 'PERCENTAGE'
                }
            ];

            // Mock main query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue(usageWithDetails)
                            })
                        })
                    })
                })
            });

            // Mock count query
            mockDb.select.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockResolvedValue([{ count: 1 }])
                })
            });

            const result = await discountCodeUsageModel.findWithCodeDetails(
                {},
                { page: 1, pageSize: 10 }
            );

            expect(result.items).toHaveLength(1);
            expect(result.items[0].discountCode).toEqual({
                code: 'SAVE20',
                discountType: 'PERCENTAGE'
            });
            expect(result.total).toBe(1);
        });
    });
});
