import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';

const UUID = '3f2b1c9e-5a4d-4e8b-9c1a-0d7e6f5a4b3c';
const schema = AnalyticsEventSchemas[AnalyticsEvents.listingInternalEntry];

describe('listing_internal_entry (HOS-2119 T-075)', () => {
    it('should be named listing_internal_entry', () => {
        expect(AnalyticsEvents.listingInternalEntry).toBe('listing_internal_entry');
    });

    it.each(['ACCOMMODATION', 'VENUE', 'EXPERIENCE', 'PARTNER'])('should accept %s', (type) => {
        expect(schema.safeParse({ entity_id: UUID, entity_type: type }).success).toBe(true);
    });

    it('should accept the optional locale', () => {
        expect(
            schema.safeParse({ entity_id: UUID, entity_type: 'VENUE', locale: 'es' }).success
        ).toBe(true);
    });

    it.each(['POST', 'EVENT', 'NOPE'])('should reject a non-listing entity type %s', (type) => {
        expect(schema.safeParse({ entity_id: UUID, entity_type: type }).success).toBe(false);
    });

    it('should require entity_id (a UUID) and entity_type', () => {
        expect(schema.safeParse({ entity_type: 'VENUE' }).success).toBe(false);
        expect(schema.safeParse({ entity_id: UUID }).success).toBe(false);
        expect(schema.safeParse({ entity_id: 'not-a-uuid', entity_type: 'VENUE' }).success).toBe(
            false
        );
    });
});
