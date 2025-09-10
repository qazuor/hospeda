import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AmenityAccommodationRelationOutputSchema,
    AmenityAddToAccommodationInputSchema,
    AmenityCreateInputSchema,
    AmenityDeleteInputSchema,
    AmenityRemoveFromAccommodationInputSchema,
    AmenityRestoreInputSchema,
    AmenityUpdateInputSchema
} from '../../../src/entities/amenity/amenity.crud.schema.js';

describe('Amenity CRUD Schemas', () => {
    describe('AmenityAddToAccommodationInputSchema', () => {
        it('should validate valid add amenity to accommodation input', () => {
            const validInput = {
                accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                amenityId: '550e8400-e29b-41d4-a716-446655440001',
                isOptional: false,
                additionalCost: {
                    price: 25.5,
                    currency: 'USD'
                },
                additionalCostPercent: 10
            };

            expect(() => AmenityAddToAccommodationInputSchema.parse(validInput)).not.toThrow();
            const result = AmenityAddToAccommodationInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should validate minimal add amenity input', () => {
            const minimalInput = {
                accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                amenityId: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => AmenityAddToAccommodationInputSchema.parse(minimalInput)).not.toThrow();
            const result = AmenityAddToAccommodationInputSchema.parse(minimalInput);
            expect(result.isOptional).toBe(false); // default value
        });

        it('should reject invalid UUIDs', () => {
            const invalidInputs = [
                {
                    accommodationId: 'invalid-uuid',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001'
                },
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: 'invalid-uuid'
                }
            ];

            invalidInputs.forEach((input, index) => {
                expect(
                    () => AmenityAddToAccommodationInputSchema.parse(input),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid additional cost', () => {
            const invalidCosts = [
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    additionalCost: {
                        price: -10, // negative price
                        currency: 'USD'
                    }
                },
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    additionalCost: {
                        price: 25.5,
                        currency: 'INVALID' // invalid currency code
                    }
                }
            ];

            invalidCosts.forEach((input, index) => {
                expect(
                    () => AmenityAddToAccommodationInputSchema.parse(input),
                    `Invalid cost case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid additional cost percent', () => {
            const invalidPercents = [
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    additionalCostPercent: -5 // negative
                },
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    additionalCostPercent: 150 // over 100
                }
            ];

            invalidPercents.forEach((input, index) => {
                expect(
                    () => AmenityAddToAccommodationInputSchema.parse(input),
                    `Invalid percent case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('AmenityRemoveFromAccommodationInputSchema', () => {
        it('should validate valid remove amenity input', () => {
            const validInput = {
                accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                amenityId: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => AmenityRemoveFromAccommodationInputSchema.parse(validInput)).not.toThrow();
            const result = AmenityRemoveFromAccommodationInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should reject invalid UUIDs', () => {
            const invalidInputs = [
                {
                    accommodationId: 'invalid-uuid',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001'
                },
                {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: 'invalid-uuid'
                }
            ];

            invalidInputs.forEach((input, index) => {
                expect(
                    () => AmenityRemoveFromAccommodationInputSchema.parse(input),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject missing required fields', () => {
            const incompleteInputs = [
                { accommodationId: '550e8400-e29b-41d4-a716-446655440000' }, // missing amenityId
                { amenityId: '550e8400-e29b-41d4-a716-446655440001' }, // missing accommodationId
                {} // missing both
            ];

            incompleteInputs.forEach((input, index) => {
                expect(
                    () => AmenityRemoveFromAccommodationInputSchema.parse(input),
                    `Incomplete input case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('AmenityAccommodationRelationOutputSchema', () => {
        it('should validate valid relation output', () => {
            const validOutput = {
                relation: {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    isOptional: false,
                    additionalCost: {
                        price: 25.5,
                        currency: 'USD'
                    },
                    additionalCostPercent: 10,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            };

            expect(() => AmenityAccommodationRelationOutputSchema.parse(validOutput)).not.toThrow();
            const result = AmenityAccommodationRelationOutputSchema.parse(validOutput);
            expect(result).toMatchObject(validOutput);
        });

        it('should validate minimal relation output', () => {
            const minimalOutput = {
                relation: {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    isOptional: false
                }
            };

            expect(() =>
                AmenityAccommodationRelationOutputSchema.parse(minimalOutput)
            ).not.toThrow();
        });

        it('should validate relation with deletedAt', () => {
            const deletedRelation = {
                relation: {
                    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                    amenityId: '550e8400-e29b-41d4-a716-446655440001',
                    isOptional: false,
                    deletedAt: new Date()
                }
            };

            expect(() =>
                AmenityAccommodationRelationOutputSchema.parse(deletedRelation)
            ).not.toThrow();
        });
    });

    describe('AmenityCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = {
                slug: 'wifi-access',
                name: 'WiFi Access',
                description: 'High-speed internet access throughout the property',
                icon: 'wifi-icon',
                type: 'CONNECTIVITY',
                isBuiltin: false,
                isFeatured: true,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC'
            };

            expect(() => AmenityCreateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate minimal create input', () => {
            const minimalInput = {
                slug: 'pool',
                name: 'Pool',
                type: 'OUTDOORS',
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC'
            };

            expect(() => AmenityCreateInputSchema.parse(minimalInput)).not.toThrow();
        });
    });

    describe('AmenityUpdateInputSchema', () => {
        it('should validate partial update input', () => {
            const partialUpdate = {
                name: 'Updated Amenity Name',
                description: 'Updated description'
            };

            expect(() => AmenityUpdateInputSchema.parse(partialUpdate)).not.toThrow();
        });

        it('should validate empty update input', () => {
            const emptyUpdate = {};

            expect(() => AmenityUpdateInputSchema.parse(emptyUpdate)).not.toThrow();
        });
    });

    describe('AmenityDeleteInputSchema', () => {
        it('should validate delete input with force flag', () => {
            const deleteInput = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: true
            };

            expect(() => AmenityDeleteInputSchema.parse(deleteInput)).not.toThrow();
        });

        it('should validate delete input without force flag', () => {
            const deleteInput = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const result = AmenityDeleteInputSchema.parse(deleteInput);
            expect(result.force).toBe(false); // default value
        });
    });

    describe('AmenityRestoreInputSchema', () => {
        it('should validate restore input', () => {
            const restoreInput = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => AmenityRestoreInputSchema.parse(restoreInput)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            const invalidInput = {
                id: 'invalid-uuid'
            };

            expect(() => AmenityRestoreInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });
});
