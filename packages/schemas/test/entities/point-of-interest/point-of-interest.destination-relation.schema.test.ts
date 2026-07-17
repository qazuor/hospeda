import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DestinationPointOfInterestSummarySchema,
    PointOfInterestDestinationListItemSchema,
    PointOfInterestUpdateDestinationRelationInputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.destination-relation.schema.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

describe('PointOfInterestUpdateDestinationRelationInputSchema', () => {
    const validInput = () => ({
        destinationId: faker.string.uuid(),
        pointOfInterestId: faker.string.uuid(),
        relation: 'PRIMARY'
    });

    it('should validate a valid PRIMARY relation update', () => {
        const result = PointOfInterestUpdateDestinationRelationInputSchema.safeParse(validInput());
        expect(result.success).toBe(true);
    });

    it('should validate a valid NEARBY relation update', () => {
        const result = PointOfInterestUpdateDestinationRelationInputSchema.safeParse({
            ...validInput(),
            relation: 'NEARBY'
        });
        expect(result.success).toBe(true);
    });

    it('should reject an invalid relation value', () => {
        expect(() =>
            PointOfInterestUpdateDestinationRelationInputSchema.parse({
                ...validInput(),
                relation: 'SECONDARY'
            })
        ).toThrow(ZodError);
    });

    it('should reject a missing relation (no default — always required on update)', () => {
        const { relation: _relation, ...rest } = validInput();
        expect(() => PointOfInterestUpdateDestinationRelationInputSchema.parse(rest)).toThrow(
            ZodError
        );
    });

    it('should reject an invalid destinationId', () => {
        expect(() =>
            PointOfInterestUpdateDestinationRelationInputSchema.parse({
                ...validInput(),
                destinationId: 'not-a-uuid'
            })
        ).toThrow(ZodError);
    });

    it('should reject an invalid pointOfInterestId', () => {
        expect(() =>
            PointOfInterestUpdateDestinationRelationInputSchema.parse({
                ...validInput(),
                pointOfInterestId: 'not-a-uuid'
            })
        ).toThrow(ZodError);
    });
});

describe('PointOfInterestDestinationListItemSchema', () => {
    it('should validate a valid destination list item', () => {
        const validItem = {
            destinationId: faker.string.uuid(),
            destinationName: 'Concepción del Uruguay',
            destinationSlug: 'concepcion-del-uruguay',
            relation: 'PRIMARY'
        };

        const result = PointOfInterestDestinationListItemSchema.safeParse(validItem);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(validItem);
        }
    });

    it('should reject a missing destinationName', () => {
        const result = PointOfInterestDestinationListItemSchema.safeParse({
            destinationId: faker.string.uuid(),
            destinationSlug: 'concepcion-del-uruguay',
            relation: 'PRIMARY'
        });
        expect(result.success).toBe(false);
    });

    it('should reject an invalid relation value', () => {
        const result = PointOfInterestDestinationListItemSchema.safeParse({
            destinationId: faker.string.uuid(),
            destinationName: 'Test',
            destinationSlug: 'test',
            relation: 'INVALID'
        });
        expect(result.success).toBe(false);
    });
});

describe('DestinationPointOfInterestSummarySchema — categories[] (HOS-147)', () => {
    // The POI entity fixture is a superset of the summary's picked fields; Zod
    // strips the extras, so it works as a valid base summary for these tests.
    const validSummary = () => createValidPointOfInterest();

    it('should accept and preserve a categories[] array (all POI categories, not just primary)', () => {
        const result = DestinationPointOfInterestSummarySchema.safeParse({
            ...validSummary(),
            categories: [{ slug: 'playas' }, { slug: 'termas' }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual([{ slug: 'playas' }, { slug: 'termas' }]);
        }
    });

    it('should treat categories as optional (additive-only, like relation)', () => {
        const { ...summaryWithoutCategories } = validSummary();
        const result = DestinationPointOfInterestSummarySchema.safeParse(summaryWithoutCategories);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toBeUndefined();
        }
    });

    it('should reject a category entry missing its slug', () => {
        expect(() =>
            DestinationPointOfInterestSummarySchema.parse({
                ...validSummary(),
                categories: [{ nameI18n: { es: 'Playas' } }]
            })
        ).toThrow(ZodError);
    });

    it('should keep categories[] and relation coexisting', () => {
        const result = DestinationPointOfInterestSummarySchema.safeParse({
            ...validSummary(),
            relation: 'NEARBY',
            categories: [{ slug: 'museos' }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.relation).toBe('NEARBY');
            expect(result.data.categories).toEqual([{ slug: 'museos' }]);
        }
    });
});
