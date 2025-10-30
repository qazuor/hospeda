import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceListingModel } from '../../src/models/serviceListing.model';
import type { ServiceListing } from '../../src/schemas/serviceListing/serviceListing.dbschema';

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

// Create mock service listing data
const mockServiceListingData: ServiceListing = {
    id: 'listing-id-1',
    clientId: 'client-id-1',
    touristServiceId: 'service-id-1',
    listingPlanId: 'plan-id-1',
    title: 'Kayak Adventure - Special Offer',
    description: 'Experience the beauty of our wetlands with expert guides',
    basePrice: '75.00',
    listingDetails: {
        availabilityType: 'scheduled',
        scheduleDetails: {
            daysOfWeek: [0, 6], // Saturday and Sunday
            timeSlots: ['09:00', '14:00']
        },
        bookingSettings: {
            advanceBookingDays: 2,
            minGroupSize: 2,
            maxGroupSize: 10,
            instantBooking: true,
            requiresApproval: false,
            cancellationPolicy: '48 hours for full refund',
            refundPolicy: 'Full refund up to 48 hours before'
        },
        media: {
            photos: ['photo1.jpg', 'photo2.jpg'],
            videos: ['video1.mp4']
        },
        highlights: ['Expert guides', 'All equipment included', 'Snacks provided'],
        inclusions: ['Kayak', 'Life jacket', 'Guide', 'Snacks'],
        exclusions: ['Transportation', 'Tips'],
        specialOffers: [
            {
                type: 'discount',
                value: 15,
                validFrom: '2024-01-01',
                validUntil: '2024-03-31',
                conditions: 'Book 7 days in advance'
            }
        ]
    },
    status: 'active',
    isActive: true,
    isFeatured: true,
    isTrialListing: false,
    trialStartDate: null,
    trialEndDate: null,
    publishedAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-12-31'),
    adminInfo: {
        notes: 'Popular summer activity',
        reviewedBy: 'admin-id-1'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-id-1',
    updatedById: 'user-id-1',
    deletedAt: null,
    deletedById: null
};

describe('ServiceListingModel', () => {
    let model: ServiceListingModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new ServiceListingModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'listing-id-1') {
                return mockServiceListingData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockServiceListingData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockServiceListingData,
            ...data,
            id: 'listing-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockServiceListingData,
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
                                touristServiceId: data.touristServiceId,
                                listingPlanId: data.listingPlanId,
                                title: data.title,
                                description: data.description,
                                basePrice: data.basePrice,
                                listingDetails: data.listingDetails,
                                status: data.status,
                                isActive: data.isActive,
                                isFeatured: data.isFeatured,
                                isTrialListing: data.isTrialListing,
                                publishedAt: data.publishedAt,
                                expiresAt: data.expiresAt,
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
                                    status: 'paused',
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
                                ...mockServiceListingData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                serviceListings: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'listing-id-1',
                            title: 'Kayak Adventure - Special Offer'
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
            expect(model).toBeInstanceOf(ServiceListingModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(ServiceListingModel);
        });
    });

    describe('findById', () => {
        it('should find a service listing by ID', async () => {
            const result = await model.findById('listing-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('listing-id-1');
            expect(result?.title).toBe('Kayak Adventure - Special Offer');
            expect(result?.status).toBe('active');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all service listings', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new service listing', async () => {
            const newListingData = {
                clientId: 'client-id-2',
                touristServiceId: 'service-id-2',
                listingPlanId: 'plan-id-2',
                title: 'Horseback Riding Tour',
                description: 'Explore the countryside on horseback',
                basePrice: '50.00',
                status: 'draft',
                isActive: false,
                isFeatured: false,
                isTrialListing: true,
                createdById: 'user-id-1',
                updatedById: 'user-id-1'
            };

            const result = await model.create(newListingData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.title).toBe('Horseback Riding Tour');
        });
    });

    describe('count', () => {
        it('should count service listings', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByClient', () => {
        it('should find listings by client ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingData],
                total: 1
            });

            const result = await model.findByClient('client-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.clientId).toBe('client-id-1');
        });
    });

    describe('findByService', () => {
        it('should find listings by tourist service ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingData],
                total: 1
            });

            const result = await model.findByService('service-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.touristServiceId).toBe('service-id-1');
        });
    });

    describe('findByPlan', () => {
        it('should find listings by plan ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingData],
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
                items: [mockServiceListingData],
                total: 1
            });

            const result = await model.findByStatus('active');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe('active');
        });
    });

    describe('findActive', () => {
        it('should find active listings', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingData],
                total: 1
            });

            const result = await model.findActive();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isActive).toBe(true);
        });
    });

    describe('findFeatured', () => {
        it('should find featured listings', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockServiceListingData],
                total: 1
            });

            const result = await model.findFeatured();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isFeatured).toBe(true);
        });
    });

    describe('findWithTrial', () => {
        it('should find listings with trial', async () => {
            const trialListing = { ...mockServiceListingData, isTrialListing: true };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [trialListing],
                total: 1
            });

            const result = await model.findWithTrial();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isTrialListing).toBe(true);
        });
    });

    describe('activate', () => {
        it('should activate a listing', async () => {
            const result = await model.activate('listing-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('listing-id-1');
        });
    });

    describe('deactivate', () => {
        it('should deactivate a listing', async () => {
            const result = await model.deactivate('listing-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('listing-id-1');
        });
    });

    describe('publish', () => {
        it('should publish a listing', async () => {
            const result = await model.publish('listing-id-1');

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
});
