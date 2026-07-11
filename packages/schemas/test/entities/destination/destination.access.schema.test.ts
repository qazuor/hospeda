/**
 * Tests for destination access schemas (public / protected / admin).
 *
 * Pins the HOS-113 Phase 4 invariant: `pointsOfInterest` (the batch-loaded
 * POI summary array hydrated by `DestinationService._withPointsOfInterest`)
 * MUST be part of both the public and protected exposure contracts, exactly
 * like the sibling `attractions` relation it mirrors. Without a test like
 * this, dropping the field from either `.pick()` call would be a silent
 * regression — nothing else in the suite asserts field-level exposure for
 * this entity.
 *
 * @module test/entities/destination/destination.access.schema
 */
import { describe, expect, it } from 'vitest';
import {
    DestinationAdminSchema,
    DestinationProtectedSchema,
    DestinationPublicSchema
} from '../../../src/entities/destination/destination.access.schema.js';
import { createValidDestination } from '../../fixtures/destination.fixtures.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

describe('Destination Access Schemas — pointsOfInterest exposure (HOS-113 Phase 4)', () => {
    describe('DestinationPublicSchema', () => {
        it('includes pointsOfInterest in its shape', () => {
            expect(DestinationPublicSchema.shape).toHaveProperty('pointsOfInterest');
        });

        it('parses and preserves a populated pointsOfInterest array, including description/isFeatured/isBuiltin', () => {
            const poi = createValidPointOfInterest();
            const data = { ...createValidDestination(), pointsOfInterest: [poi] };

            const result = DestinationPublicSchema.parse(data);

            expect(result.pointsOfInterest).toHaveLength(1);
            expect(result.pointsOfInterest?.[0]).toMatchObject({
                id: poi.id,
                slug: poi.slug,
                description: poi.description,
                isFeatured: poi.isFeatured,
                isBuiltin: poi.isBuiltin
            });
        });
    });

    describe('DestinationProtectedSchema', () => {
        it('includes pointsOfInterest in its shape', () => {
            expect(DestinationProtectedSchema.shape).toHaveProperty('pointsOfInterest');
        });

        it('parses and preserves a populated pointsOfInterest array', () => {
            const poi = createValidPointOfInterest();
            const data = { ...createValidDestination(), pointsOfInterest: [poi] };

            const result = DestinationProtectedSchema.parse(data);

            expect(result.pointsOfInterest).toHaveLength(1);
            expect(result.pointsOfInterest?.[0]?.id).toBe(poi.id);
        });
    });

    describe('DestinationAdminSchema', () => {
        it('includes pointsOfInterest in its shape (full entity schema)', () => {
            expect(DestinationAdminSchema.shape).toHaveProperty('pointsOfInterest');
        });
    });
});
