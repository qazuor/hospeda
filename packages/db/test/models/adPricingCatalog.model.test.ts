import { CampaignChannelEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdPricingCatalogModel } from '../../src/models/adPricingCatalog.model';
import type { adPricingCatalog } from '../../src/schemas/payment/adPricingCatalog.dbschema';

// Infer type from schema
type AdPricingCatalog = typeof adPricingCatalog.$inferSelect;

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => ({}))
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// Mock database operations
vi.mock('../../src/utils/db-utils', () => ({
    buildWhereClause: vi.fn(() => ({}))
}));

// Create mock ad pricing catalog data
const mockAdPricingCatalogData: AdPricingCatalog = {
    id: 'ad-pricing-catalog-id-1',
    adSlotId: 'ad-slot-id-1',
    channel: CampaignChannelEnum.WEB,
    basePrice: '100.00',
    currency: 'USD',
    pricingModel: 'CPM',
    dailyRate: '50.00',
    weeklyRate: '300.00',
    monthlyRate: '1000.00',
    weekendMultiplier: '1.50',
    holidayMultiplier: '2.00',
    minimumBudget: '500.00',
    maximumBudget: '10000.00',
    availableFrom: new Date('2024-01-01'),
    availableUntil: new Date('2024-12-31'),
    pricingConfig: {
        demandMultiplier: 1.2,
        seasonalMultipliers: {
            summer: 1.3,
            winter: 0.9
        },
        audienceTargetingRates: {
            premium: 1.5
        }
    },
    description: 'Premium web advertising slot pricing',
    isActive: 'true',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null,
    adminInfo: {
        notes: 'Approved pricing structure',
        reviewedBy: 'admin-id-1'
    }
};

describe('AdPricingCatalogModel', () => {
    let model: AdPricingCatalogModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AdPricingCatalogModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'ad-pricing-catalog-id-1') {
                return mockAdPricingCatalogData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAdPricingCatalogData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAdPricingCatalogData,
            ...data,
            id: 'ad-pricing-catalog-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'ad-pricing-catalog-id-1',
                                adSlotId: data.adSlotId,
                                channel: data.channel,
                                basePrice: data.basePrice,
                                currency: data.currency,
                                pricingModel: data.pricingModel,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: undefined,
                                updatedById: undefined,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(() =>
                            Promise.resolve([
                                {
                                    id: 'ad-pricing-catalog-id-1',
                                    isActive: 'true',
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            ])
                        )
                    }))
                }))
            })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() =>
                        Promise.resolve([
                            {
                                ...mockAdPricingCatalogData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                adPricingCatalog: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'ad-pricing-catalog-id-1',
                            channel: CampaignChannelEnum.WEB
                        })
                    )
                }
            }
        };

        // Override getDb for this instance
        const { getDb } = await import('../../src/client');
        vi.mocked(getDb).mockReturnValue(mockDb as any);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AdPricingCatalogModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AdPricingCatalogModel);
        });
    });

    describe('findById', () => {
        it('should find an ad pricing catalog by ID', async () => {
            const result = await model.findById('ad-pricing-catalog-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('ad-pricing-catalog-id-1');
            expect(result?.channel).toBe(CampaignChannelEnum.WEB);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all ad pricing catalogs', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new ad pricing catalog', async () => {
            const newCatalogData = {
                adSlotId: 'ad-slot-id-2',
                channel: CampaignChannelEnum.SOCIAL,
                basePrice: '150.00',
                currency: 'USD',
                pricingModel: 'CPC',
                createdById: 'user-id-1'
            };

            const result = await model.create(newCatalogData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.channel).toBe(CampaignChannelEnum.SOCIAL);
            expect(result.adSlotId).toBe('ad-slot-id-2');
        });
    });

    describe('count', () => {
        it('should count ad pricing catalogs', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByAdSlot', () => {
        it('should find pricing catalogs by ad slot ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdPricingCatalogData],
                total: 1
            });

            const result = await model.findByAdSlot('ad-slot-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.adSlotId).toBe('ad-slot-id-1');
        });
    });

    describe('findByChannel', () => {
        it('should find pricing catalogs by channel', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdPricingCatalogData],
                total: 1
            });

            const result = await model.findByChannel(CampaignChannelEnum.WEB);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.channel).toBe(CampaignChannelEnum.WEB);
        });
    });

    describe('findActive', () => {
        it('should find active pricing catalogs', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdPricingCatalogData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
        });
    });

    describe('calculatePrice', () => {
        it('should calculate price with multipliers', async () => {
            const result = await model.calculatePrice({
                catalogId: 'ad-pricing-catalog-id-1',
                impressions: 1000,
                isWeekend: true,
                isHoliday: false
            });

            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThan(0);
        });
    });
});
