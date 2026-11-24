/**
 * Catalog schemas of the listing detail action events (HOS-2579 §6.10.4):
 * the additive `origin` on `favorite_added` / `favorite_removed` and the new
 * `listing_shared` event.
 */
import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';

const favoritePayload = {
    entity_id: 'acc-1',
    entity_type: 'ACCOMMODATION',
    assigned_collection: false
};

const sharePayload = {
    listing_id: 'listing-123',
    vertical: 'venue',
    origin: 'bar',
    method: 'native',
    locale: 'es'
};

describe('favorite events origin (HOS-2579)', () => {
    it.each([
        AnalyticsEvents.favoriteAdded,
        AnalyticsEvents.favoriteRemoved
    ])('%s still accepts a payload without origin (additive change)', (name) => {
        // Act
        const parsed = AnalyticsEventSchemas[name].parse(favoritePayload);

        // Assert
        expect(parsed).toStrictEqual(favoritePayload);
    });

    it.each([
        AnalyticsEvents.favoriteAdded,
        AnalyticsEvents.favoriteRemoved
    ])('%s accepts every contact origin', (name) => {
        for (const origin of ['bar', 'gallery', 'summary', 'tabs'] as const) {
            // Act
            const parsed = AnalyticsEventSchemas[name].parse({ ...favoritePayload, origin });

            // Assert
            expect(parsed).toStrictEqual({ ...favoritePayload, origin });
        }
    });

    it.each([
        AnalyticsEvents.favoriteAdded,
        AnalyticsEvents.favoriteRemoved
    ])('%s rejects an unknown origin', (name) => {
        // Act
        const result = AnalyticsEventSchemas[name].safeParse({
            ...favoritePayload,
            origin: 'footer'
        });

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('listing_shared (HOS-2579)', () => {
    it('registers the event name', () => {
        expect(AnalyticsEvents.listingShared).toBe('listing_shared');
    });

    it.each(['native', 'copy', 'network'] as const)('accepts method %s', (method) => {
        // Act
        const parsed = AnalyticsEventSchemas[AnalyticsEvents.listingShared].parse({
            ...sharePayload,
            method
        });

        // Assert
        expect(parsed).toStrictEqual({ ...sharePayload, method });
    });

    it.each([
        'accommodation',
        'experience',
        'venue'
    ] as const)('accepts vertical %s', (vertical) => {
        // Act
        const result = AnalyticsEventSchemas[AnalyticsEvents.listingShared].safeParse({
            ...sharePayload,
            vertical
        });

        // Assert
        expect(result.success).toBe(true);
    });

    it.each([
        { listing_id: '' },
        { vertical: 'partner' },
        { vertical: 'event' },
        { origin: 'footer' },
        { origin: undefined },
        { method: 'sms' },
        { method: undefined },
        { locale: 'p' }
    ])('rejects %j', (invalid) => {
        // Act
        const result = AnalyticsEventSchemas[AnalyticsEvents.listingShared].safeParse({
            ...sharePayload,
            ...invalid
        });

        // Assert
        expect(result.success).toBe(false);
    });
});
