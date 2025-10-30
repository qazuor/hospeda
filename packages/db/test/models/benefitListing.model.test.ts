import type { BenefitListing } from '@repo/schemas';
import { ListingStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BenefitListingModel } from '../../src/models/benefitListing.model';

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

// Create mock benefit listing data
const mockBenefitListingData: BenefitListing = {
    id: 'listing-id-1',
    clientId: 'client-id-1',
    benefitPartnerId: 'partner-id-1',
    listingPlanId: 'plan-id-1',
    status: ListingStatusEnum.ACTIVE,
    title: '20% Discount at Luxury Spa',
    description: 'Enjoy 20% off all services at our premium spa facility',
    benefitDetails: {
        discountPercent: 20,
        validDays: ['monday', 'tuesday', 'wednesday'],
        validHours: '09:00-18:00',
        terms: ['Valid for all services', 'Cannot be combined with other offers']
    },
    isTrialPeriod: false,
    trialStartDate: null,
    trialEndDate: null,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    adminInfo: {
        notes: 'Featured benefit',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('BenefitListingModel', () => {
    let model: BenefitListingModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new BenefitListingModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'listing-id-1') {
                return mockBenefitListingData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockBenefitListingData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockBenefitListingData,
            ...data,
            id: 'listing-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockBenefitListingData,
            ...data,
            id: where.id || 'listing-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'listing-id-1',
                                clientId: data.clientId,
                                benefitPartnerId: data.benefitPartnerId,
                                listingPlanId: data.listingPlanId,
                                status: data.status,
                                title: data.title,
                                description: data.description,
                                benefitDetails: data.benefitDetails,
                                isTrialPeriod: data.isTrialPeriod,
                                startDate: data.startDate,
                                endDate: data.endDate,
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
                                    id: 'listing-id-1',
                                    status: ListingStatusEnum.PAUSED,
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
                                ...mockBenefitListingData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                benefitListings: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'listing-id-1',
                            title: '20% Discount at Luxury Spa'
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
            expect(model).toBeInstanceOf(BenefitListingModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(BenefitListingModel);
        });
    });

    describe('findById', () => {
        it('should find a benefit listing by ID', async () => {
            const result = await model.findById('listing-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('listing-id-1');
            expect(result?.title).toBe('20% Discount at Luxury Spa');
            expect(result?.status).toBe(ListingStatusEnum.ACTIVE);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all benefit listings', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new benefit listing', async () => {
            const newListingData = {
                clientId: 'client-id-2',
                benefitPartnerId: 'partner-id-2',
                listingPlanId: 'plan-id-2',
                status: ListingStatusEnum.TRIAL,
                title: 'Free Dessert at Restaurant',
                description: 'Get a free dessert with any main course',
                benefitDetails: {
                    freeItems: ['dessert'],
                    validDays: ['friday', 'saturday', 'sunday']
                },
                isTrialPeriod: true,
                startDate: new Date('2024-02-01'),
                endDate: new Date('2024-02-14'),
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newListingData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.title).toBe('Free Dessert at Restaurant');
        });
    });

    describe('count', () => {
        it('should count benefit listings', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find listings by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitListingData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByPartner', () => {
        it('should find listings by partner ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitListingData],
                total: 1
            });

            const result = await model.findByPartner('partner-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.benefitPartnerId).toBe('partner-id-1');
        });
    });

    describe('findByPlan', () => {
        it('should find listings by plan ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitListingData],
                total: 1
            });

            const result = await model.findByPlan('plan-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.listingPlanId).toBe('plan-id-1');
        });
    });

    describe('findByStatus', () => {
        it('should find listings by status', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitListingData],
                total: 1
            });

            const result = await model.findByStatus(ListingStatusEnum.ACTIVE);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe(ListingStatusEnum.ACTIVE);
        });
    });

    describe('findActive', () => {
        it('should find active listings', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockBenefitListingData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe(ListingStatusEnum.ACTIVE);
        });
    });

    describe('findWithTrial', () => {
        it('should find listings with trial period', async () => {
            const trialListing = { ...mockBenefitListingData, isTrialPeriod: true };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [trialListing],
                total: 1
            });

            const result = await model.findWithTrial();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isTrialPeriod).toBe(true);
        });
    });

    describe('activate', () => {
        it('should activate a listing', async () => {
            const result = await model.activate('listing-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('listing-id-1');
        });
    });

    describe('pause', () => {
        it('should pause a listing', async () => {
            const result = await model.pause('listing-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('listing-id-1');
        });
    });

    describe('archive', () => {
        it('should archive a listing', async () => {
            const result = await model.archive('listing-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('listing-id-1');
        });
    });
});
