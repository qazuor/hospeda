/**
 * @file listing-detail-presence.test.ts
 * @description Unit tests for the slot-presence predicates the venue and
 * experience pages use to decide which sticky tabs exist (HOS-2579 §6.2,
 * AC-6, AC-7). Each case mirrors the self-hide rule of the component the slot
 * holds, so a tab never points at an empty slot.
 */

import { describe, expect, it } from 'vitest';
import {
    hasListingDescription,
    hasVenueOffersContent,
    type VenueOffersSource
} from '@/lib/listing-detail/listing-detail-presence';

const EMPTY_VENUE: VenueOffersSource = {
    features: [],
    amenities: [],
    menuSections: [],
    menuFileUrl: null,
    menuFileKind: null,
    dailySpecials: [],
    venueEvents: []
};

describe('hasListingDescription', () => {
    it('is true with a summary, a plain description or a markdown description', () => {
        expect(hasListingDescription({ summary: 'Resumen', descriptionText: '' })).toBe(true);
        expect(hasListingDescription({ summary: '', descriptionText: 'Texto' })).toBe(true);
        expect(
            hasListingDescription({ summary: '', descriptionText: '', richDescription: '# Hola' })
        ).toBe(true);
    });

    it('is false when everything is empty or a blank markdown description', () => {
        expect(hasListingDescription({ summary: '', descriptionText: '' })).toBe(false);
        expect(
            hasListingDescription({
                summary: null,
                descriptionText: undefined,
                richDescription: '   '
            })
        ).toBe(false);
    });
});

describe('hasVenueOffersContent («Lo que ofrece», D-3)', () => {
    it('is false for a venue with nothing in slot 4', () => {
        expect(hasVenueOffersContent({ venue: EMPTY_VENUE, showEventsCta: false })).toBe(false);
        expect(
            hasVenueOffersContent({
                venue: { features: [], amenities: [] },
                showEventsCta: false
            })
        ).toBe(false);
    });

    it.each([
        ['features', { features: [{}] }],
        ['amenities', { amenities: [{}] }],
        ['a structured menu', { menuSections: [{}] }],
        [
            'an attached menu file',
            { menuFileUrl: 'https://example.com/carta.pdf', menuFileKind: 'pdf' }
        ],
        ['daily specials', { dailySpecials: [{}] }],
        ['the agenda', { venueEvents: [{}] }]
    ] as const)('is true with %s', (_label, patch) => {
        const venue = { ...EMPTY_VENUE, ...patch } as unknown as VenueOffersSource;

        expect(hasVenueOffersContent({ venue, showEventsCta: false })).toBe(true);
    });

    it('follows the night-info rule: true with one published field, false with none', () => {
        const blank = {
            entryKind: null,
            entryNote: null,
            entryPriceFromCents: null,
            entryPriceUpdatedAt: null,
            minAge: null,
            minAgeScope: null,
            dressCode: null,
            dressCodeNote: null,
            multiLine: false
        } as const;

        expect(
            hasVenueOffersContent({
                venue: { ...EMPTY_VENUE, nightInfo: blank },
                showEventsCta: false
            })
        ).toBe(false);
        expect(
            hasVenueOffersContent({
                venue: { ...EMPTY_VENUE, nightInfo: { ...blank, minAge: 18, minAgeScope: null } },
                showEventsCta: false
            })
        ).toBe(true);
    });

    it('is true with only the events CTA', () => {
        expect(hasVenueOffersContent({ venue: EMPTY_VENUE, showEventsCta: true })).toBe(true);
    });

    it('ignores a menu file with an unsafe URL or no kind (VenueMenu self-hides)', () => {
        const unsafe = {
            ...EMPTY_VENUE,
            menuFileUrl: 'javascript:alert(1)',
            menuFileKind: 'pdf' as const
        };
        const noKind = { ...EMPTY_VENUE, menuFileUrl: 'https://example.com/carta.pdf' };

        expect(hasVenueOffersContent({ venue: unsafe, showEventsCta: false })).toBe(false);
        expect(hasVenueOffersContent({ venue: noKind, showEventsCta: false })).toBe(false);
    });
});
