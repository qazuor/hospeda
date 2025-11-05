import type { DiscountCodeUsageModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountCodeUsageService } from '../../../src/services/discountCodeUsage/discountCodeUsage.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

// Mock data
const mockUsageRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    discountCodeId: '00000000-0000-4000-8000-000000000100',
    clientId: '00000000-0000-4000-8000-000000000200',
    usageCount: 3,
    firstUsedAt: new Date('2024-01-15'),
    lastUsedAt: new Date('2024-03-20'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-20'),
    deletedAt: null,
    createdById: '00000000-0000-4000-8000-000000000999',
    updatedById: '00000000-0000-4000-8000-000000000999',
    deletedById: null
};

const mockActor: Actor = {
    id: '00000000-0000-4000-8000-000000000999',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.DISCOUNT_CODE_USAGE_VIEW]
};

describe('DiscountCodeUsageService', () => {
    let service: DiscountCodeUsageService;
    let model: DiscountCodeUsageModel;
    let ctx: ServiceContext;

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        };

        // Mock model methods
        model = {
            getUsageHistory: vi.fn(),
            getUsageStats: vi.fn(),
            findByClient: vi.fn(),
            getUsageTrends: vi.fn(),
            getPopularCodes: vi.fn(),
            findWithCodeDetails: vi.fn(),
            getUsageCount: vi.fn(),
            calculateSavings: vi.fn(),
            recordUsage: vi.fn()
        } as unknown as DiscountCodeUsageModel;

        service = new DiscountCodeUsageService(ctx, model);
    });

    // ==================== PERMISSION TESTS ====================

    describe('Permission checks', () => {
        it('should allow ADMIN to view usage', async () => {
            (model.getUsageHistory as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.getUsageHistory(
                mockActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should allow user with DISCOUNT_CODE_USAGE_VIEW permission', async () => {
            const actorWithPermission: Actor = {
                id: '00000000-0000-4000-8000-000000000999',
                role: RoleEnum.USER,
                permissions: [PermissionEnum.DISCOUNT_CODE_USAGE_VIEW]
            };

            (model.getUsageHistory as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.getUsageHistory(
                actorWithPermission,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should deny user without permission', async () => {
            const unauthorizedActor: Actor = {
                id: '00000000-0000-4000-8000-000000000999',
                role: RoleEnum.USER,
                permissions: []
            };

            const result = await service.getUsageHistory(
                unauthorizedActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.data).toBeUndefined();
        });
    });

    // ==================== getUsageHistory ====================

    describe('getUsageHistory', () => {
        it('should get usage history for a discount code', async () => {
            (model.getUsageHistory as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.getUsageHistory(
                mockActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
            expect(result.error).toBeUndefined();
        });

        it('should support pagination', async () => {
            (model.getUsageHistory as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 10
            });

            const result = await service.getUsageHistory(
                mockActor,
                '00000000-0000-4000-8000-000000000100',
                2,
                5
            );

            expect(result.data).toBeDefined();
            expect(model.getUsageHistory).toHaveBeenCalledWith(
                '00000000-0000-4000-8000-000000000100',
                { page: 2, pageSize: 5 }
            );
        });
    });

    // ==================== getUsageStats ====================

    describe('getUsageStats', () => {
        it('should get usage statistics for a discount code', async () => {
            (model.getUsageStats as Mock).mockResolvedValue({
                totalUsers: 50,
                totalUsages: 150,
                averageUsagesPerUser: 3.0,
                firstUsed: new Date('2024-01-01'),
                lastUsed: new Date('2024-03-20')
            });

            const result = await service.getUsageStats(
                mockActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.totalUsers).toBe(50);
            expect(result.data?.totalUsages).toBe(150);
            expect(result.data?.averageUsagesPerUser).toBe(3.0);
            expect(result.error).toBeUndefined();
        });
    });

    // ==================== getUsageByClient ====================

    describe('getUsageByClient', () => {
        it('should get usage records by client', async () => {
            (model.findByClient as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.getUsageByClient(
                mockActor,
                '00000000-0000-4000-8000-000000000200'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
            expect(result.error).toBeUndefined();
        });

        it('should support pagination for client usage', async () => {
            (model.findByClient as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 15
            });

            const result = await service.getUsageByClient(
                mockActor,
                '00000000-0000-4000-8000-000000000200',
                3,
                5
            );

            expect(result.data).toBeDefined();
            expect(model.findByClient).toHaveBeenCalledWith(
                '00000000-0000-4000-8000-000000000200',
                { page: 3, pageSize: 5 }
            );
        });
    });

    // ==================== getUsageTrends ====================

    describe('getUsageTrends', () => {
        it('should get usage trends for a discount code', async () => {
            (model.getUsageTrends as Mock).mockResolvedValue([
                { date: '2024-03-01', newUsers: 5, totalUsages: 10 },
                { date: '2024-03-02', newUsers: 3, totalUsages: 8 }
            ]);

            const result = await service.getUsageTrends(
                mockActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(2);
            expect(result.data?.[0].date).toBe('2024-03-01');
            expect(result.error).toBeUndefined();
        });

        it('should support custom days parameter', async () => {
            (model.getUsageTrends as Mock).mockResolvedValue([]);

            const result = await service.getUsageTrends(
                mockActor,
                '00000000-0000-4000-8000-000000000100',
                60
            );

            expect(result.data).toBeDefined();
            expect(model.getUsageTrends).toHaveBeenCalledWith(
                '00000000-0000-4000-8000-000000000100',
                60
            );
        });
    });

    // ==================== getPopularCodes ====================

    describe('getPopularCodes', () => {
        it('should get popular discount codes', async () => {
            (model.getPopularCodes as Mock).mockResolvedValue([
                {
                    discountCodeId: '00000000-0000-4000-8000-000000000100',
                    code: 'POPULAR10',
                    totalUsages: 500,
                    uniqueUsers: 250,
                    averageUsagesPerUser: 2.0
                }
            ]);

            const result = await service.getPopularCodes(mockActor);

            expect(result.data).toBeDefined();
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0].code).toBe('POPULAR10');
            expect(result.error).toBeUndefined();
        });

        it('should support custom limit parameter', async () => {
            (model.getPopularCodes as Mock).mockResolvedValue([]);

            const result = await service.getPopularCodes(mockActor, 20);

            expect(result.data).toBeDefined();
            expect(model.getPopularCodes).toHaveBeenCalledWith(20);
        });
    });

    // ==================== search ====================

    describe('search', () => {
        it('should search by discountCodeId', async () => {
            (model.getUsageHistory as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.search(mockActor, {
                discountCodeId: '00000000-0000-4000-8000-000000000100',
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(model.getUsageHistory).toHaveBeenCalled();
        });

        it('should search by clientId', async () => {
            (model.findByClient as Mock).mockResolvedValue({
                items: [mockUsageRecord],
                total: 1
            });

            const result = await service.search(mockActor, {
                clientId: '00000000-0000-4000-8000-000000000200',
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(model.findByClient).toHaveBeenCalled();
        });

        it('should get all usage with code details when no filters', async () => {
            (model.findWithCodeDetails as Mock).mockResolvedValue({
                items: [
                    {
                        ...mockUsageRecord,
                        discountCode: { code: 'TEST10', discountType: 'percentage' }
                    }
                ],
                total: 1
            });

            const result = await service.search(mockActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(model.findWithCodeDetails).toHaveBeenCalled();
        });
    });

    // ==================== getUsageCount ====================

    describe('getUsageCount', () => {
        it('should get usage count for specific code/client', async () => {
            (model.getUsageCount as Mock).mockResolvedValue(5);

            const result = await service.getUsageCount(
                mockActor,
                '00000000-0000-4000-8000-000000000100',
                '00000000-0000-4000-8000-000000000200'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(5);
            expect(result.error).toBeUndefined();
        });

        it('should return 0 if no usage found', async () => {
            (model.getUsageCount as Mock).mockResolvedValue(0);

            const result = await service.getUsageCount(
                mockActor,
                '00000000-0000-4000-8000-000000000100',
                '00000000-0000-4000-8000-000000000200'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(0);
        });
    });

    // ==================== calculateSavings ====================

    describe('calculateSavings', () => {
        it('should calculate savings for a specific discount code', async () => {
            (model.calculateSavings as Mock).mockResolvedValue({
                totalSavings: 5000,
                totalUsages: 100,
                averageSavingsPerUsage: 50
            });

            const result = await service.calculateSavings(
                mockActor,
                '00000000-0000-4000-8000-000000000100'
            );

            expect(result.data).toBeDefined();
            expect(result.data?.totalSavings).toBe(5000);
            expect(result.data?.totalUsages).toBe(100);
            expect(result.error).toBeUndefined();
        });

        it('should calculate savings for all codes when no ID provided', async () => {
            (model.calculateSavings as Mock).mockResolvedValue({
                totalSavings: 25000,
                totalUsages: 500,
                averageSavingsPerUsage: 50
            });

            const result = await service.calculateSavings(mockActor);

            expect(result.data).toBeDefined();
            expect(result.data?.totalSavings).toBe(25000);
            expect(model.calculateSavings).toHaveBeenCalledWith(undefined);
        });
    });

    // ==================== findWithCodeDetails ====================

    describe('findWithCodeDetails', () => {
        it('should get usage records with discount code details', async () => {
            (model.findWithCodeDetails as Mock).mockResolvedValue({
                items: [
                    {
                        ...mockUsageRecord,
                        discountCode: {
                            code: 'SAVE20',
                            discountType: 'percentage'
                        }
                    }
                ],
                total: 1
            });

            const result = await service.findWithCodeDetails(mockActor);

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.items[0].discountCode.code).toBe('SAVE20');
            expect(result.error).toBeUndefined();
        });

        it('should support pagination for code details', async () => {
            (model.findWithCodeDetails as Mock).mockResolvedValue({
                items: [],
                total: 0
            });

            const result = await service.findWithCodeDetails(mockActor, 2, 10);

            expect(result.data).toBeDefined();
            expect(model.findWithCodeDetails).toHaveBeenCalledWith({}, { page: 2, pageSize: 10 });
        });
    });

    // ==================== recordUsageInternal ====================

    describe('recordUsageInternal', () => {
        it('should record usage internally without permission check', async () => {
            (model.recordUsage as Mock).mockResolvedValue(mockUsageRecord);

            const result = await service.recordUsageInternal(
                '00000000-0000-4000-8000-000000000100',
                '00000000-0000-4000-8000-000000000200'
            );

            expect(result).toBeDefined();
            expect(result?.id).toBe(mockUsageRecord.id);
            expect(model.recordUsage).toHaveBeenCalledWith(
                '00000000-0000-4000-8000-000000000100',
                '00000000-0000-4000-8000-000000000200'
            );
        });

        it('should return null if recording fails', async () => {
            (model.recordUsage as Mock).mockResolvedValue(null);

            const result = await service.recordUsageInternal(
                '00000000-0000-4000-8000-000000000100',
                '00000000-0000-4000-8000-000000000200'
            );

            expect(result).toBeNull();
        });
    });
});
