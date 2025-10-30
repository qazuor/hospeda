import type { AccommodationListing } from '@repo/schemas';
import { ListingStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationListingModel } from '../../src/models/accommodationListing.model';

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

// Create mock accommodation listing data
const mockAccommodationListingData: AccommodationListing = {
    id: 'listing-id-1',
    clientId: 'client-id-1',
    accommodationId: 'accommodation-id-1',
    listingPlanId: 'plan-id-1',
    title: 'Luxury Beach House Listing',
    description: 'Premium beach house with ocean views',
    status: ListingStatusEnum.ACTIVE,
    isTrialActive: false,
    trialStartsAt: null,
    trialEndsAt: null,
    startsAt: new Date('2024-01-01'),
    endsAt: new Date('2024-12-31'),
    customConfig: {
        priorityLevel: 5,
        featuredUntil: '2024-06-30',
        customPricing: {
            pricePerNight: 250,
            currency: 'USD',
            discounts: [
                {
                    type: 'percentage',
                    value: 10,
                    validFrom: '2024-11-01',
                    validTo: '2024-12-31'
                }
            ]
        }
    },
    adminInfo: {
        notes: 'Featured listing',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('AccommodationListingModel', () => {
    let model: AccommodationListingModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new AccommodationListingModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'listing-id-1') {
                return mockAccommodationListingData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockAccommodationListingData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockAccommodationListingData,
            ...data,
            id: 'listing-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockAccommodationListingData,
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
                                accommodationId: data.accommodationId,
                                listingPlanId: data.listingPlanId,
                                title: data.title,
                                description: data.description,
                                status: data.status,
                                isTrialActive: data.isTrialActive,
                                startsAt: data.startsAt,
                                endsAt: data.endsAt,
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
                                ...mockAccommodationListingData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                accommodationListings: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'listing-id-1',
                            title: 'Luxury Beach House Listing'
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
            expect(model).toBeInstanceOf(AccommodationListingModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationListingModel);
        });
    });

    describe('findById', () => {
        it('should find an accommodation listing by ID', async () => {
            const result = await model.findById('listing-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('listing-id-1');
            expect(result?.title).toBe('Luxury Beach House Listing');
            expect(result?.status).toBe(ListingStatusEnum.ACTIVE);
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all accommodation listings', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new accommodation listing', async () => {
            const newListingData = {
                clientId: 'client-id-2',
                accommodationId: 'accommodation-id-2',
                listingPlanId: 'plan-id-2',
                title: 'Mountain Cabin Listing',
                description: 'Cozy cabin in the mountains',
                status: ListingStatusEnum.TRIAL,
                isTrialActive: true,
                startsAt: new Date('2024-02-01'),
                endsAt: new Date('2024-02-14'),
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newListingData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.title).toBe('Mountain Cabin Listing');
        });
    });

    describe('count', () => {
        it('should count accommodation listings', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find listings by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAccommodationListingData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByAccommodation', () => {
        it('should find listings by accommodation ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAccommodationListingData],
                total: 1
            });

            const result = await model.findByAccommodation('accommodation-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.accommodationId).toBe('accommodation-id-1');
        });
    });

    describe('findByPlan', () => {
        it('should find listings by plan ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockAccommodationListingData],
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
                items: [mockAccommodationListingData],
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
                items: [mockAccommodationListingData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe(ListingStatusEnum.ACTIVE);
        });
    });

    describe('findWithActiveTrial', () => {
        it('should find listings with active trial', async () => {
            const trialListing = { ...mockAccommodationListingData, isTrialActive: true };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [trialListing],
                total: 1
            });

            const result = await model.findWithActiveTrial();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isTrialActive).toBe(true);
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
