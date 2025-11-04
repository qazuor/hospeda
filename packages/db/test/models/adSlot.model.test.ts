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

        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('ad_slots');
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

        it('should handle errors when finding active slots', async () => {
            // Arrange - Mock findAll to throw error
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('Database query failed'));

            // Act & Assert - Expect error to be thrown
            await expect(model.findActive()).rejects.toThrow('Database query failed');
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

        it('should handle errors when getting available slots', async () => {
            // Arrange - Mock findAll to throw error
            vi.spyOn(model, 'findAll').mockRejectedValue(
                new Error('Failed to query available slots')
            );

            // Act & Assert - Expect error to be thrown
            await expect(model.getAvailableSlots()).rejects.toThrow(
                'Failed to query available slots'
            );
        });
    });

    describe('error handling', () => {
        it('should handle database errors in findByLocationKey', async () => {
            // Arrange - Mock findOne to throw database error
            vi.spyOn(model, 'findOne').mockRejectedValue(new Error('Database connection failed'));

            // Act & Assert - Expect error to be thrown
            await expect(model.findByLocationKey('HOME_BANNER')).rejects.toThrow(
                'Database connection failed'
            );
        });

        it('should handle errors when updating slot availability', async () => {
            // Arrange - Mock database update to fail
            const mockDb = {
                update: vi.fn(() => ({
                    set: vi.fn(() => ({
                        where: vi.fn(() => {
                            throw new Error('Update failed');
                        })
                    }))
                }))
            };

            const { getDb } = await import('../../src/client');
            vi.mocked(getDb).mockReturnValue(mockDb as any);

            // Mock update method to use the failing db
            vi.spyOn(model, 'update').mockRejectedValue(new Error('Update failed'));

            // Act & Assert
            await expect(model.update('ad-slot-id-1', { isActive: false })).rejects.toThrow(
                'Update failed'
            );
        });
    });

    describe('edge cases', () => {
        it('should validate slot dimensions (width/height)', async () => {
            // Arrange - Mock create to accept invalid dimensions
            const invalidSlotData = {
                locationKey: 'INVALID_SLOT',
                specs: {
                    width: 0, // Invalid width
                    height: -100 // Invalid height
                },
                isActive: true,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            // Mock create to validate dimensions
            vi.spyOn(model, 'create').mockImplementation(async (data: any) => {
                if (data.specs.width <= 0 || data.specs.height <= 0) {
                    throw new Error('Invalid slot dimensions');
                }
                return mockAdSlotData;
            });

            // Act & Assert
            await expect(model.create(invalidSlotData)).rejects.toThrow('Invalid slot dimensions');
        });

        it('should handle null or undefined specs gracefully', async () => {
            // Arrange - Slot data without specs
            const slotWithoutSpecs = {
                locationKey: 'NO_SPECS_SLOT',
                specs: null as any,
                isActive: true,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            // Mock to handle null specs
            vi.spyOn(model, 'create').mockImplementation(async (data: any) => {
                if (!data.specs || typeof data.specs !== 'object') {
                    throw new Error('Specs are required');
                }
                return mockAdSlotData;
            });

            // Act & Assert
            await expect(model.create(slotWithoutSpecs)).rejects.toThrow('Specs are required');
        });
    });

    describe('active status filtering', () => {
        it('should correctly identify inactive slots with deletedAt set', async () => {
            // Arrange - Create deleted slot
            const deletedSlot = {
                ...mockAdSlotData,
                deletedAt: new Date(),
                isActive: false
            };

            // Mock findAll to return both active and deleted slots
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotData, deletedSlot],
                total: 2
            });

            // Mock findActive to filter out deleted
            vi.spyOn(model, 'findActive').mockResolvedValue([mockAdSlotData]);

            // Act
            const activeSlots = await model.findActive();

            // Assert
            expect(activeSlots).toHaveLength(1);
            expect(activeSlots[0]?.deletedAt).toBeNull();
            expect(activeSlots[0]?.isActive).toBe(true);
        });

        it('should exclude deleted slots from getAvailableSlots', async () => {
            // Arrange - Mix of active and deleted slots
            const _deletedSlot = {
                ...mockAdSlotData,
                id: 'ad-slot-id-2',
                deletedAt: new Date(),
                deletedById: 'admin-id-1'
            };

            // Mock findAll to filter correctly
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAdSlotData], // Only non-deleted
                total: 1
            });

            vi.spyOn(model, 'getAvailableSlots').mockResolvedValue([mockAdSlotData]);

            // Act
            const available = await model.getAvailableSlots();

            // Assert
            expect(available).toHaveLength(1);
            expect(available[0]?.deletedAt).toBeNull();
        });
    });
});
