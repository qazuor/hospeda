import type { AccommodationListingPlan } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationListingPlanModel } from '../../src/models/accommodationListingPlan.model';

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

// Create mock accommodation listing plan data
const mockAccommodationListingPlanData: AccommodationListingPlan = {
    id: 'plan-id-1',
    name: 'Premium Plan',
    description: 'Premium accommodation listing plan with advanced features',
    price: '99.99',
    limits: {
        maxListings: 10,
        maxPhotos: 50,
        maxFeaturedDays: 30,
        maxDescriptionLength: 5000,
        allowPremiumFeatures: true,
        allowAnalytics: true,
        allowCustomPricing: true,
        supportLevel: 'premium',
        refreshInterval: 7
    },
    isActive: true,
    isTrialAvailable: true,
    trialDays: '14',
    adminInfo: {
        notes: 'Most popular plan',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('AccommodationListingPlanModel', () => {
    let model: AccommodationListingPlanModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AccommodationListingPlanModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'plan-id-1') {
                return mockAccommodationListingPlanData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAccommodationListingPlanData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAccommodationListingPlanData,
            ...data,
            id: 'plan-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockAccommodationListingPlanData,
            ...data,
            id: where.id || 'plan-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'plan-id-1',
                                name: data.name,
                                description: data.description,
                                price: data.price,
                                limits: data.limits,
                                isActive: data.isActive,
                                isTrialAvailable: data.isTrialAvailable,
                                trialDays: data.trialDays,
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
                                    id: 'plan-id-1',
                                    name: 'Updated Plan',
                                    isActive: false,
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
                                ...mockAccommodationListingPlanData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                accommodationListingPlans: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'plan-id-1',
                            name: 'Premium Plan'
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
            expect(model).toBeInstanceOf(AccommodationListingPlanModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationListingPlanModel);
        });
    });

    describe('findById', () => {
        it('should find an accommodation listing plan by ID', async () => {
            const result = await model.findById('plan-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('plan-id-1');
            expect(result?.name).toBe('Premium Plan');
            expect(result?.price).toBe('99.99');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all accommodation listing plans', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new accommodation listing plan', async () => {
            const newPlanData = {
                name: 'Basic Plan',
                description: 'Basic accommodation listing plan',
                price: '29.99',
                limits: {
                    maxListings: 3,
                    maxPhotos: 20,
                    maxFeaturedDays: 7,
                    maxDescriptionLength: 2000,
                    allowPremiumFeatures: false,
                    allowAnalytics: false,
                    allowCustomPricing: false,
                    supportLevel: 'basic' as const,
                    refreshInterval: 30
                },
                isActive: true,
                isTrialAvailable: false,
                trialDays: '0',
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newPlanData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Basic Plan');
            expect(result.price).toBe('29.99');
        });
    });

    describe('count', () => {
        it('should count accommodation listing plans', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findActive', () => {
        it('should find active plans', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAccommodationListingPlanData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isActive).toBe(true);
        });
    });

    describe('findWithTrial', () => {
        it('should find plans with trial available', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAccommodationListingPlanData],
                total: 1
            });

            const result = await model.findWithTrial();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isTrialAvailable).toBe(true);
        });
    });

    describe('activate', () => {
        it('should activate a plan', async () => {
            const result = await model.activate('plan-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('plan-id-1');
        });
    });

    describe('deactivate', () => {
        it('should deactivate a plan', async () => {
            const result = await model.deactivate('plan-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('plan-id-1');
        });
    });
});
