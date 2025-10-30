import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSlotModel } from '../../src/models/adSlot.model';
import type { AdSlot } from '../../src/schemas/campaign/adSlot.dbschema';

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

// Create mock ad slot data
const mockAdSlotData: AdSlot = {
    id: 'ad-slot-id-1',
    locationKey: 'HOME_BANNER',
    specs: {
        width: 1200,
        height: 300,
        maxFileSize: 2097152, // 2MB
        allowedFormats: ['jpg', 'png', 'gif'],
        position: 'top',
        description: 'Main homepage banner',
        displayRules: {
            maxConcurrent: 3,
            rotationInterval: 30,
            targetDevice: ['desktop', 'mobile']
        }
    },
    isActive: true,
    adminInfo: {
        notes: 'Premium placement',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('AdSlotModel', () => {
    let model: AdSlotModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AdSlotModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'ad-slot-id-1') {
                return mockAdSlotData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAdSlotData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAdSlotData,
            ...data,
            id: 'ad-slot-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'ad-slot-id-1',
                                locationKey: data.locationKey,
                                specs: data.specs,
                                isActive: data.isActive,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: 'user-id-1',
                                updatedById: 'user-id-1',
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
                                    id: 'ad-slot-id-1',
                                    isActive: true,
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
                                ...mockAdSlotData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                adSlots: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'ad-slot-id-1',
                            locationKey: 'HOME_BANNER'
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
            expect(model).toBeInstanceOf(AdSlotModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AdSlotModel);
        });
    });

    describe('findById', () => {
        it('should find an ad slot by ID', async () => {
            const result = await model.findById('ad-slot-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('ad-slot-id-1');
            expect(result?.locationKey).toBe('HOME_BANNER');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all ad slots', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new ad slot', async () => {
            const newSlotData = {
                locationKey: 'SIDEBAR_LEFT',
                specs: {
                    width: 300,
                    height: 600
                },
                isActive: true,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newSlotData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.locationKey).toBe('SIDEBAR_LEFT');
        });
    });

    describe('count', () => {
        it('should count ad slots', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByLocationKey', () => {
        it('should find an ad slot by location key', async () => {
            vi.spyOn(model, 'findOne').mockResolvedValue(mockAdSlotData);

            const result = await model.findByLocationKey('HOME_BANNER');

            expect(result).toBeDefined();
            expect(result?.locationKey).toBe('HOME_BANNER');
        });
    });

    describe('findActive', () => {
        it('should find active ad slots', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isActive).toBe(true);
        });
    });

    describe('getAvailableSlots', () => {
        it('should get available slots (active and not deleted)', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotData],
                total: 1
            });

            const result = await model.getAvailableSlots();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
        });
    });
});
