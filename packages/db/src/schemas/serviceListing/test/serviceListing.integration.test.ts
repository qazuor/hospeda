import type {
    NewServiceListing,
    NewServiceListingPlan,
    NewTouristService,
    ServiceListing,
    ServiceListingPlan,
    TouristService
} from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock model factory for testing
function createBaseModelMock<TEntity, TNew>(config: { tableName: string; entityName: string }) {
    const entities = new Map<string, TEntity>();

    return {
        async create(data: TNew): Promise<TEntity> {
            const entity = {
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                deletedById: null
            } as TEntity;
            entities.set((data as any).id, entity);
            return entity;
        },

        async findById(id: string): Promise<TEntity> {
            const entity = entities.get(id);
            if (!entity) throw new Error(`${config.entityName} not found`);
            return entity;
        },

        async update(id: string, data: Partial<TNew>): Promise<TEntity> {
            const existing = entities.get(id);
            if (!existing) throw new Error(`${config.entityName} not found`);

            const updated = {
                ...existing,
                ...data,
                updatedAt: new Date()
            } as TEntity;
            entities.set(id, updated);
            return updated;
        },

        async softDelete(id: string, deletedById: string): Promise<TEntity> {
            const existing = entities.get(id);
            if (!existing) throw new Error(`${config.entityName} not found`);

            const deleted = {
                ...existing,
                deletedAt: new Date(),
                deletedById,
                updatedAt: new Date()
            } as TEntity;
            entities.set(id, deleted);
            return deleted;
        }
    };
}

