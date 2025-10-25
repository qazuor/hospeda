import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationListingListHttpQuerySchema,
    convertAccommodationListingDomainToHttp,
    convertAccommodationListingHttpToDomain
} from '../../../src/entities/accommodationListing/accommodationListing.http.schema.js';
import {
    AccommodationListingPlanListHttpQuerySchema,
    convertAccommodationListingPlanDomainToHttp,
    convertAccommodationListingPlanHttpToDomain
} from '../../../src/entities/accommodationListingPlan/accommodationListingPlan.http.schema.js';
import {
    FeaturedAccommodationListHttpQuerySchema,
    convertFeaturedAccommodationDomainToHttp,
    convertFeaturedAccommodationHttpToDomain
} from '../../../src/entities/featuredAccommodation/featuredAccommodation.http.schema.js';
import { FeaturedStatusEnum } from '../../../src/enums/featured-status.enum.js';
import { FeaturedTypeEnum } from '../../../src/enums/featured-type.enum.js';
import { ListingStatusEnum } from '../../../src/enums/listing-status.enum.js';
import { createValidAccommodationListing } from '../../fixtures/accommodationListing.fixtures.js';
import { createValidAccommodationListingPlan } from '../../fixtures/accommodationListingPlan.fixtures.js';
import { createValidFeaturedAccommodation } from '../../fixtures/featuredAccommodation.fixtures.js';

