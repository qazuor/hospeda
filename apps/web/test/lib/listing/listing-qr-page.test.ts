/**
 * @file listing-qr-page.test.ts
 * @description HOS-2688: the QR-page path per vertical, and the per-listing
 * record that keeps the first-publish notice to one showing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    announceListingQrPageOnce,
    buildListingQrPagePath,
    LISTING_QR_NOTICE_MAX_IDS,
    LISTING_QR_NOTICE_STORAGE_KEY,
    markListingQrNoticeShown,
    type NoticeStorage,
    wasListingQrNoticeShown
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

const NOTICE = {
    message: 'Tu QR está listo',
    actionLabel: 'Ver',
    href: '/es/mi-cuenta/x/codigo-qr/'
};
const PENDING_TOAST_KEY = 'hospeda.pendingToast';

describe('announceListingQrPageOnce', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('queues the toast once per listing, then never again', () => {
        const { storage } = memoryStorage();

        expect(announceListingQrPageOnce({ listingId: 'a', notice: NOTICE, storage })).toBe(true);
        expect(
            JSON.parse(window.sessionStorage.getItem(PENDING_TOAST_KEY) ?? 'null')
        ).toMatchObject({
            type: 'success',
            message: NOTICE.message,
            action: { label: NOTICE.actionLabel, href: NOTICE.href }
        });
        window.sessionStorage.clear();

        expect(announceListingQrPageOnce({ listingId: 'a', notice: NOTICE, storage })).toBe(false);
        expect(window.sessionStorage.getItem(PENDING_TOAST_KEY)).toBeNull();
        expect(announceListingQrPageOnce({ listingId: 'b', notice: NOTICE, storage })).toBe(true);
    });

    it('does NOT spend the claim when the toast could not be queued', () => {
        const { storage, data } = memoryStorage();
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(announceListingQrPageOnce({ listingId: 'a', notice: NOTICE, storage })).toBe(false);
        expect(data.has(LISTING_QR_NOTICE_STORAGE_KEY)).toBe(false);

        vi.restoreAllMocks();
        expect(announceListingQrPageOnce({ listingId: 'a', notice: NOTICE, storage })).toBe(true);
    });
});

describe('the once-per-listing record', () => {
    it('records the shown ids under its own key', () => {
        const { storage, data } = memoryStorage();
        markListingQrNoticeShown({ listingId: 'a', storage });
        markListingQrNoticeShown({ listingId: 'b', storage });
        markListingQrNoticeShown({ listingId: 'a', storage });

        expect(JSON.parse(data.get(LISTING_QR_NOTICE_STORAGE_KEY) ?? '')).toEqual(['a', 'b']);
        expect(wasListingQrNoticeShown({ listingId: 'a', storage })).toBe(true);
        expect(wasListingQrNoticeShown({ listingId: 'c', storage })).toBe(false);
    });

    it('treats a corrupt or foreign record as empty instead of throwing', () => {
        const { storage } = memoryStorage({ [LISTING_QR_NOTICE_STORAGE_KEY]: '{not json' });
        expect(wasListingQrNoticeShown({ listingId: 'a', storage })).toBe(false);

        const { storage: objectRecord } = memoryStorage({
            [LISTING_QR_NOTICE_STORAGE_KEY]: '{"a":true}'
        });
        expect(wasListingQrNoticeShown({ listingId: 'a', storage: objectRecord })).toBe(false);
    });

    it('never throws when storage is missing or refuses writes', () => {
        expect(wasListingQrNoticeShown({ listingId: 'a', storage: null })).toBe(false);
        expect(() => markListingQrNoticeShown({ listingId: 'a', storage: null })).not.toThrow();
        const { storage } = memoryStorage({}, true);
        expect(() => markListingQrNoticeShown({ listingId: 'a', storage })).not.toThrow();
    });

    it('caps the record, dropping the oldest ids first', () => {
        const ids = Array.from({ length: LISTING_QR_NOTICE_MAX_IDS }, (_, i) => `id-${i}`);
        const { storage, data } = memoryStorage({
            [LISTING_QR_NOTICE_STORAGE_KEY]: JSON.stringify(ids)
        });

        markListingQrNoticeShown({ listingId: 'new', storage });

        const kept = JSON.parse(data.get(LISTING_QR_NOTICE_STORAGE_KEY) ?? '[]') as string[];
        expect(kept).toHaveLength(LISTING_QR_NOTICE_MAX_IDS);
        expect(kept[0]).toBe('id-1');
        expect(kept.at(-1)).toBe('new');
    });
});
