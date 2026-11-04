import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { DEFAULT_VENUE_TYPES } from '@/lib/listing-summary';

describe('DEFAULT_VENUE_TYPES', () => {
    it('derives exactly one catalog entry for every venue enum value', () => {
        const values = DEFAULT_VENUE_TYPES.map(({ key }) => key);
        expect(values).toHaveLength(Object.values(VenueTypeEnum).length);
        expect([...values].sort()).toEqual([...Object.values(VenueTypeEnum)].sort());
    });
});
