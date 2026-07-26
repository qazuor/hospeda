import { describe, expect, it } from 'vitest';
import {
    EventLocationAdminSchema,
    EventLocationProtectedSchema,
    EventLocationPublicSchema
} from '../../../src/entities/eventLocation/eventLocation.access.schema.js';
import { EventLocationAddressSchema } from '../../../src/entities/eventLocation/eventLocation.address.schema.js';
import { EventLocationBatchResponseSchema } from '../../../src/entities/eventLocation/eventLocation.batch.schema.js';
import {
    EventLocationCreateInputSchema,
    EventLocationCreateOutputSchema,
    EventLocationPatchInputSchema,
    EventLocationRestoreOutputSchema,
    EventLocationUpdateInputSchema,
    EventLocationUpdateOutputSchema
} from '../../../src/entities/eventLocation/eventLocation.crud.schema.js';
import {
    EventLocationListItemSchema,
    EventLocationSummarySchema
} from '../../../src/entities/eventLocation/eventLocation.query.schema.js';

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
 * IMPORTANT — every read-side acceptance test below uses {@link OVER_MAX_STREET},
 * a value derived from the CURRENT write bound, never the historical incident
 * payload. HOS-300 also raised the write bound from 50 to 150, which made the
 * 65-char production street legal on the write schema too; asserting the read
 * overlay with that value would be vacuous (a strict-derived read schema would
 * accept it just the same). The incident payload is pinned separately, in the
 * two explicitly labelled "production row" tests.
 *
 * @see HOS-190 (`ContactInfoReadSchema`) for the same read⊇write pattern.
 */

/**
 * Verbatim value of `event_locations.street` for the "Palacio San José"
 * venue in production (65 chars). This exact row is what broke
 * `GET /api/v1/admin/events` while the write max was still 50.
 */
const PROD_LONG_STREET = 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)';

/**
 * Write-side maximum for `street`, read off the schema itself rather than
 * hardcoded — if someone raises the bound, this test stops being meaningful
 * instead of silently passing against a stale literal.
 *
 * Fails loudly when the bound disappears entirely: `maxLength` would be `null`,
 * `null + 1 === 1`, and `OVER_MAX_STREET` would degenerate into the 1-char
 * string `'A'` — which still fails `.min(2)`, so the "write stays strict"
 * guards below would keep passing for the WRONG reason.
 */
const streetWriteMaxOrNull = EventLocationAddressSchema.shape.street.unwrap().unwrap().maxLength;
if (typeof streetWriteMaxOrNull !== 'number') {
    throw new Error(
        'HOS-300 test guard: `EventLocationAddressSchema.shape.street` no longer declares a `.max()` bound. These tests derive their over-max value from it and cannot express read⊇write without it.'
    );
}
const STREET_WRITE_MAX = streetWriteMaxOrNull;

/**
 * A street that exceeds whatever the current write bound is, derived from the
 * schema so raising the bound can never silently invert these guards into
 * "the write path accepts everything".
 */
const OVER_MAX_STREET = 'A'.repeat(STREET_WRITE_MAX + 1);

/**
 * Read-side payload. Its `street` is deliberately over the CURRENT write bound
 * so that every read-schema acceptance assertion is non-vacuous by
 * construction: re-pointing any of these schemas at the strict
 * `EventLocationSchema` base makes the corresponding test fail.
 */
const baseReadLocation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'palacio-san-jose',
    destinationId: '550e8400-e29b-41d4-a716-446655440001',
    placeName: 'Palacio San José',
    coordinates: { lat: '-32.1833', long: '-58.6667' },
    street: OVER_MAX_STREET,
    number: '128',
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null
};

