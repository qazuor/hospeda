/**
 * HOS-1062 — the shared bounded walk behind both plan-listing endpoints.
 *
 * This module exists because BOTH endpoints shipped the same bug in different
 * dress: the protected one passed the caller's window straight to qzpay, the
 * public one silently took `listPlans`' default page of twenty. Both filtered
 * what came back, so both could answer a list that had already lost rows.
 *
 * What is pinned here is therefore the walk's three obligations: it sees every
 * page, it refuses to hand back a partial catalogue, and it cannot loop.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type CatalogPage,
    collectCatalogPages,
    DEFAULT_CATALOG_MAX_PAGES,
    DEFAULT_CATALOG_PAGE_SIZE
} from '../../src/utils/collect-catalog-pages';

/**
 * A source of `total` rows that answers honest pages — the fixture a real
 * paginated backend behaves like.
 */
function makeSource(total: number) {
    const rows = Array.from({ length: total }, (_, index) => ({ id: index }));
    const fetchPage = vi.fn(
        async ({
            pageIndex,
            pageSize
        }: {
            pageIndex: number;
            pageSize: number;
        }): Promise<CatalogPage<{ id: number }>> => {
            const start = pageIndex * pageSize;
            const items = rows.slice(start, start + pageSize);
            return { items, hasMore: start + pageSize < rows.length };
        }
    );
    return { rows, fetchPage };
}

describe('collectCatalogPages — it sees the whole catalogue', () => {
    it('costs ONE request while the source fits in a single page', async () => {
        // The case that holds today for every catalogue in this repo. If this
        // regressed into N requests the change would be a silent cost, so it is
        // asserted rather than assumed.
        const { fetchPage } = makeSource(6);

        const result = await collectCatalogPages({ fetchPage });

        expect(fetchPage).toHaveBeenCalledOnce();
        expect(result).toHaveLength(6);
    });

    it('walks every page and preserves source order', async () => {
        const { rows, fetchPage } = makeSource(250);

        const result = await collectCatalogPages({ fetchPage, pageSize: 100 });

        expect(fetchPage).toHaveBeenCalledTimes(3);
        expect(result).toEqual(rows);
    });

    it('asks for consecutive pages of the requested size', async () => {
        const { fetchPage } = makeSource(30);

        await collectCatalogPages({ fetchPage, pageSize: 10 });

        expect(fetchPage).toHaveBeenNthCalledWith(1, { pageIndex: 0, pageSize: 10 });
        expect(fetchPage).toHaveBeenNthCalledWith(2, { pageIndex: 1, pageSize: 10 });
        expect(fetchPage).toHaveBeenNthCalledWith(3, { pageIndex: 2, pageSize: 10 });
    });

    it('handles an empty source without asking twice', async () => {
        const { fetchPage } = makeSource(0);

        const result = await collectCatalogPages({ fetchPage });

        expect(result).toEqual([]);
        expect(fetchPage).toHaveBeenCalledOnce();
    });
});

describe('collectCatalogPages — it refuses a partial catalogue', () => {
    it('answers null when the FIRST page fails', async () => {
        const fetchPage = vi.fn(async () => null);

        expect(await collectCatalogPages({ fetchPage })).toBeNull();
    });

    it('answers null when a LATER page fails, discarding what it already had', async () => {
        // The dangerous case: rows in hand. Returning them would hand back a
        // catalogue that is short by an unknown amount, and a caller cannot tell
        // that apart from a complete one.
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce({ items: [{ id: 0 }], hasMore: true })
            .mockResolvedValueOnce(null);

        const result = await collectCatalogPages({ fetchPage });

        expect(result).toBeNull();
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });
});

describe('collectCatalogPages — it cannot loop', () => {
    it('stops at maxPages against a source that always reports more', async () => {
        // A paging bug in a source (hasMore stuck true) must not spin forever.
        const fetchPage = vi.fn(async () => ({ items: [{ id: 1 }], hasMore: true }));

        const result = await collectCatalogPages({ fetchPage, maxPages: 4 });

        expect(fetchPage).toHaveBeenCalledTimes(4);
        expect(result).toHaveLength(4);
    });

    it('announces the truncation instead of returning quietly', async () => {
        // Silence here would be the same failure the module removes, one level up.
        const fetchPage = vi.fn(async () => ({ items: [{ id: 1 }], hasMore: true }));
        const onTruncated = vi.fn();

        await collectCatalogPages({ fetchPage, maxPages: 3, onTruncated });

        expect(onTruncated).toHaveBeenCalledWith({ fetched: 3, maxPages: 3 });
    });

    it('does not announce a truncation that did not happen', async () => {
        const { fetchPage } = makeSource(5);
        const onTruncated = vi.fn();

        await collectCatalogPages({ fetchPage, onTruncated });

        expect(onTruncated).not.toHaveBeenCalled();
    });
});

describe('collectCatalogPages — its defaults', () => {
    it('defaults to a 100-row page and a 10-page ceiling', async () => {
        // Both endpoints rely on these defaults rather than restating them, so a
        // change here is a change to both. Pinned so it is a decision, not a drift.
        expect(DEFAULT_CATALOG_PAGE_SIZE).toBe(100);
        expect(DEFAULT_CATALOG_MAX_PAGES).toBe(10);

        const { fetchPage } = makeSource(1);
        await collectCatalogPages({ fetchPage });

        expect(fetchPage).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 100 });
    });
});
