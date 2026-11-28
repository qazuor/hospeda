/**
 * @file listing-qr-page.test.ts
 * @description HOS-2688: the QR-page path per vertical, and the per-listing
 * claim that keeps the first-publish notice to one showing.
 */
import { describe, expect, it } from 'vitest';
import {
    buildListingQrPagePath,
    claimListingQrNotice,
    LISTING_QR_NOTICE_MAX_IDS,
    LISTING_QR_NOTICE_STORAGE_KEY,
    type NoticeStorage
} from '@/lib/listing/listing-qr-page';

/** An in-memory storage; `failWrites` makes `setItem` throw like a full quota. */
function memoryStorage(initial: Record<string, string> = {}, failWrites = false) {
    const data = new Map(Object.entries(initial));
    const storage: NoticeStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            if (failWrites) throw new Error('QuotaExceededError');
            data.set(key, value);
        }
    };
    return { storage, data };
}

describe('buildListingQrPagePath', () => {
    it.each([
        ['accommodation', 'mi-cuenta/propiedades/abc/codigo-qr'],
        ['venue', 'mi-cuenta/comercio/venue/abc/codigo-qr'],
        ['experience', 'mi-cuenta/comercio/experience/abc/codigo-qr']
    ] as const)('puts the %s QR page next to its editor', (vertical, expected) => {
        expect(buildListingQrPagePath({ vertical, listingId: 'abc' })).toBe(expected);
    });

    it('encodes the id so it cannot escape its segment', () => {
        expect(buildListingQrPagePath({ vertical: 'venue', listingId: '../x' })).toBe(
            'mi-cuenta/comercio/venue/..%2Fx/codigo-qr'
        );
    });
});

describe('claimListingQrNotice', () => {
    it('answers true once per listing, then false', () => {
        const { storage } = memoryStorage();

        expect(claimListingQrNotice({ listingId: 'a', storage })).toBe(true);
        expect(claimListingQrNotice({ listingId: 'a', storage })).toBe(false);
        expect(claimListingQrNotice({ listingId: 'b', storage })).toBe(true);
    });

    it('records the claimed ids under its own key', () => {
        const { storage, data } = memoryStorage();
        claimListingQrNotice({ listingId: 'a', storage });
        claimListingQrNotice({ listingId: 'b', storage });

        expect(JSON.parse(data.get(LISTING_QR_NOTICE_STORAGE_KEY) ?? '')).toEqual(['a', 'b']);
    });

    it('treats a corrupt or foreign record as empty instead of throwing', () => {
        const { storage } = memoryStorage({
            [LISTING_QR_NOTICE_STORAGE_KEY]: '{not json'
        });
        expect(claimListingQrNotice({ listingId: 'a', storage })).toBe(true);

        const { storage: objectRecord } = memoryStorage({
            [LISTING_QR_NOTICE_STORAGE_KEY]: '{"a":true}'
        });
        expect(claimListingQrNotice({ listingId: 'a', storage: objectRecord })).toBe(true);
    });

    it('still shows the notice when storage is missing or refuses writes', () => {
        expect(claimListingQrNotice({ listingId: 'a', storage: null })).toBe(true);
        const { storage } = memoryStorage({}, true);
        expect(claimListingQrNotice({ listingId: 'a', storage })).toBe(true);
    });

    it('caps the record, dropping the oldest ids first', () => {
        const ids = Array.from({ length: LISTING_QR_NOTICE_MAX_IDS }, (_, i) => `id-${i}`);
        const { storage, data } = memoryStorage({
            [LISTING_QR_NOTICE_STORAGE_KEY]: JSON.stringify(ids)
        });

        claimListingQrNotice({ listingId: 'new', storage });

        const kept = JSON.parse(data.get(LISTING_QR_NOTICE_STORAGE_KEY) ?? '[]') as string[];
        expect(kept).toHaveLength(LISTING_QR_NOTICE_MAX_IDS);
        expect(kept[0]).toBe('id-1');
        expect(kept.at(-1)).toBe('new');
    });
});
