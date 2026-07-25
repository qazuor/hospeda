import { describe, expect, it } from 'vitest';
import {
    EventAdminSchema,
    EventProtectedSchema
} from '../../../src/entities/event/event.access.schema.js';
import { createValidEvent } from '../../fixtures/event.fixtures.js';

/**
 * HOS-300 — end-to-end repro of the `/api/v1/admin/events` 500.
 *
 * `createPaginatedResponse` runs `stripWithSchema(item, EventAdminSchema)` per
 * item and is fail-closed: a single item that does not parse turns the WHOLE
 * paginated response into a 500. A production `event_locations` row carries a
 * 65-char street (write max is 50), so both events pointing at that venue
 * poisoned every page of the admin list — down to `pageSize=1`, since the
 * default sort is `createdAt:desc`.
 *
 * The eagerly-loaded `location` relation is the payload that must not throw.
 */

/** Verbatim production value of `event_locations.street` for "Palacio San José". */
const PROD_LONG_STREET = 'Ruta Provincial N.º 39, km 128 (zona rural, Departamento Uruguay)';

const eventWithLongStreetLocation = () => ({
    ...createValidEvent(),
    location: {
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
    }
});

describe('Event read schemas — HOS-300 admin list 500', () => {
    it('EventAdminSchema parses an event whose location street exceeds the write max', () => {
        const result = EventAdminSchema.safeParse(eventWithLongStreetLocation());

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.street).toBe(PROD_LONG_STREET);
        }
    });

    it('EventProtectedSchema parses the same event', () => {
        const result = EventProtectedSchema.safeParse(eventWithLongStreetLocation());

        expect(result.success).toBe(true);
    });
});
