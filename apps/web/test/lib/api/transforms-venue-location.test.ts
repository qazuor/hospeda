/**
 * @file transforms-venue-location.test.ts
 * @description `toVenueDetailPageProps` reads the public postal address
 * defensively (HOS-2189): a payload without a usable street never paints a
 * block.
 */
import { describe, expect, it } from 'vitest';
import { toVenueDetailPageProps } from '../../../src/lib/api/transforms';

const item = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    slug: 'la-parrilla',
    name: 'La Parrilla',
    ...extra
});

describe('toVenueDetailPageProps — location (HOS-2189)', () => {
    it('maps a stored address, coordinates included', () => {
        const { location } = toVenueDetailPageProps({
            item: item({
                location: {
                    street: ' Mitre ',
                    number: '10',
                    coordinates: { lat: '-32.4', long: '-58.2' }
                }
            })
        });
        expect(location).toEqual({
            street: 'Mitre',
            number: '10',
            floor: '',
            apartment: '',
            lat: '-32.4',
            long: '-58.2'
        });
    });

    it.each([
        undefined,
        null,
        'x',
        [],
        {},
        { street: '  ' },
        { number: '10' }
    ])('is null for %j', (raw) => {
        expect(toVenueDetailPageProps({ item: item({ location: raw }) }).location).toBeNull();
    });
});
