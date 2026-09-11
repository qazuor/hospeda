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

/**
 * The same source, reporting its own row count on every page — the shape both
 * real callers actually have (`planService`'s `pagination.total`, qzpay's
 * `total`), and the one that lets the walk CHECK `hasMore` instead of believing
 * it.
 */
function makeCountingSource(total: number) {
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
            return { items, hasMore: start + pageSize < rows.length, total: rows.length };
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

describe('collectCatalogPages — it checks `hasMore` instead of believing it', () => {
    it('announces a source that stops early while its own total says otherwise', () => {
        // The last path on which "partial" looked exactly like "complete": a
        // source answering hasMore:false with rows still pending returned a short
        // catalogue with no null and no callback. The number to catch it was
        // already on the wire — both callers were discarding it.
        const fetchPage = vi.fn(async () => ({
            items: [{ id: 1 }, { id: 2 }],
            hasMore: false,
            total: 7
        }));
        const onTruncated = vi.fn();

        return collectCatalogPages({ fetchPage, onTruncated }).then((result) => {
            expect(result).toHaveLength(2);
            expect(onTruncated).toHaveBeenCalledWith(
                expect.objectContaining({ fetched: 2, expected: 7 })
            );
        });
    });

    it('stays quiet when the count agrees with what it collected', async () => {
        const { fetchPage } = makeCountingSource(250);
        const onTruncated = vi.fn();

        const result = await collectCatalogPages({ fetchPage, pageSize: 100, onTruncated });

        expect(result).toHaveLength(250);
        expect(onTruncated).not.toHaveBeenCalled();
    });

    it('does not cry truncation when the source collected MORE than it claimed', async () => {
        // A stale or approximate count is not a truncation. Only fewer rows than
        // promised is, and this is the direction that matters.
        const fetchPage = vi.fn(async () => ({
            items: [{ id: 1 }, { id: 2 }, { id: 3 }],
            hasMore: false,
            total: 2
        }));
        const onTruncated = vi.fn();

        await collectCatalogPages({ fetchPage, onTruncated });

        expect(onTruncated).not.toHaveBeenCalled();
    });

    it('still trusts hasMore when the source cannot count', async () => {
        // `total` is optional on purpose. A source that never reports one keeps
        // the previous behaviour rather than being treated as truncated forever.
        const { fetchPage } = makeSource(5);
        const onTruncated = vi.fn();

        const result = await collectCatalogPages({ fetchPage, onTruncated });

        expect(result).toHaveLength(5);
        expect(onTruncated).not.toHaveBeenCalled();
    });

    it('reports the source total alongside a ceiling truncation', async () => {
        const fetchPage = vi.fn(async () => ({ items: [{ id: 1 }], hasMore: true, total: 900 }));
        const onTruncated = vi.fn();

        await collectCatalogPages({ fetchPage, maxPages: 3, onTruncated });

        expect(onTruncated).toHaveBeenCalledWith({ fetched: 3, maxPages: 3, expected: 900 });
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
