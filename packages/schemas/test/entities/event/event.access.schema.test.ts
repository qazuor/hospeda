import { describe, expect, it } from 'vitest';
import {
    EventAdminSchema,
    EventProtectedSchema
} from '../../../src/entities/event/event.access.schema.js';
import { EventLocationAddressSchema } from '../../../src/entities/eventLocation/eventLocation.address.schema.js';
import { createValidEvent } from '../../fixtures/event.fixtures.js';

/**
 * HOS-300 — end-to-end repro of the `/api/v1/admin/events` 500.
 *
 * `createPaginatedResponse` runs `stripWithSchema(item, EventAdminSchema)` per
 * item and is fail-closed: a single item that does not parse turns the WHOLE
 * paginated response into a 500. A production `event_locations` row carries a
 * 65-char street while the write max was 50, so both events pointing at that
 * venue poisoned every page of the admin list — down to `pageSize=1`, since the
 * default sort is `createdAt:desc`.
 *
 * The same issue ALSO raised the write bound to 150, which makes that 65-char
 * value legal on the write schema now. So the guard below is expressed against
 * the CURRENT bound ({@link OVER_MAX_STREET}, derived from the schema) rather
 * than the incident payload — otherwise it would pass identically against a
 * strict-derived read schema and prove nothing. The production value is still
 * pinned separately, since it is the literal symptom of the issue.
 *
 * The eagerly-loaded `location` relation is the payload that must not throw.
 */

/** Verbatim production value of `event_locations.street` for "Palacio San José". */
const PROD_LONG_STREET = 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)';

/**
 * Write-side maximum for `street`, read off the schema rather than hardcoded.
 * Throws when the bound disappears: `maxLength` would be `null` and the derived
 * over-max value would degenerate into a 1-char string, silently gutting the
 * guard. See the same derivation in `eventLocation.access.schema.test.ts`.
 */
const streetWriteMaxOrNull = EventLocationAddressSchema.shape.street.unwrap().unwrap().maxLength;
if (typeof streetWriteMaxOrNull !== 'number') {
    throw new Error(
        'HOS-300 test guard: `EventLocationAddressSchema.shape.street` no longer declares a `.max()` bound. This repro derives its over-max value from it and cannot express read⊇write without it.'
    );
}
const STREET_WRITE_MAX = streetWriteMaxOrNull;

/** A street longer than whatever the current write bound is. */
const OVER_MAX_STREET = 'A'.repeat(STREET_WRITE_MAX + 1);

const eventWithLocationStreet = (street: string) => ({
    ...createValidEvent(),
    location: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'palacio-san-jose',
        destinationId: '550e8400-e29b-41d4-a716-446655440001',
        placeName: 'Palacio San José',
        coordinates: { lat: '-32.1833', long: '-58.6667' },
        street,
        number: '128',
        lifecycleState: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        updatedById: null
    }
});

describe('Event read schemas — HOS-300 admin list 500', () => {
    it('EventAdminSchema parses an event whose location street exceeds the current write max', () => {
        const result = EventAdminSchema.safeParse(eventWithLocationStreet(OVER_MAX_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventProtectedSchema parses the same event', () => {
        const result = EventProtectedSchema.safeParse(eventWithLocationStreet(OVER_MAX_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(OVER_MAX_STREET);
        }
    });

    it('EventAdminSchema parses the real production row that caused the 500', () => {
        // Incident fact, not a read⊇write proof: the 65-char street fits the
        // raised 150 bound, so this passes on strict schemas too.
        expect(PROD_LONG_STREET.length).toBeLessThanOrEqual(STREET_WRITE_MAX);

        const result = EventAdminSchema.safeParse(eventWithLocationStreet(PROD_LONG_STREET));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(PROD_LONG_STREET);
        }
    });
});
