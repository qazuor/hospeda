import { describe, expect, it } from 'vitest';
import {
    EventLocationAdminSchema,
    EventLocationProtectedSchema,
    EventLocationPublicSchema
} from '../../../src/entities/eventLocation/eventLocation.access.schema.js';
import { EventLocationCreateInputSchema } from '../../../src/entities/eventLocation/eventLocation.crud.schema.js';

/**
 * HOS-300 — read⊇write regression coverage for the event location address.
 *
 * A persisted `event_locations` row can legitimately carry an address longer
 * than the write-side maximum (rows land via seed data-migrations and direct
 * model inserts, both of which bypass the create/update Zod schemas). Because
 * `stripWithSchema` is fail-closed, one such row used to take down the whole
 * paginated admin response with a 500.
 *
 * The read schemas therefore keep the field types but drop the length bounds.
 * The write schemas stay strict — that asymmetry is the point of the pattern.
 *
 * @see HOS-190 (`ContactInfoReadSchema`) for the same read⊇write pattern.
 */

/**
 * Verbatim value of `event_locations.street` for the "Palacio San José"
 * venue in production (65 chars, write max is 50). This exact row is what
 * broke `GET /api/v1/admin/events`.
 */
const PROD_LONG_STREET = 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)';

const baseReadLocation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'palacio-san-jose',
    destinationId: '550e8400-e29b-41d4-a716-446655440001',
    placeName: 'Palacio San José',
    coordinates: { lat: '-32.1833', long: '-58.6667' },
    street: PROD_LONG_STREET,
    number: '128',
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null
};

describe('EventLocation read schemas — HOS-300 read⊇write', () => {
    it('PROD_LONG_STREET is actually longer than the write-side maximum', () => {
        expect(PROD_LONG_STREET.length).toBeGreaterThan(50);
    });

    it('EventLocationAdminSchema accepts a persisted street longer than the write max', () => {
        const result = EventLocationAdminSchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(PROD_LONG_STREET);
        }
    });

    it('EventLocationProtectedSchema accepts a persisted street longer than the write max', () => {
        const result = EventLocationProtectedSchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(PROD_LONG_STREET);
        }
    });

    it('EventLocationPublicSchema accepts an over-long persisted placeName', () => {
        const result = EventLocationPublicSchema.safeParse({
            ...baseReadLocation,
            placeName: 'A'.repeat(140)
        });

        expect(result.success).toBe(true);
    });

    it('read schemas still reject a street of the wrong type', () => {
        const result = EventLocationAdminSchema.safeParse({
            ...baseReadLocation,
            street: 42
        });

        expect(result.success).toBe(false);
    });

    it('the write schema stays strict — an over-long street is still rejected on create', () => {
        const result = EventLocationCreateInputSchema.safeParse({
            slug: 'palacio-san-jose',
            destinationId: '550e8400-e29b-41d4-a716-446655440001',
            placeName: 'Palacio San José',
            street: PROD_LONG_STREET
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('street'))).toBe(true);
        }
    });
});
