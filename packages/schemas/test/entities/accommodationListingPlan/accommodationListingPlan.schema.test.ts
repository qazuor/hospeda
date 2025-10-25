import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccommodationListingPlanSchema } from '../../../src/entities/accommodationListingPlan/accommodationListingPlan.schema.js';
import {
    createAccommodationListingPlanEdgeCases,
    createAccommodationListingPlanWithCustomLimits,
    createBasicAccommodationListingPlan,
    createComplexAccommodationListingPlan,
    createEnterpriseAccommodationListingPlan,
    createInvalidAccommodationListingPlan,
    createMinimalAccommodationListingPlan,
    createPremiumAccommodationListingPlan,
    createValidAccommodationListingPlan
} from '../../fixtures/accommodationListingPlan.fixtures.js';

describe('AccommodationListingPlanSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid accommodation listing plan', () => {
            const validData = createValidAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(validData)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(validData);
            expect(result).toBeDefined();
            expect(result.id).toBe(validData.id);
            expect(result.name).toBe(validData.name);
            expect(result.limits).toBeDefined();
        });

        it('should validate minimal required accommodation listing plan data', () => {
            const minimalData = createMinimalAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex accommodation listing plan with extensive limits', () => {
            const complexData = createComplexAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(complexData)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(complexData);
            expect(result.limits).toBeDefined();
            expect(typeof result.limits).toBe('object');
        });

        it('should validate plan without limits', () => {
            const dataWithoutLimits = {
                ...createMinimalAccommodationListingPlan(),
                limits: undefined
            };

            expect(() => AccommodationListingPlanSchema.parse(dataWithoutLimits)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(dataWithoutLimits);
            expect(result.limits).toBeUndefined();
        });

        it('should validate different plan tiers', () => {
            const basicPlan = createBasicAccommodationListingPlan();
            const premiumPlan = createPremiumAccommodationListingPlan();
            const enterprisePlan = createEnterpriseAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(basicPlan)).not.toThrow();
            expect(() => AccommodationListingPlanSchema.parse(premiumPlan)).not.toThrow();
            expect(() => AccommodationListingPlanSchema.parse(enterprisePlan)).not.toThrow();
        });

        it('should validate plan with custom limits structure', () => {
            const customLimits = {
                customFeature1: true,
                customFeature2: 100,
                customFeature3: ['option1', 'option2'],
                nestedConfig: {
                    setting1: 'value1',
                    setting2: 42
                }
            };

            const customPlan = createAccommodationListingPlanWithCustomLimits(customLimits);

            expect(() => AccommodationListingPlanSchema.parse(customPlan)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(customPlan);
            expect(result.limits).toEqual(expect.objectContaining(customLimits));
        });
    });

    describe('Invalid Data', () => {
        it('should reject accommodation listing plan with invalid data', () => {
            const invalidData = createInvalidAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject accommodation listing plan with missing required fields', () => {
            const incompleteData = {
                id: 'valid-uuid-here'
                // Missing name and other required fields
            };

            expect(() => AccommodationListingPlanSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject accommodation listing plan with invalid UUID', () => {
            const invalidUuidData = {
                ...createValidAccommodationListingPlan(),
                id: 'not-a-uuid'
            };

            expect(() => AccommodationListingPlanSchema.parse(invalidUuidData)).toThrow(ZodError);
        });

        it('should reject accommodation listing plan with empty name', () => {
            const emptyNameData = {
                ...createValidAccommodationListingPlan(),
                name: ''
            };

            expect(() => AccommodationListingPlanSchema.parse(emptyNameData)).toThrow(ZodError);
        });

        it('should reject accommodation listing plan with name too short', () => {
            const shortNameData = {
                ...createValidAccommodationListingPlan(),
                name: 'AB' // Only 2 characters, minimum is 3
            };

            expect(() => AccommodationListingPlanSchema.parse(shortNameData)).toThrow(ZodError);
        });

        it('should reject accommodation listing plan with name too long', () => {
            const longNameData = {
                ...createValidAccommodationListingPlan(),
                name: 'A'.repeat(101) // 101 characters, maximum is 100
            };

            expect(() => AccommodationListingPlanSchema.parse(longNameData)).toThrow(ZodError);
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case data appropriately', () => {
            const edgeCaseData = createAccommodationListingPlanEdgeCases();

            expect(() => AccommodationListingPlanSchema.parse(edgeCaseData)).toThrow(ZodError);
        });

        it('should handle empty limits object', () => {
            const emptyLimitsData = {
                ...createValidAccommodationListingPlan(),
                limits: {}
            };

            expect(() => AccommodationListingPlanSchema.parse(emptyLimitsData)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(emptyLimitsData);
            expect(result.limits).toEqual({});
        });

        it('should handle null values in limits', () => {
            const nullLimitsData = {
                ...createValidAccommodationListingPlan(),
                limits: {
                    nullFeature: null,
                    validFeature: true
                }
            };

            expect(() => AccommodationListingPlanSchema.parse(nullLimitsData)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(nullLimitsData);
            expect(result.limits?.nullFeature).toBeNull();
            expect(result.limits?.validFeature).toBe(true);
        });
    });

    describe('Field Validation', () => {
        it('should validate UUID field correctly', () => {
            const data = createValidAccommodationListingPlan();

            const result = AccommodationListingPlanSchema.parse(data);

            // ID should be a valid UUID
            expect(result.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should validate name field correctly', () => {
            const data = createValidAccommodationListingPlan();

            const result = AccommodationListingPlanSchema.parse(data);

            expect(typeof result.name).toBe('string');
            expect(result.name.length).toBeGreaterThanOrEqual(3);
            expect(result.name.length).toBeLessThanOrEqual(100);
        });

        it('should validate datetime fields correctly', () => {
            const data = createValidAccommodationListingPlan();

            const result = AccommodationListingPlanSchema.parse(data);

            // All datetime fields should be valid ISO strings
            expect(() => new Date(result.createdAt)).not.toThrow();
            expect(() => new Date(result.updatedAt)).not.toThrow();
        });

        it('should validate limits field type correctly', () => {
            const data = createValidAccommodationListingPlan();

            const result = AccommodationListingPlanSchema.parse(data);

            if (result.limits) {
                expect(typeof result.limits).toBe('object');
                expect(Array.isArray(result.limits)).toBe(false);
            }
        });
    });

    describe('Plan Tier Validation', () => {
        it('should validate basic plan structure', () => {
            const basicPlan = createBasicAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(basicPlan)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(basicPlan);
            expect(result.name).toBe('Basic Plan');
            expect(result.limits?.maxListings).toBe(1);
        });

        it('should validate premium plan structure', () => {
            const premiumPlan = createPremiumAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(premiumPlan)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(premiumPlan);
            expect(result.name).toBe('Premium Plan');
            expect(result.limits?.maxListings).toBe(10);
        });

        it('should validate enterprise plan structure', () => {
            const enterprisePlan = createEnterpriseAccommodationListingPlan();

            expect(() => AccommodationListingPlanSchema.parse(enterprisePlan)).not.toThrow();

            const result = AccommodationListingPlanSchema.parse(enterprisePlan);
            expect(result.name).toBe('Enterprise Plan');
            expect(result.limits?.maxListings).toBe(-1); // unlimited
        });
    });
});
