/**
 * @file venue-menu-glyph.test.ts
 * @description HOS-2607: the venue «Ver carta» glyph is a fork and knife for
 * food venues and a drink for nightlife venues, decided per venue type.
 */
import { BUSINESS_LINE_RULES, VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    resolveVenueMenuGlyph,
    VENUE_MENU_GLYPH_BY_TYPE
} from '@/lib/listing-contact/venue-menu-glyph';

describe('resolveVenueMenuGlyph (HOS-2607)', () => {
    it.each([
        [VenueTypeEnum.RESTAURANT, 'food'],
        [VenueTypeEnum.CAFE, 'food'],
        [VenueTypeEnum.PARRILLA, 'food'],
        [VenueTypeEnum.HELADERIA, 'food'],
        [VenueTypeEnum.PANADERIA, 'food'],
        [VenueTypeEnum.ROTISERIA, 'food'],
        [VenueTypeEnum.FOOD_TRUCK, 'food'],
        [VenueTypeEnum.BAR, 'nightlife'],
        [VenueTypeEnum.CERVECERIA, 'nightlife'],
        [VenueTypeEnum.PUB, 'nightlife'],
        [VenueTypeEnum.BOLICHE, 'nightlife']
    ] as const)('%s → %s', (type, glyph) => {
        // Arrange + Act
        const result = resolveVenueMenuGlyph({ type });

        // Assert
        expect(result).toEqual({ glyph });
    });

    it('covers every VenueTypeEnum value, no more and no less', () => {
        expect(Object.keys(VENUE_MENU_GLYPH_BY_TYPE).sort()).toEqual(
            Object.values(VenueTypeEnum).sort()
        );
    });

    it('is case-insensitive', () => {
        expect(resolveVenueMenuGlyph({ type: 'boliche' })).toEqual({ glyph: 'nightlife' });
    });

    it.each([
        ['an unknown type', 'KARAOKE'],
        ['an empty type', ''],
        ['a null type', null],
        ['an undefined type', undefined]
    ])('falls back to the food glyph for %s', (_name, type) => {
        expect(resolveVenueMenuGlyph({ type })).toEqual({ glyph: 'food' });
    });

    it('agrees with the catalog: nightlife exactly when the type preselects the nightlife line', () => {
        for (const [type, rule] of Object.entries(BUSINESS_LINE_RULES.venue.typeRules)) {
            const preselectsNightlife = (rule.preselect as readonly string[]).includes('nightlife');
            expect(
                VENUE_MENU_GLYPH_BY_TYPE[type as VenueTypeEnum],
                `${type} preselects ${rule.preselect.join('+')}`
            ).toBe(preselectsNightlife ? 'nightlife' : 'food');
        }
    });
});
