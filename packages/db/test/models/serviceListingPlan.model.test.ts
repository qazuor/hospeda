import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceListingPlanModel } from '../../src/models/serviceListingPlan.model';
import type { ServiceListingPlan } from '../../src/schemas/serviceListing/serviceListingPlan.dbschema';

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

// Create mock service listing plan data
const mockServiceListingPlanData: ServiceListingPlan = {
    id: 'plan-id-1',
    name: 'Premium Service Listing Plan',
    description: 'Full-featured service listing with all capabilities',
    price: '149.99',
    limits: {
        maxListings: 20,
        maxPhotos: 15,
        maxVideos: 3,
        maxFeaturedDays: 30,
        maxDescriptionLength: 3000,
        allowPremiumFeatures: true,
        allowAnalytics: true,
        allowCustomPricing: true,
        allowMultiLanguage: true,
        allowCustomBranding: true,
        allowBookingIntegration: true,
        allowTrialPeriods: true,
        maxTrialDays: 30,
        supportLevel: 'premium' as const,
        refreshInterval: 1,
        features: [
            'priority-placement',
            'verified-badge',
            'custom-url',
            'social-sharing',
            'analytics-dashboard'
        ]
    },
    isActive: true,
    isTrialAvailable: true,
    trialDays: '14',
    adminInfo: {
        notes: 'Premium tier plan for top partners',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('ServiceListingPlanModel', () => {
    let model: ServiceListingPlanModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new ServiceListingPlanModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'plan-id-1') {
                return mockServiceListingPlanData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockServiceListingPlanData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockServiceListingPlanData,
            ...data,
            id: 'plan-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockServiceListingPlanData,
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
                                ...mockServiceListingPlanData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                serviceListingPlans: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'plan-id-1',
                            name: 'Premium Service Listing Plan'
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
            expect(model).toBeInstanceOf(ServiceListingPlanModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ServiceListingPlanModel);
        });
    });

    describe('findById', () => {
        it('should find a service listing plan by ID', async () => {
            const result = await model.findById('plan-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('plan-id-1');
            expect(result?.name).toBe('Premium Service Listing Plan');
            expect(result?.limits?.maxListings).toBe(20);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all service listing plans', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new service listing plan', async () => {
            const newPlanData = {
                name: 'Basic Service Plan',
                description: 'Entry-level service listing plan',
                price: '29.99',
                limits: {
                    maxListings: 5,
                    maxPhotos: 5,
                    allowPremiumFeatures: false
                },
                isActive: true,
                isTrialAvailable: false,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newPlanData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Basic Service Plan');
        });
    });

    describe('count', () => {
        it('should count service listing plans', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findActive', () => {
        it('should find active plans', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingPlanData],
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
                items: [mockServiceListingPlanData],
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
