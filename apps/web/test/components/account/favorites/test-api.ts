/**
 * @file test-api.ts
 * @description A routed `fetch` stub for the favorites tests (HOS-2480):
 * answers the bookmarks list, the tab counts, the collections list and the
 * bookmark DELETE from in-memory fixtures, and records every request.
 */

import { vi } from 'vitest';

/** A bookmark fixture as the list endpoint returns it. */
export interface FixtureBookmark {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: string;
    readonly entityName: string;
    readonly entitySlug: string;
    readonly description?: string | null;
    readonly collectionId?: string | null;
}

/** Options of {@link installFavoritesApi}. */
export interface FavoritesApiOptions {
    /** Uncollected bookmarks the server holds. */
    readonly bookmarks?: readonly FixtureBookmark[];
    /** Collections; `'noPlan'` answers 403 ENTITLEMENT_REQUIRED. */
    readonly collections?:
        | 'noPlan'
        | readonly { readonly id: string; readonly name: string; readonly bookmarkCount: number }[];
    /** Collections usage. */
    readonly usage?: { readonly current: number; readonly max: number };
    /** How many uncollected-list reads fail with a 500 before succeeding. */
    readonly failListReads?: number;
    /** Status of the DELETE. */
    readonly deleteStatus?: number;
}

/** Builds one fixture bookmark. */
export function bookmark(n: number, overrides: Partial<FixtureBookmark> = {}): FixtureBookmark {
    return {
        id: `bm-${n}`,
        entityId: `ent-${n}`,
        entityType: 'ACCOMMODATION',
        entityName: `Lugar ${n}`,
        entitySlug: `lugar-${n}`,
        description: null,
        collectionId: null,
        ...overrides
    };
}

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });

/**
 * Installs the stub on `globalThis.fetch`.
 *
 * @param options - Fixtures.
 * @returns The mock, to inspect calls.
 */
export function installFavoritesApi(options: FavoritesApiOptions = {}) {
    let bookmarks = [...(options.bookmarks ?? [])];
    let failures = options.failListReads ?? 0;
    const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? 'GET';
        if (url.pathname.startsWith('/api/v1/protected/user-bookmarks/') && method === 'DELETE') {
            const id = url.pathname.split('/').pop();
            const status = options.deleteStatus ?? 200;
            if (status >= 400) {
                return json(
                    { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } },
                    status
                );
            }
            bookmarks = bookmarks.filter((b) => b.id !== id);
            return json({ success: true, data: {} });
        }
        if (url.pathname === '/api/v1/protected/user-bookmarks') {
            const type = url.searchParams.get('entityType');
            const all = type ? bookmarks.filter((b) => b.entityType === type) : bookmarks;
            const page = Number(url.searchParams.get('page') ?? '1');
            const size = Number(url.searchParams.get('pageSize') ?? '12');
            if (url.searchParams.get('uncollected') === 'true') {
                if (failures > 0) {
                    failures -= 1;
                    return json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
                }
                return json({
                    success: true,
                    data: {
                        bookmarks: all.slice((page - 1) * size, page * size),
                        total: all.length
                    }
                });
            }
            return json({ success: true, data: { bookmarks: [], total: all.length } });
        }
        if (url.pathname === '/api/v1/protected/user-bookmark-collections') {
            if (options.collections === 'noPlan') {
                return json(
                    { success: false, error: { code: 'ENTITLEMENT_REQUIRED', message: 'x' } },
                    403
                );
            }
            return json({
                success: true,
                data: {
                    items: (options.collections ?? []).map((c) => ({
                        ...c,
                        description: null,
                        color: null,
                        icon: null
                    })),
                    usage: options.usage ?? { current: 0, max: 10 }
                }
            });
        }
        return json({ success: false }, 404);
    });
    globalThis.fetch = mock as unknown as typeof fetch;
    return mock;
}

/** The URLs the stub received, as strings. */
export function requestedUrls(mock: ReturnType<typeof installFavoritesApi>): string[] {
    return mock.mock.calls.map((call) => String(call[0]));
}
