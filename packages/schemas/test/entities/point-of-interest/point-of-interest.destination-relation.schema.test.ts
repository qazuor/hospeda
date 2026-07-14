import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PointOfInterestDestinationListItemSchema,
    PointOfInterestUpdateDestinationRelationInputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.destination-relation.schema.js';

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
