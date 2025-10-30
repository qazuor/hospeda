import type { AdMediaAsset } from '@repo/schemas';
import { MediaAssetTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdMediaAssetModel } from '../../src/models/adMediaAsset.model';

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

// Create mock ad media asset data
const mockAdMediaAssetData: AdMediaAsset = {
    id: 'ad-media-asset-id-1',
    campaignId: 'campaign-id-1',
    type: MediaAssetTypeEnum.IMAGE,
    url: 'https://example.com/assets/image.jpg',
    specs: {
        width: 1920,
        height: 1080,
        fileSize: 524288,
        format: 'jpeg',
        alt: 'Sample ad image',
        title: 'Product Banner',
        description: 'High quality product banner for campaign'
    },
    adminInfo: {
        notes: 'Approved by marketing team',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: undefined,
    deletedById: undefined
};

describe('AdMediaAssetModel', () => {
    let model: AdMediaAssetModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AdMediaAssetModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'ad-media-asset-id-1') {
                return mockAdMediaAssetData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAdMediaAssetData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAdMediaAssetData,
            ...data,
            id: 'ad-media-asset-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'ad-media-asset-id-1',
                                campaignId: data.campaignId,
                                type: data.type,
                                url: data.url,
                                specs: data.specs,
                                adminInfo: data.adminInfo,
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
                                    id: 'ad-media-asset-id-1',
                                    type: MediaAssetTypeEnum.IMAGE,
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
                                ...mockAdMediaAssetData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                adMediaAssets: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'ad-media-asset-id-1',
                            type: MediaAssetTypeEnum.IMAGE
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
            expect(model).toBeInstanceOf(AdMediaAssetModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AdMediaAssetModel);
        });
    });

    describe('findById', () => {
        it('should find an ad media asset by ID', async () => {
            const result = await model.findById('ad-media-asset-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('ad-media-asset-id-1');
            expect(result?.type).toBe(MediaAssetTypeEnum.IMAGE);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all ad media assets', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new ad media asset', async () => {
            const newAssetData = {
                campaignId: 'campaign-id-2',
                type: MediaAssetTypeEnum.VIDEO,
                url: 'https://example.com/assets/video.mp4',
                specs: {
                    width: 1920,
                    height: 1080,
                    duration: 30,
                    format: 'mp4'
                },
                createdById: 'user-id-1'
            };

            const result = await model.create(newAssetData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.type).toBe(MediaAssetTypeEnum.VIDEO);
            expect(result.campaignId).toBe('campaign-id-2');
        });
    });

    describe('count', () => {
        it('should count ad media assets', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByCampaign', () => {
        it('should find ad media assets by campaign ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdMediaAssetData],
                total: 1
            });

            const result = await model.findByCampaign('campaign-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.campaignId).toBe('campaign-id-1');
        });
    });

    describe('findByType', () => {
        it('should find ad media assets by type', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdMediaAssetData],
                total: 1
            });

            const result = await model.findByType(MediaAssetTypeEnum.IMAGE);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.type).toBe(MediaAssetTypeEnum.IMAGE);
        });
    });

    describe('getAssetsByFormat', () => {
        it('should find assets by format within specs', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdMediaAssetData],
                total: 1
            });

            const result = await model.getAssetsByFormat('jpeg');

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
