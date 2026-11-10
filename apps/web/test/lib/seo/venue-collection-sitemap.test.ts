/**
 * @file venue-collection-sitemap.test.ts
 * @description Behaviour tests for the venue business-line collection sitemap
 * resolver (HOS-1787 leaf 6.9, AC:6:2).
 *
 * The rule under test is fail-closed: a collection is advertised only when the
 * public venue list confirms `pagination.total > 0`. Every other outcome —
 * non-2xx, `success: false`, malformed JSON, a rejected fetch, a missing
 * pagination block, a zero total — excludes it. Advertising an empty page is
 * the failure this module exists to prevent.
 */
import { businessLineToUrlSlug, listPublicBusinessLines } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPopulatedVenueCollectionPaths } from '../../../src/lib/seo/venue-collection-sitemap';

const API_URL = 'http://api.test';
const VENUE_LINES = listPublicBusinessLines({ vertical: 'venue' });

function makeVenueResponse(total: number): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data: {
                items: [],
                pagination: { page: 1, pageSize: 1, total, totalPages: total > 0 ? 1 : 0 }
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function stubFetch(handler: (url: URL) => Promise<Response> | Response): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn((input: string | URL) =>
        Promise.resolve(handler(new URL(String(input))))
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('fetchPopulatedVenueCollectionPaths', () => {
    it('includes a collection whose total is greater than zero', async () => {
        stubFetch(() => makeVenueResponse(1));

        const paths = await fetchPopulatedVenueCollectionPaths({ apiUrl: API_URL });

        expect(paths).toEqual(VENUE_LINES.map(({ urlSlug }) => `/comer-y-salir/rubro/${urlSlug}/`));
    });

    it('excludes a collection whose total is zero', async () => {
        stubFetch(() => makeVenueResponse(0));

        await expect(fetchPopulatedVenueCollectionPaths({ apiUrl: API_URL })).resolves.toEqual([]);
    });

    it.each([
        ['a non-2xx response', () => new Response('nope', { status: 503 })],
        [
            'a success:false body',
            () =>
                new Response(JSON.stringify({ success: false }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
        ],
        [
            'invalid JSON',
            () =>
                new Response('not json', {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
        ],
        [
            'a missing pagination block',
            () =>
                new Response(JSON.stringify({ success: true, data: { items: [] } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
        ]
    ])('excludes the collection on %s', async (_label, makeResponse) => {
        stubFetch(makeResponse);

        await expect(fetchPopulatedVenueCollectionPaths({ apiUrl: API_URL })).resolves.toEqual([]);
    });

    it('excludes the collection when the fetch rejects', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('timeout')))
        );

        await expect(fetchPopulatedVenueCollectionPaths({ apiUrl: API_URL })).resolves.toEqual([]);
    });

    it('asks the public venue list for one row of each internal business line', async () => {
        const fetchMock = stubFetch(() => makeVenueResponse(1));

        await fetchPopulatedVenueCollectionPaths({ apiUrl: API_URL });

        expect(fetchMock).toHaveBeenCalledTimes(VENUE_LINES.length);

        const requestedLines = fetchMock.mock.calls.map((call) => {
            const url = new URL(String(call[0]));
            expect(url.pathname).toBe('/api/v1/public/venues');
            expect(url.searchParams.get('page')).toBe('1');
            expect(url.searchParams.get('pageSize')).toBe('1');
            return url.searchParams.get('businessLine');
        });

        expect(requestedLines).toEqual(VENUE_LINES.map(({ value }) => value));
        // The Spanish slug lives only in the web URL: it is never sent here.
        for (const { urlSlug } of VENUE_LINES) {
            for (const call of fetchMock.mock.calls) {
                expect(String(call[0])).not.toContain(urlSlug);
            }
        }
        expect(businessLineToUrlSlug({ value: VENUE_LINES[0].value }).urlSlug).toBeTruthy();
    });
});
