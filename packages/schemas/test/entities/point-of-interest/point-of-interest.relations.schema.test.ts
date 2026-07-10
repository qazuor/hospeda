import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    BulkAddPointsOfInterestToDestinationInputSchema,
    BulkRelationOperationOutputSchema,
    BulkRemovePointsOfInterestFromDestinationInputSchema,
    DestinationPointOfInterestRelationSchema,
    DestinationWithPointsOfInterestListSchema,
    PointOfInterestDestinationRelationDetailSchema,
    PointOfInterestListItemWithRelationsSchema,
    PointOfInterestWithDestinationsSchema,
    UpdatePointOfInterestOrderInputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.relations.schema.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

describe('Point Of Interest Relation Schemas', () => {
    describe('DestinationPointOfInterestRelationSchema', () => {
        it('should validate a valid relation', () => {
            const validRelation = {
                destinationId: faker.string.uuid(),
                pointOfInterestId: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: faker.string.uuid(),
                updatedById: faker.string.uuid()
            };

            expect(() =>
                DestinationPointOfInterestRelationSchema.parse(validRelation)
            ).not.toThrow();
        });

        it('should default isHighlighted to false', () => {
            const relation = {
                destinationId: faker.string.uuid(),
                pointOfInterestId: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: faker.string.uuid(),
                updatedById: faker.string.uuid()
            };

            const result = DestinationPointOfInterestRelationSchema.parse(relation);
            expect(result.isHighlighted).toBe(false);
        });

        it('should require both IDs', () => {
            const incompleteRelation = {
                destinationId: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: faker.string.uuid(),
                updatedById: faker.string.uuid()
            };

            expect(() =>
                DestinationPointOfInterestRelationSchema.parse(incompleteRelation)
            ).toThrow(ZodError);
        });
    });

    describe('PointOfInterestWithDestinationsSchema (M2M, HOS-113 OQ-1)', () => {
        it('should allow a point of interest with multiple destinations', () => {
            const data = {
                ...createValidPointOfInterest(),
                destinations: [
                    { id: faker.string.uuid(), slug: 'destination-one' },
                    { id: faker.string.uuid(), slug: 'destination-two' }
                ]
            };

            const result = PointOfInterestWithDestinationsSchema.parse(data);
            expect(result.destinations).toHaveLength(2);
        });

        it('should allow zero destinations (unassigned POI)', () => {
            const data = { ...createValidPointOfInterest(), destinations: [] };

            const result = PointOfInterestWithDestinationsSchema.parse(data);
            expect(result.destinations).toHaveLength(0);
        });

        it('should allow destinations to be omitted', () => {
            const data = createValidPointOfInterest();

            expect(() => PointOfInterestWithDestinationsSchema.parse(data)).not.toThrow();
        });
    });

    describe('DestinationWithPointsOfInterestListSchema', () => {
        it('should validate a destination with a list of points of interest', () => {
            const data = {
                id: faker.string.uuid(),
                slug: 'concepcion-del-uruguay',
                pointsOfInterest: [
                    {
                        id: faker.string.uuid(),
                        slug: 'autodromo-ciudad',
                        lat: -32.4833,
                        long: -58.2333,
                        type: 'STADIUM',
                        icon: 'flag'
                    }
                ]
            };

            expect(() => DestinationWithPointsOfInterestListSchema.parse(data)).not.toThrow();
        });

        it('should allow an empty pointsOfInterest array', () => {
            const data = {
                id: faker.string.uuid(),
                slug: 'concepcion-del-uruguay',
                pointsOfInterest: []
            };

            expect(() => DestinationWithPointsOfInterestListSchema.parse(data)).not.toThrow();
        });
    });

    describe('PointOfInterestListItemWithRelationsSchema', () => {
        it('should validate with a destinationCount', () => {
            const data = { ...createValidPointOfInterest(), destinationCount: 3 };

            expect(() => PointOfInterestListItemWithRelationsSchema.parse(data)).not.toThrow();
        });

        it('should reject a negative destinationCount', () => {
            const data = { ...createValidPointOfInterest(), destinationCount: -1 };

            expect(() => PointOfInterestListItemWithRelationsSchema.parse(data)).toThrow(ZodError);
        });

        it('should limit destinationPreviews to 3', () => {
            const data = {
                ...createValidPointOfInterest(),
                destinationPreviews: [
                    { id: faker.string.uuid(), slug: 'd1' },
                    { id: faker.string.uuid(), slug: 'd2' },
                    { id: faker.string.uuid(), slug: 'd3' },
                    { id: faker.string.uuid(), slug: 'd4' }
                ]
            };

            expect(() => PointOfInterestListItemWithRelationsSchema.parse(data)).toThrow(ZodError);
        });
    });

    describe('BulkAddPointsOfInterestToDestinationInputSchema', () => {
        it('should validate a valid bulk add input', () => {
            const validInput = {
                destinationId: faker.string.uuid(),
                pointOfInterestIds: [faker.string.uuid(), faker.string.uuid()]
            };

            expect(() =>
                BulkAddPointsOfInterestToDestinationInputSchema.parse(validInput)
            ).not.toThrow();
        });

        it('should reject an empty pointOfInterestIds array', () => {
            const invalidInput = { destinationId: faker.string.uuid(), pointOfInterestIds: [] };

            expect(() =>
                BulkAddPointsOfInterestToDestinationInputSchema.parse(invalidInput)
            ).toThrow(ZodError);
        });

        it('should reject more than 50 pointOfInterestIds', () => {
            const invalidInput = {
                destinationId: faker.string.uuid(),
                pointOfInterestIds: Array.from({ length: 51 }, () => faker.string.uuid())
            };

            expect(() =>
                BulkAddPointsOfInterestToDestinationInputSchema.parse(invalidInput)
            ).toThrow(ZodError);
        });
    });

    describe('BulkRemovePointsOfInterestFromDestinationInputSchema', () => {
        it('should validate a valid bulk remove input', () => {
            const validInput = {
                destinationId: faker.string.uuid(),
                pointOfInterestIds: [faker.string.uuid()]
            };

            expect(() =>
                BulkRemovePointsOfInterestFromDestinationInputSchema.parse(validInput)
            ).not.toThrow();
        });
    });

    describe('UpdatePointOfInterestOrderInputSchema', () => {
        it('should validate a valid order update input', () => {
            const validInput = {
                destinationId: faker.string.uuid(),
                pointOfInterestOrders: [
                    { pointOfInterestId: faker.string.uuid(), order: 0 },
                    { pointOfInterestId: faker.string.uuid(), order: 1 }
                ]
            };

            expect(() => UpdatePointOfInterestOrderInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require at least one order entry', () => {
            const invalidInput = { destinationId: faker.string.uuid(), pointOfInterestOrders: [] };

            expect(() => UpdatePointOfInterestOrderInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });
    });

    describe('BulkRelationOperationOutputSchema', () => {
        it('should validate a successful bulk operation output', () => {
            const validOutput = { success: true, processed: 5, failed: 0 };

            expect(() => BulkRelationOperationOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should default success to true', () => {
            const output = { processed: 3, failed: 0 };

            const result = BulkRelationOperationOutputSchema.parse(output);
            expect(result.success).toBe(true);
        });

        it('should validate a partial-failure output with errors', () => {
            const output = {
                success: false,
                processed: 3,
                failed: 2,
                errors: [
                    { pointOfInterestId: faker.string.uuid(), error: 'Not found' },
                    { pointOfInterestId: faker.string.uuid(), error: 'Already related' }
                ]
            };

            expect(() => BulkRelationOperationOutputSchema.parse(output)).not.toThrow();
        });
    });

    describe('PointOfInterestDestinationRelationDetailSchema', () => {
        it('should validate a relation with expanded pointOfInterest/destination', () => {
            const validData = {
                destinationId: faker.string.uuid(),
                pointOfInterestId: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: faker.string.uuid(),
                updatedById: faker.string.uuid(),
                pointOfInterest: {
                    id: faker.string.uuid(),
                    slug: 'autodromo-ciudad',
                    lat: -32.4833,
                    long: -58.2333,
                    type: 'STADIUM',
                    icon: 'flag'
                },
                destination: { id: faker.string.uuid(), slug: 'concepcion-del-uruguay' }
            };

            expect(() =>
                PointOfInterestDestinationRelationDetailSchema.parse(validData)
            ).not.toThrow();
        });
    });
});
