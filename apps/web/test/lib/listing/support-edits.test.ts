/**
 * @file support-edits.test.ts
 * @description TEST:V8a:8 (the screen part of "row 26 appears in the owner's
 * account"): the SSR loader of the support-edit notice (HOS-1493).
 *
 * The loader is enrichment of the editor hub, never a precondition: success
 * returns the API items untouched, and every failure path returns `{ items: [] }`
 * instead of throwing into the page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
vi.mock('@/lib/api/endpoints-protected', () => ({
    listingSupportEditsApi: { list: (...args: unknown[]) => list(...args) }
}));

const warn = vi.fn();
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: (...args: unknown[]) => warn(...args) }
}));

import { loadSupportEdits } from '@/lib/listing/support-edits';

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COOKIE = 'session=abc';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TEST:V8a:8 loadSupportEdits — row 26 loader', () => {
    it('returns the support edits of the listing, asking for its vertical and id', async () => {
        // Arrange
        const items = [
            { occurredAt: '2026-10-10T15:00:00.000Z', parts: ['texts', 'photos'] },
            { occurredAt: '2026-10-01T12:00:00.000Z', parts: ['faq'] }
        ];
        list.mockResolvedValue({ ok: true, data: { items } });

        // Act
        const result = await loadSupportEdits({
            vertical: 'gastronomy',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ items });
        expect(list).toHaveBeenCalledWith({
            vertical: 'gastronomy',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });
    });

    it('degrades to no items and logs when the API answers an error', async () => {
        // Arrange
        list.mockResolvedValue({ ok: false, error: { status: 500, message: 'boom' } });

        // Act
        const result = await loadSupportEdits({
            vertical: 'accommodation',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ items: [] });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('degrades to no items and logs when the request throws', async () => {
        // Arrange
        list.mockRejectedValue(new Error('network down'));

        // Act
        const result = await loadSupportEdits({
            vertical: 'experience',
            listingId: LISTING_ID,
            cookieHeader: COOKIE
        });

        // Assert
        expect(result).toEqual({ items: [] });
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not call the API without a session cookie', async () => {
        // Act
        const result = await loadSupportEdits({
            vertical: 'accommodation',
            listingId: LISTING_ID
        });

        // Assert
        expect(result).toEqual({ items: [] });
        expect(list).not.toHaveBeenCalled();
    });
});
