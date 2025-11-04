import { FeaturedStatusEnum, FeaturedTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturedAccommodationModel } from '../../src/models/featuredAccommodation.model';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('FeaturedAccommodationModel', () => {
    let model: FeaturedAccommodationModel;
    let mockDb: any;

    const mockFeaturedData = {
        id: 'featured-1',
        clientId: 'client-1',
        accommodationId: 'accommodation-1',
        featuredType: FeaturedTypeEnum.HOME,
        fromDate: new Date('2024-01-01').toISOString(),
        toDate: new Date('2024-12-31').toISOString(),
        status: FeaturedStatusEnum.ACTIVE,
        createdById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new FeaturedAccommodationModel();

        mockDb = {
            query: {
                featuredAccommodations: {
                    findFirst: vi.fn(),
                    findMany: vi.fn()
                }
            },
            insert: vi.fn(),
            update: vi.fn(),
            select: vi.fn()
        };

        const clientModule = await import('../../src/client');
        vi.mocked(clientModule.getDb).mockReturnValue(mockDb);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(FeaturedAccommodationModel);
        });

        it('should have correct table name', () => {
            const tableName = (model as any).getTableName();
            expect(tableName).toBe('featured_accommodations');
        });
    });

    describe('featureOnHome', () => {
        it('should feature accommodation on home page', async () => {
            const mockCreated = { ...mockFeaturedData, featuredType: FeaturedTypeEnum.HOME };

            vi.spyOn(model, 'create').mockResolvedValue(mockCreated as any);

            const result = await model.featureOnHome({
                clientId: 'client-1',
                accommodationId: 'accommodation-1',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31'),
                createdById: 'user-1'
            });

            expect(result).toBeDefined();
            expect(result.featuredType).toBe(FeaturedTypeEnum.HOME);
            expect(result.status).toBe(FeaturedStatusEnum.ACTIVE);
            expect(model.create).toHaveBeenCalled();
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'create').mockRejectedValue(new Error('DB Error'));

            await expect(
                model.featureOnHome({
                    clientId: 'client-1',
                    accommodationId: 'accommodation-1',
                    fromDate: new Date(),
                    toDate: new Date()
                })
            ).rejects.toThrow();
        });
    });

    describe('featureInDestination', () => {
        it('should feature accommodation in destination pages', async () => {
            const mockCreated = { ...mockFeaturedData, featuredType: FeaturedTypeEnum.DESTINATION };

            vi.spyOn(model, 'create').mockResolvedValue(mockCreated as any);

            const result = await model.featureInDestination({
                clientId: 'client-1',
                accommodationId: 'accommodation-1',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31'),
                createdById: 'user-1'
            });

            expect(result).toBeDefined();
            expect(result.featuredType).toBe(FeaturedTypeEnum.DESTINATION);
            expect(result.status).toBe(FeaturedStatusEnum.ACTIVE);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'create').mockRejectedValue(new Error('DB Error'));

            await expect(
                model.featureInDestination({
                    clientId: 'client-1',
                    accommodationId: 'accommodation-1',
                    fromDate: new Date(),
                    toDate: new Date()
                })
            ).rejects.toThrow();
        });
    });

    describe('featureInSearch', () => {
        it('should feature accommodation in search results', async () => {
            const mockCreated = { ...mockFeaturedData, featuredType: FeaturedTypeEnum.SEARCH };

            vi.spyOn(model, 'create').mockResolvedValue(mockCreated as any);

            const result = await model.featureInSearch({
                clientId: 'client-1',
                accommodationId: 'accommodation-1',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-12-31'),
                createdById: 'user-1'
            });

            expect(result).toBeDefined();
            expect(result.featuredType).toBe(FeaturedTypeEnum.SEARCH);
            expect(result.status).toBe(FeaturedStatusEnum.ACTIVE);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'create').mockRejectedValue(new Error('DB Error'));

            await expect(
                model.featureInSearch({
                    clientId: 'client-1',
                    accommodationId: 'accommodation-1',
                    fromDate: new Date(),
                    toDate: new Date()
                })
            ).rejects.toThrow();
        });
    });

    describe('isActive', () => {
        it('should return true for active featured in date range', async () => {
            const now = new Date();
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.ACTIVE,
                fromDate: new Date(now.getTime() - 86400000).toISOString(), // Yesterday
                toDate: new Date(now.getTime() + 86400000).toISOString() // Tomorrow
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(true);
        });

        it('should return false for inactive status', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.INACTIVE,
                fromDate: new Date().toISOString(),
                toDate: new Date(Date.now() + 86400000).toISOString()
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(false);
        });

        it('should return false for past date range', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.ACTIVE,
                fromDate: new Date('2020-01-01').toISOString(),
                toDate: new Date('2020-12-31').toISOString()
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(false);
        });

        it('should return false for future date range', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.ACTIVE,
                fromDate: new Date('2030-01-01').toISOString(),
                toDate: new Date('2030-12-31').toISOString()
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(false);
        });

        it('should return false if featured not found', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            const result = await model.isActive('non-existent');

            expect(result).toBe(false);
        });

        it('should handle null dates correctly', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.ACTIVE,
                fromDate: null,
                toDate: null
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(true); // Active with no date restrictions
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findById').mockRejectedValue(new Error('DB Error'));

            await expect(model.isActive('featured-1')).rejects.toThrow();
        });
    });

    describe('calculateVisibility', () => {
        it('should return high score for active HOME placement', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                featuredType: FeaturedTypeEnum.HOME,
                status: FeaturedStatusEnum.ACTIVE
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);
            vi.spyOn(model, 'isActive').mockResolvedValue(true);

            const score = await model.calculateVisibility('featured-1');

            expect(score).toBe(100);
        });

        it('should return medium score for active DESTINATION placement', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                featuredType: FeaturedTypeEnum.DESTINATION
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);
            vi.spyOn(model, 'isActive').mockResolvedValue(true);

            const score = await model.calculateVisibility('featured-1');

            expect(score).toBe(80);
        });

        it('should return lower score for active SEARCH placement', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                featuredType: FeaturedTypeEnum.SEARCH
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);
            vi.spyOn(model, 'isActive').mockResolvedValue(true);

            const score = await model.calculateVisibility('featured-1');

            expect(score).toBe(60);
        });

        it('should return 0 for inactive featured', async () => {
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.INACTIVE
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);
            vi.spyOn(model, 'isActive').mockResolvedValue(false);

            const score = await model.calculateVisibility('featured-1');

            expect(score).toBe(0);
        });

        it('should throw error if featured not found', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            await expect(model.calculateVisibility('non-existent')).rejects.toThrow(
                'Featured accommodation not found'
            );
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findById').mockRejectedValue(new Error('DB Error'));

            await expect(model.calculateVisibility('featured-1')).rejects.toThrow();
        });
    });

    describe('getPlacementStats', () => {
        it('should return stats for valid featured accommodation', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(mockFeaturedData as any);

            const stats = await model.getPlacementStats('featured-1');

            expect(stats).toBeDefined();
            expect(typeof stats.views).toBe('number');
            expect(typeof stats.clicks).toBe('number');
            expect(typeof stats.conversions).toBe('number');
            expect(typeof stats.position).toBe('number');
            expect(stats.position).toBeGreaterThan(0);
            expect(stats.position).toBeLessThanOrEqual(5);
        });

        it('should throw error if featured not found', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            await expect(model.getPlacementStats('non-existent')).rejects.toThrow(
                'Featured accommodation not found'
            );
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findById').mockRejectedValue(new Error('DB Error'));

            await expect(model.getPlacementStats('featured-1')).rejects.toThrow();
        });
    });

    describe('getPriority', () => {
        it('should return priority for valid featured accommodation', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(mockFeaturedData as any);

            const priority = await model.getPriority('featured-1');

            expect(typeof priority).toBe('number');
            expect(priority).toBeGreaterThan(0);
            expect(priority).toBeLessThanOrEqual(10);
        });

        it('should throw error if featured not found', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            await expect(model.getPriority('non-existent')).rejects.toThrow(
                'Featured accommodation not found'
            );
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findById').mockRejectedValue(new Error('DB Error'));

            await expect(model.getPriority('featured-1')).rejects.toThrow();
        });
    });

    describe('updatePriority', () => {
        it('should update priority successfully', async () => {
            const mockUpdated = { ...mockFeaturedData, updatedAt: new Date() };

            vi.spyOn(model, 'updateById').mockResolvedValue(mockUpdated as any);
            vi.spyOn(model, 'findById').mockResolvedValue(mockUpdated as any);

            const result = await model.updatePriority('featured-1', 5);

            expect(result).toBeDefined();
            expect(result.id).toBe('featured-1');
        });

        it('should throw error if featured not found after update', async () => {
            vi.spyOn(model, 'updateById').mockResolvedValue({} as any);
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            await expect(model.updatePriority('featured-1', 5)).rejects.toThrow(
                'Featured accommodation not found after priority update'
            );
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'updateById').mockRejectedValue(new Error('DB Error'));

            await expect(model.updatePriority('featured-1', 5)).rejects.toThrow();
        });
    });

    describe('resolvePriorityConflicts', () => {
        it('should resolve conflicts for featured type', async () => {
            const mockFeatures = [
                { ...mockFeaturedData, id: 'f-1', featuredType: FeaturedTypeEnum.HOME },
                { ...mockFeaturedData, id: 'f-2', featuredType: FeaturedTypeEnum.HOME }
            ];

            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: mockFeatures as any,
                total: 2
            });

            const result = await model.resolvePriorityConflicts(FeaturedTypeEnum.HOME);

            expect(result).toHaveLength(2);
        });

        it('should return empty array if no active features', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            const result = await model.resolvePriorityConflicts(FeaturedTypeEnum.HOME);

            expect(result).toHaveLength(0);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('DB Error'));

            await expect(model.resolvePriorityConflicts(FeaturedTypeEnum.HOME)).rejects.toThrow();
        });
    });

    describe('findByType', () => {
        it('should find featured accommodations by type', async () => {
            const mockFeatures = [
                { ...mockFeaturedData, featuredType: FeaturedTypeEnum.HOME },
                { ...mockFeaturedData, id: 'f-2', featuredType: FeaturedTypeEnum.HOME }
            ];

            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: mockFeatures as any,
                total: 2
            });

            const result = await model.findByType(FeaturedTypeEnum.HOME);

            expect(result).toHaveLength(2);
            expect(result[0]?.featuredType).toBe(FeaturedTypeEnum.HOME);
        });

        it('should return empty array if no matches', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            const result = await model.findByType(FeaturedTypeEnum.DESTINATION);

            expect(result).toHaveLength(0);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('DB Error'));

            await expect(model.findByType(FeaturedTypeEnum.HOME)).rejects.toThrow();
        });
    });

    describe('findByAccommodation', () => {
        it('should find featured entries by accommodation ID', async () => {
            const mockFeatures = [
                { ...mockFeaturedData, accommodationId: 'acc-1' },
                { ...mockFeaturedData, id: 'f-2', accommodationId: 'acc-1' }
            ];

            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: mockFeatures as any,
                total: 2
            });

            const result = await model.findByAccommodation('acc-1');

            expect(result).toHaveLength(2);
            expect(result[0]?.accommodationId).toBe('acc-1');
        });

        it('should return empty array if no matches', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            const result = await model.findByAccommodation('non-existent');

            expect(result).toHaveLength(0);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('DB Error'));

            await expect(model.findByAccommodation('acc-1')).rejects.toThrow();
        });
    });

    describe('findActive', () => {
        it('should find all active featured accommodations', async () => {
            const mockFeatures = [
                { ...mockFeaturedData, status: FeaturedStatusEnum.ACTIVE },
                { ...mockFeaturedData, id: 'f-2', status: FeaturedStatusEnum.ACTIVE }
            ];

            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: mockFeatures as any,
                total: 2
            });

            const result = await model.findActive();

            expect(result).toHaveLength(2);
            expect(result[0]?.status).toBe(FeaturedStatusEnum.ACTIVE);
        });

        it('should return empty array if no active features', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

            const result = await model.findActive();

            expect(result).toHaveLength(0);
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('DB Error'));

            await expect(model.findActive()).rejects.toThrow();
        });
    });

    describe('withAccommodation', () => {
        it('should return featured with accommodation details', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(mockFeaturedData as any);

            const result = await model.withAccommodation('featured-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('featured-1');
            expect(result.accommodation).toBeDefined();
            expect(result.accommodation?.id).toBe(mockFeaturedData.accommodationId);
        });

        it('should throw error if featured not found', async () => {
            vi.spyOn(model, 'findById').mockResolvedValue(null);

            await expect(model.withAccommodation('non-existent')).rejects.toThrow(
                'Featured accommodation not found'
            );
        });

        it('should throw error on database failure', async () => {
            vi.spyOn(model, 'findById').mockRejectedValue(new Error('DB Error'));

            await expect(model.withAccommodation('featured-1')).rejects.toThrow();
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle concurrent feature creation', async () => {
            const params = {
                clientId: 'client-1',
                accommodationId: 'acc-1',
                fromDate: new Date(),
                toDate: new Date()
            };

            // Mock create to return different values based on input
            vi.spyOn(model, 'create').mockImplementation(async (data: any) => {
                return {
                    ...mockFeaturedData,
                    featuredType: data.featuredType // Return the type from input
                } as any;
            });

            const [result1, result2] = await Promise.all([
                model.featureOnHome(params),
                model.featureInDestination(params)
            ]);

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            expect(result1.featuredType).toBe(FeaturedTypeEnum.HOME);
            expect(result2.featuredType).toBe(FeaturedTypeEnum.DESTINATION);
        });

        it('should handle date edge cases in isActive', async () => {
            const now = new Date();
            const mockFeatured = {
                ...mockFeaturedData,
                status: FeaturedStatusEnum.ACTIVE,
                fromDate: now.toISOString(),
                toDate: now.toISOString()
            };

            vi.spyOn(model, 'findById').mockResolvedValue(mockFeatured as any);

            const result = await model.isActive('featured-1');

            expect(result).toBe(true); // Same date should be considered active
        });

        it('should handle missing optional createdById', async () => {
            vi.spyOn(model, 'create').mockResolvedValue(mockFeaturedData as any);

            const result = await model.featureOnHome({
                clientId: 'client-1',
                accommodationId: 'acc-1',
                fromDate: new Date(),
                toDate: new Date()
                // createdById is optional
            });

            expect(result).toBeDefined();
        });
    });
});
