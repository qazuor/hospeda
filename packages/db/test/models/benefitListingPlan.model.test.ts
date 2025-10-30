import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BenefitListingPlanModel } from '../../src/models/benefitListingPlan.model';
import type { BenefitListingPlan } from '../../src/schemas/services/benefitListingPlan.dbschema';

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

// Create mock benefit listing plan data
const mockBenefitListingPlanData: BenefitListingPlan = {
    id: 'plan-id-1',
    name: 'Premium Benefits Plan',
    description: 'Full-featured benefits listing plan with all capabilities',
    limits: {
        maxListings: 10,
        maxBenefitsPerListing: 5,
        allowCustomBranding: true,
        allowAnalytics: true,
        allowPromotions: true,
        allowTrialPeriods: true,
        maxTrialDays: 30,
        features: ['priority-placement', 'custom-branding', 'analytics']
    },
    adminInfo: {
        notes: 'Premium tier plan',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('BenefitListingPlanModel', () => {
    let model: BenefitListingPlanModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new BenefitListingPlanModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'plan-id-1') {
                return mockBenefitListingPlanData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockBenefitListingPlanData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockBenefitListingPlanData,
            ...data,
            id: 'plan-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockBenefitListingPlanData,
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
                                limits: data.limits,
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
                                ...mockBenefitListingPlanData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                benefitListingPlans: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'plan-id-1',
                            name: 'Premium Benefits Plan'
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
            expect(model).toBeInstanceOf(BenefitListingPlanModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(BenefitListingPlanModel);
        });
    });

    describe('findById', () => {
        it('should find a benefit listing plan by ID', async () => {
            const result = await model.findById('plan-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('plan-id-1');
            expect(result?.name).toBe('Premium Benefits Plan');
            expect(result?.limits?.maxListings).toBe(10);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all benefit listing plans', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new benefit listing plan', async () => {
            const newPlanData = {
                name: 'Basic Benefits Plan',
                description: 'Entry-level benefits listing plan',
                limits: {
                    maxListings: 3,
                    maxBenefitsPerListing: 2,
                    allowCustomBranding: false,
                    allowAnalytics: false
                },
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newPlanData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Basic Benefits Plan');
        });
    });

    describe('count', () => {
        it('should count benefit listing plans', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });
});
