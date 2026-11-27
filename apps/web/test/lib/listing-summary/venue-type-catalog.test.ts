import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { VENUE_TYPE_OPTIONS } from '@/lib/venue/venue-type-options';

describe('VENUE_TYPE_OPTIONS', () => {
    it('derives exactly one catalog entry for every venue enum value', () => {
        const values = VENUE_TYPE_OPTIONS;
        expect(values).toHaveLength(Object.values(VenueTypeEnum).length);
        expect([...values].sort()).toEqual([...Object.values(VenueTypeEnum)].sort());
    });
});