describe('EventLocation read schemas — HOS-300 read⊇write', () => {
    it('OVER_MAX_STREET is actually longer than the write-side maximum', () => {
        expect(STREET_WRITE_MAX).toEqual(expect.any(Number));
        expect(OVER_MAX_STREET.length).toBeGreaterThan(STREET_WRITE_MAX);
        // The production value that triggered HOS-300 now fits the raised bound,
        // which is exactly why it cannot be used to prove the read overlay works.
        expect(PROD_LONG_STREET.length).toBeLessThanOrEqual(STREET_WRITE_MAX);
    });

    it('EventLocationAdminSchema accepts a street longer than the current write maximum', () => {
        const result = EventLocationAdminSchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventLocationProtectedSchema accepts a street longer than the current write maximum', () => {
        const result = EventLocationProtectedSchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventLocationPublicSchema accepts an over-long persisted placeName', () => {
        const result = EventLocationPublicSchema.safeParse({
            ...baseReadLocation,
            placeName: 'A'.repeat(140)
        });

        expect(result.success).toBe(true);
    });

    it('EventLocationListItemSchema accepts a street longer than the current write maximum', () => {
        // The admin entity-list client parses this schema and THROWS on failure,
        // so a strict-derived list item just moves the HOS-300 break from a
        // server 500 to a browser exception.
        const result = EventLocationListItemSchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventLocationSummarySchema accepts a street longer than the current write maximum', () => {
        const result = EventLocationSummarySchema.safeParse(baseReadLocation);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(OVER_MAX_STREET);
        }
    });

    it('the CRUD output schemas accept a street longer than the current write maximum', () => {
        // create/update/restore all return the persisted row, so they are read
        // direction and must derive from `EventLocationReadSchema`.
        for (const schema of [
            EventLocationCreateOutputSchema,
            EventLocationUpdateOutputSchema,
            EventLocationRestoreOutputSchema
        ]) {
            expect(schema.safeParse(baseReadLocation).success).toBe(true);
        }
    });

    it('EventLocationBatchResponseSchema accepts a street longer than the current write maximum', () => {
        // The batch response is an array of nullable locations (null = not found).
        const result = EventLocationBatchResponseSchema.safeParse([baseReadLocation, null]);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data[0]?.street).toBe(OVER_MAX_STREET);
        }
    });

    it('read schemas still reject a street of the wrong type', () => {
        const result = EventLocationAdminSchema.safeParse({
            ...baseReadLocation,
            street: 42
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('street') && issue.code === 'invalid_type'
                )
            ).toBe(true);
        }
    });
});

describe('EventLocation schemas — HOS-300 production row (incident facts)', () => {
    it('the real production row still parses on the read path', () => {
        const result = EventLocationAdminSchema.safeParse({
            ...baseReadLocation,
            street: PROD_LONG_STREET
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.street).toBe(PROD_LONG_STREET);
        }
    });

    it('the write schema now accepts the real production street (HOS-300 raised the bound to 150)', () => {
        // Making that venue editable again is the whole reason the bound moved:
        // the admin entity form submits the WHOLE form, so the persisted value
        // is re-validated on every save.
        const result = EventLocationCreateInputSchema.safeParse({
            slug: 'palacio-san-jose',
            destinationId: '550e8400-e29b-41d4-a716-446655440001',
            placeName: 'Palacio San José',
            street: PROD_LONG_STREET
        });

        expect(result.success).toBe(true);
    });
});

describe('EventLocation write schemas — HOS-300 write stays strict', () => {
    it('an over-max street is still rejected on create', () => {
        const result = EventLocationCreateInputSchema.safeParse({
            slug: 'palacio-san-jose',
            destinationId: '550e8400-e29b-41d4-a716-446655440001',
            placeName: 'Palacio San José',
            street: OVER_MAX_STREET
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('street') && issue.code === 'too_big'
                )
            ).toBe(true);
        }
    });

    it('an over-max street is still rejected on update (patch IS update)', () => {
        // `EventLocationPatchInputSchema` is a direct alias of
        // `EventLocationUpdateInputSchema` (same object identity, see
        // `eventLocation.crud.schema.ts`) — there is one guard here, not two.
        expect(EventLocationPatchInputSchema).toBe(EventLocationUpdateInputSchema);

        const result = EventLocationUpdateInputSchema.safeParse({ street: OVER_MAX_STREET });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('street') && issue.code === 'too_big'
                )
            ).toBe(true);
        }
    });
});