describe('HTTP Schema Conversions', () => {
    describe('AccommodationListing HTTP Schemas', () => {
        describe('Query Parameter Coercion', () => {
            it('should coerce string page numbers to integers', () => {
                const httpQuery = {
                    page: '2',
                    pageSize: '25'
                };

                const result = AccommodationListingListHttpQuerySchema.parse(httpQuery);
                expect(result.page).toBe(2);
                expect(result.pageSize).toBe(25);
            });

            it('should coerce boolean string values', () => {
                const httpQuery = {
                    isTrial: 'true',
                    isActiveOnly: 'false'
                };

                const result = AccommodationListingListHttpQuerySchema.parse(httpQuery);
                expect(result.isTrial).toBe(true);
                expect(result.isActiveOnly).toBe(false);
            });

            it('should handle comma-separated arrays', () => {
                const httpQuery = {
                    statuses: 'ACTIVE,PAUSED,TRIAL'
                };

                const result = AccommodationListingListHttpQuerySchema.parse(httpQuery);
                expect(result.statuses).toEqual(['ACTIVE', 'PAUSED', 'TRIAL']);
            });

            it('should handle already parsed arrays', () => {
                const httpQuery = {
                    statuses: ['ACTIVE', 'PAUSED']
                };

                const result = AccommodationListingListHttpQuerySchema.parse(httpQuery);
                expect(result.statuses).toEqual(['ACTIVE', 'PAUSED']);
            });
        });

        describe('HTTP to Domain Conversion', () => {
            it('should convert HTTP create input to domain input', () => {
                const httpInput = {
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    accommodationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    listingPlanId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    fromDate: '2024-01-01T00:00:00Z',
                    toDate: '2024-12-31T23:59:59Z',
                    isTrial: false,
                    status: ListingStatusEnum.ACTIVE
                };

                const result = convertAccommodationListingHttpToDomain.create(httpInput);
                expect(result.isTrial).toBe(false);
                expect(typeof result.isTrial).toBe('boolean');
            });

            it('should throw on invalid HTTP input', () => {
                const invalidHttpInput = {
                    clientId: 'invalid-uuid'
                    // missing required fields
                } as any;

                expect(() =>
                    convertAccommodationListingHttpToDomain.create(invalidHttpInput)
                ).toThrow(ZodError);
            });
        });

        describe('Domain to HTTP Conversion', () => {
            it('should convert domain entity to HTTP response', () => {
                const domainEntity = createValidAccommodationListing();

                const result =
                    convertAccommodationListingDomainToHttp.accommodationListing(domainEntity);

                expect(result.id).toBe(domainEntity.id);
                expect(result.fromDate).toBe(domainEntity.fromDate);
                expect(result.toDate).toBe(domainEntity.toDate);
                expect(result.trialEndsAt).toBe(domainEntity.trialEndsAt);
            });
        });
    });

    describe('FeaturedAccommodation HTTP Schemas', () => {
        describe('Query Parameter Coercion', () => {
            it('should coerce string page numbers to integers', () => {
                const httpQuery = {
                    page: '3',
                    pageSize: '50'
                };

                const result = FeaturedAccommodationListHttpQuerySchema.parse(httpQuery);
                expect(result.page).toBe(3);
                expect(result.pageSize).toBe(50);
            });

            it('should handle comma-separated featured types', () => {
                const httpQuery = {
                    featuredTypes: 'HOME,DESTINATION,SEARCH'
                };

                const result = FeaturedAccommodationListHttpQuerySchema.parse(httpQuery);
                expect(result.featuredTypes).toEqual(['HOME', 'DESTINATION', 'SEARCH']);
            });

            it('should handle comma-separated statuses', () => {
                const httpQuery = {
                    statuses: 'ACTIVE,PAUSED'
                };

                const result = FeaturedAccommodationListHttpQuerySchema.parse(httpQuery);
                expect(result.statuses).toEqual(['ACTIVE', 'PAUSED']);
            });
        });

        describe('HTTP to Domain Conversion', () => {
            it('should convert HTTP input to domain input', () => {
                const httpInput = {
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    accommodationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    featuredType: FeaturedTypeEnum.HOME,
                    fromDate: '2024-01-01T00:00:00Z',
                    toDate: '2024-12-31T23:59:59Z',
                    status: FeaturedStatusEnum.ACTIVE
                };

                expect(() =>
                    convertFeaturedAccommodationHttpToDomain.create(httpInput)
                ).not.toThrow();
            });
        });

        describe('Domain to HTTP Conversion', () => {
            it('should convert domain entity to HTTP response', () => {
                const domainEntity = createValidFeaturedAccommodation();

                const result =
                    convertFeaturedAccommodationDomainToHttp.featuredAccommodation(domainEntity);

                expect(result.id).toBe(domainEntity.id);
                expect(result.featuredType).toBe(domainEntity.featuredType);
                expect(result.status).toBe(domainEntity.status);
            });
        });
    });

    describe('AccommodationListingPlan HTTP Schemas', () => {
        describe('Query Parameter Coercion', () => {
            it('should coerce string page numbers to integers', () => {
                const httpQuery = {
                    page: '1',
                    pageSize: '10'
                };

                const result = AccommodationListingPlanListHttpQuerySchema.parse(httpQuery);
                expect(result.page).toBe(1);
                expect(result.pageSize).toBe(10);
            });
        });

        describe('JSON Limits Handling', () => {
            it('should parse JSON string limits', () => {
                const httpInput = {
                    name: 'Test Plan',
                    limits: '{"maxListings": 5, "maxPhotos": 20}'
                };

                const result = convertAccommodationListingPlanHttpToDomain.create(httpInput);
                expect(result.limits).toEqual({
                    maxListings: 5,
                    maxPhotos: 20
                });
            });

            it('should handle object limits directly', () => {
                const httpInput = {
                    name: 'Test Plan',
                    limits: {
                        maxListings: 10,
                        maxPhotos: 50
                    }
                };

                const result = convertAccommodationListingPlanHttpToDomain.create(httpInput);
                expect(result.limits).toEqual({
                    maxListings: 10,
                    maxPhotos: 50
                });
            });

            it('should handle invalid JSON gracefully', () => {
                const httpInput = {
                    name: 'Test Plan',
                    limits: 'invalid-json'
                };

                const result = convertAccommodationListingPlanHttpToDomain.create(httpInput);
                expect(result.limits).toEqual({});
            });
        });

        describe('Domain to HTTP Conversion', () => {
            it('should convert domain entity to HTTP response', () => {
                const domainEntity = createValidAccommodationListingPlan();

                const result =
                    convertAccommodationListingPlanDomainToHttp.accommodationListingPlan(
                        domainEntity
                    );

                expect(result.id).toBe(domainEntity.id);
                expect(result.name).toBe(domainEntity.name);
                expect(result.limits).toBeDefined();
            });

            it('should handle undefined limits correctly', () => {
                const domainEntity = {
                    ...createValidAccommodationListingPlan(),
                    limits: undefined
                };

                const result =
                    convertAccommodationListingPlanDomainToHttp.accommodationListingPlan(
                        domainEntity
                    );

                expect(result.limits).toBeUndefined();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid HTTP query parameters gracefully', () => {
            const invalidQuery = {
                page: 'not-a-number',
                pageSize: 'also-not-a-number'
            };

            // Should not throw due to coercion, but should produce NaN or default values
            expect(() => AccommodationListingListHttpQuerySchema.parse(invalidQuery)).not.toThrow();
        });

        it('should validate required fields in conversion', () => {
            const incompleteInput = {
                // missing required 'name' field
                limits: '{"maxListings": 5}'
            };

            expect(() =>
                convertAccommodationListingPlanHttpToDomain.create(incompleteInput as any)
            ).toThrow(ZodError);
        });
    });

    describe('Default Values', () => {
        it('should apply default values for AccommodationListing HTTP queries', () => {
            const emptyQuery = {};

            const result = AccommodationListingListHttpQuerySchema.parse(emptyQuery);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
        });

        it('should apply default values for FeaturedAccommodation HTTP queries', () => {
            const emptyQuery = {};

            const result = FeaturedAccommodationListHttpQuerySchema.parse(emptyQuery);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
        });

        it('should apply default values for AccommodationListingPlan HTTP queries', () => {
            const emptyQuery = {};

            const result = AccommodationListingPlanListHttpQuerySchema.parse(emptyQuery);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
        });
    });
});