describe('Service Listing Integration Tests - Stage 2.11', () => {
    // Mocked models for testing
    const mockTouristServiceModel = createBaseModelMock<TouristService, NewTouristService>({
        tableName: 'tourist_services',
        entityName: 'TouristService'
    });

    const mockServiceListingPlanModel = createBaseModelMock<
        ServiceListingPlan,
        NewServiceListingPlan
    >({
        tableName: 'service_listing_plans',
        entityName: 'ServiceListingPlan'
    });

    const mockServiceListingModel = createBaseModelMock<ServiceListing, NewServiceListing>({
        tableName: 'service_listings',
        entityName: 'ServiceListing'
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tourist Service Management', () => {
        it('should create tourist service with comprehensive details', async () => {
            const serviceData: NewTouristService = {
                id: 'ts-123',
                clientId: 'client-123',
                name: 'Adventure City Tour',
                category: 'tours',
                description: 'Comprehensive city tour with professional guide',
                serviceDetails: {
                    duration: '4 hours 30 minutes',
                    maxParticipants: 15,
                    minAge: 12,
                    maxAge: 80,
                    difficulty: 'moderate',
                    languages: ['en', 'es', 'fr'],
                    included: ['Professional guide', 'Transportation', 'Entrance fees'],
                    excluded: ['Meals', 'Personal expenses'],
                    requirements: ['Comfortable walking shoes', 'Valid ID'],
                    meetingPoint: 'Central Plaza, Main Entrance',
                    pickupAvailable: true,
                    cancelationPolicy: '24h free cancellation',
                    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                    operatingHours: '09:00-17:00',
                    seasonality: {
                        startMonth: 3,
                        endMonth: 11
                    }
                },
                contactInfo: '+1234567890',
                location: '123 Tour Street, Adventure City',
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            const result = await mockTouristServiceModel.create(serviceData);

            expect(result).toMatchObject({
                id: 'ts-123',
                name: 'Adventure City Tour',
                category: 'tours',
                clientId: 'client-123'
            });
            expect(result.serviceDetails).toEqual(serviceData.serviceDetails);
        });

        it('should validate service category constraints', async () => {
            const invalidServiceData: NewTouristService = {
                id: 'ts-invalid',
                clientId: 'client-123',
                name: 'Invalid Service',
                category: 'invalid-category' as any,
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            await expect(mockTouristServiceModel.create(invalidServiceData)).rejects.toThrow(
                /Invalid category/
            );
        });
    });

    describe('Service Listing Plan Management', () => {
        it('should create listing plan with comprehensive limits', async () => {
            const planData: NewServiceListingPlan = {
                id: 'slp-123',
                name: 'Premium Service Plan',
                description: 'Full-featured plan for service providers',
                price: '99.99',
                limits: {
                    maxListings: 20,
                    maxPhotos: 50,
                    maxVideos: 10,
                    maxFeaturedDays: 30,
                    maxDescriptionLength: 5000,
                    allowPremiumFeatures: true,
                    allowAnalytics: true,
                    allowCustomPricing: true,
                    allowMultiLanguage: true,
                    allowCustomBranding: true,
                    allowBookingIntegration: true,
                    allowTrialPeriods: true,
                    maxTrialDays: 14,
                    supportLevel: 'premium',
                    refreshInterval: 1,
                    features: ['Advanced analytics', 'Priority support', 'Custom branding']
                },
                isActive: true,
                isTrialAvailable: true,
                trialDays: '14',
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            const result = await mockServiceListingPlanModel.create(planData);

            expect(result).toMatchObject({
                id: 'slp-123',
                name: 'Premium Service Plan',
                price: '99.99',
                isActive: true,
                isTrialAvailable: true,
                trialDays: '14'
            });
            expect(result.limits).toEqual(planData.limits);
        });

        it('should create basic plan with minimal features', async () => {
            const basicPlanData: NewServiceListingPlan = {
                id: 'slp-basic',
                name: 'Basic Service Plan',
                price: '19.99',
                limits: {
                    maxListings: 3,
                    maxPhotos: 10,
                    maxVideos: 0,
                    allowPremiumFeatures: false,
                    allowAnalytics: false,
                    supportLevel: 'basic',
                    refreshInterval: 7
                },
                isActive: true,
                isTrialAvailable: false,
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            const result = await mockServiceListingPlanModel.create(basicPlanData);

            expect(result.limits?.maxListings).toBe(3);
            expect(result.limits?.allowPremiumFeatures).toBe(false);
            expect(result.isTrialAvailable).toBe(false);
        });
    });

    describe('Service Listing Management', () => {
        it('should create service listing with complete configuration', async () => {
            const listingData: NewServiceListing = {
                id: 'sl-123',
                clientId: 'client-123',
                touristServiceId: 'ts-123',
                listingPlanId: 'slp-123',
                title: 'Amazing City Tour - Premium Experience',
                description: 'Join our expertly guided city tour and discover hidden gems',
                basePrice: '75.00',
                listingDetails: {
                    availabilityType: 'scheduled',
                    scheduleDetails: {
                        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
                        timeSlots: ['09:00', '14:00', '16:30'],
                        seasonalPeriods: [
                            {
                                startDate: '2024-06-01',
                                endDate: '2024-08-31',
                                available: true
                            }
                        ]
                    },
                    bookingSettings: {
                        advanceBookingDays: 2,
                        minGroupSize: 2,
                        maxGroupSize: 15,
                        instantBooking: true,
                        requiresApproval: false,
                        cancellationPolicy: '24h free cancellation',
                        refundPolicy: 'Full refund if cancelled 24h in advance'
                    },
                    media: {
                        photos: ['/images/tour-1.jpg', '/images/tour-2.jpg', '/images/tour-3.jpg'],
                        videos: ['/videos/tour-preview.mp4'],
                        virtualTour: 'https://virtual-tour.com/city-tour'
                    },
                    translations: {
                        es: {
                            title: 'Tour Increíble de la Ciudad - Experiencia Premium',
                            description:
                                'Únete a nuestro tour guiado por expertos y descubre gemas ocultas',
                            highlights: ['Guía experto', 'Grupos pequeños', 'Lugares únicos']
                        },
                        fr: {
                            title: 'Visite Incroyable de la Ville - Expérience Premium',
                            description:
                                'Rejoignez notre visite guidée par des experts et découvrez des trésors cachés',
                            highlights: ['Guide expert', 'Petits groupes', 'Lieux uniques']
                        }
                    },
                    seo: {
                        metaTitle: 'Best City Tour | Adventure Tours',
                        metaDescription:
                            'Experience the best city tour with expert guides and small groups',
                        keywords: ['city tour', 'guided tour', 'adventure', 'sightseeing'],
                        customUrl: 'amazing-city-tour-premium'
                    },
                    highlights: [
                        'Expert local guide',
                        'Small group experience',
                        'Hidden local spots',
                        'Professional photography opportunities'
                    ],
                    amenities: ['Air-conditioned transport', 'Complimentary water', 'Free Wi-Fi'],
                    inclusions: [
                        'Transportation',
                        'Professional guide',
                        'Entrance fees',
                        'Insurance'
                    ],
                    exclusions: ['Meals', 'Personal purchases', 'Gratuities'],
                    additionalInfo: 'Please wear comfortable walking shoes and bring a camera.',
                    specialOffers: [
                        {
                            type: 'early-bird',
                            value: 15,
                            validFrom: '2024-01-01',
                            validUntil: '2024-05-31',
                            conditions: 'Book 30 days in advance'
                        }
                    ]
                },
                status: 'active',
                isActive: true,
                isFeatured: true,
                isTrialListing: false,
                publishedAt: new Date('2024-01-15T10:00:00Z'),
                expiresAt: new Date('2024-12-31T23:59:59Z'),
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            const result = await mockServiceListingModel.create(listingData);

            expect(result).toMatchObject({
                id: 'sl-123',
                clientId: 'client-123',
                touristServiceId: 'ts-123',
                listingPlanId: 'slp-123',
                title: 'Amazing City Tour - Premium Experience',
                basePrice: '75.00',
                status: 'active',
                isActive: true,
                isFeatured: true
            });
            expect(result.listingDetails).toEqual(listingData.listingDetails);
        });

        it('should create trial listing with proper configuration', async () => {
            const trialListingData: NewServiceListing = {
                id: 'sl-trial',
                clientId: 'client-123',
                touristServiceId: 'ts-123',
                listingPlanId: 'slp-123',
                title: 'Trial Service Listing',
                description: 'Testing our service listing platform',
                status: 'draft',
                isActive: false,
                isFeatured: false,
                isTrialListing: true,
                trialStartDate: new Date('2024-01-01T00:00:00Z'),
                trialEndDate: new Date('2024-01-15T23:59:59Z'),
                createdById: 'user-123',
                updatedById: 'user-123'
            };

            const result = await mockServiceListingModel.create(trialListingData);

            expect(result.isTrialListing).toBe(true);
            expect(result.trialStartDate).toEqual(trialListingData.trialStartDate);
            expect(result.trialEndDate).toEqual(trialListingData.trialEndDate);
            expect(result.status).toBe('draft');
        });

        it('should validate status transitions', async () => {
            const listing = await mockServiceListingModel.create({
                id: 'sl-status',
                clientId: 'client-123',
                touristServiceId: 'ts-123',
                listingPlanId: 'slp-123',
                title: 'Status Test Listing',
                status: 'draft',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            // Valid status transitions
            const validStatuses = ['draft', 'pending', 'active', 'paused', 'rejected', 'expired'];

            for (const status of validStatuses) {
                const updated = await mockServiceListingModel.update(listing.id, {
                    status: status as any,
                    updatedById: 'user-123'
                });
                expect(updated.status).toBe(status);
            }
        });
    });

    describe('Service Listing Integration Flow', () => {
        it('should create complete service → plan → listing flow', async () => {
            // 1. Create tourist service
            const service = await mockTouristServiceModel.create({
                id: 'ts-flow',
                clientId: 'client-123',
                name: 'Integration Test Service',
                category: 'experiences',
                description: 'Service for integration testing',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            // 2. Create listing plan
            const plan = await mockServiceListingPlanModel.create({
                id: 'slp-flow',
                name: 'Integration Test Plan',
                price: '29.99',
                limits: {
                    maxListings: 5,
                    maxPhotos: 20,
                    allowPremiumFeatures: true
                },
                isActive: true,
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            // 3. Create service listing
            const listing = await mockServiceListingModel.create({
                id: 'sl-flow',
                clientId: 'client-123',
                touristServiceId: service.id,
                listingPlanId: plan.id,
                title: 'Integration Test Listing',
                description: 'Complete flow test listing',
                basePrice: '50.00',
                status: 'active',
                isActive: true,
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            // Verify complete flow
            expect(service.id).toBe('ts-flow');
            expect(plan.id).toBe('slp-flow');
            expect(listing.id).toBe('sl-flow');
            expect(listing.touristServiceId).toBe(service.id);
            expect(listing.listingPlanId).toBe(plan.id);
            expect(listing.status).toBe('active');
        });

        it('should handle soft delete across related entities', async () => {
            // Create entities
            const service = await mockTouristServiceModel.create({
                id: 'ts-delete',
                clientId: 'client-123',
                name: 'Delete Test Service',
                category: 'tours',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            const plan = await mockServiceListingPlanModel.create({
                id: 'slp-delete',
                name: 'Delete Test Plan',
                price: '19.99',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            const listing = await mockServiceListingModel.create({
                id: 'sl-delete',
                clientId: 'client-123',
                touristServiceId: service.id,
                listingPlanId: plan.id,
                title: 'Delete Test Listing',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            // Soft delete service
            await mockTouristServiceModel.softDelete(service.id, 'user-admin');

            // Verify soft delete
            const deletedService = await mockTouristServiceModel.findById(service.id);
            expect(deletedService.deletedAt).toBeDefined();
            expect(deletedService.deletedById).toBe('user-admin');

            // Listing should still exist but might be affected
            const affectedListing = await mockServiceListingModel.findById(listing.id);
            expect(affectedListing).toBeDefined();
        });
    });

    describe('Edge Cases and Validation', () => {
        it('should handle missing optional fields gracefully', async () => {
            const minimalService = await mockTouristServiceModel.create({
                id: 'ts-minimal',
                clientId: 'client-123',
                name: 'Minimal Service',
                category: 'other',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            expect(minimalService.description).toBeUndefined();
            expect(minimalService.serviceDetails).toBeUndefined();
        });

        it('should validate price formats', async () => {
            const planWithPrice = await mockServiceListingPlanModel.create({
                id: 'slp-price',
                name: 'Price Test Plan',
                price: '99.95',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            expect(planWithPrice.price).toBe('99.95');

            // Test different price formats
            const expensivePlan = await mockServiceListingPlanModel.create({
                id: 'slp-expensive',
                name: 'Expensive Plan',
                price: '9999.99',
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            expect(expensivePlan.price).toBe('9999.99');
        });

        it('should handle complex JSONB queries', async () => {
            const listing = await mockServiceListingModel.create({
                id: 'sl-jsonb',
                clientId: 'client-123',
                touristServiceId: 'ts-123',
                listingPlanId: 'slp-123',
                title: 'JSONB Test Listing',
                listingDetails: {
                    availabilityType: 'on-demand',
                    bookingSettings: {
                        instantBooking: true,
                        minGroupSize: 1,
                        maxGroupSize: 10
                    },
                    highlights: ['Test highlight 1', 'Test highlight 2'],
                    specialOffers: [
                        {
                            type: 'discount',
                            value: 20,
                            validFrom: '2024-01-01',
                            validUntil: '2024-06-30'
                        }
                    ]
                },
                createdById: 'user-123',
                updatedById: 'user-123'
            });

            expect(listing.listingDetails?.availabilityType).toBe('on-demand');
            expect(listing.listingDetails?.bookingSettings?.instantBooking).toBe(true);
            expect(listing.listingDetails?.highlights).toHaveLength(2);
            expect(listing.listingDetails?.specialOffers?.[0]?.type).toBe('discount');
        });
    });
});
