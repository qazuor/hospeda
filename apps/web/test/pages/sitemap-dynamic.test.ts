/**
 * @fileoverview
 * Unit tests for the dynamic sitemap endpoint (src/pages/sitemap-dynamic.xml.ts).
 *
 * Strategy: mock fetch() and the env helpers, then call the GET handler directly.
 * Asserts that:
 *  - Valid XML is returned with correct Content-Type and Cache-Control headers.
 *  - Each entity (accommodation, destination, event, post) is represented in the output.
 *  - All 3 locales (es, en, pt) are emitted for each entity.
 *  - Correct URL path prefixes are used (/alojamientos/, /destinos/, /eventos/, /publicaciones/).
 *  - SPEC-157 REQ-2: the es locale carries the /es prefix so sitemap URLs match
 *    the page canonical (the unprefixed form 302-redirects, breaking crawl trust).
 *  - Partial success: when one entity fetch fails, the others still appear.
 *  - Empty state: when all fetches fail, valid XML with an empty <urlset> is returned.
 *  - Cache headers: Cache-Control is public, max-age=86400, stale-while-revalidate=86400.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiUrl } from '../../src/lib/env';
import * as mod from '../../src/pages/sitemap-dynamic.xml.js';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../../src/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test'),
    getSiteUrl: vi.fn(() => 'https://hospeda.test')
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Mirrors the REAL public API list shape: { success, data: { items, pagination } }.
// (The previous mock used data.data, which masked the empty-sitemap bug.)
function makeApiResponse(items: Array<{ slug: string; updatedAt?: string }>): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data: {
                items,
                pagination: { page: 1, pageSize: 200, total: items.length, totalPages: 1 }
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function makeEmptyApiResponse(): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data: { items: [], pagination: { page: 1, pageSize: 200, total: 0, totalPages: 0 } }
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sitemap-dynamic.xml — GET handler', () => {
    let GET: (req: { url?: string }) => Promise<Response>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Re-import after resetModules to pick up fresh mocks

        GET = mod.GET as typeof GET;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns XML with correct Content-Type header', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEmptyApiResponse()));

        const response = await GET({});
        expect(response.headers.get('Content-Type')).toContain('application/xml');
    });

    it('returns Cache-Control: public, max-age=86400, stale-while-revalidate=86400', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEmptyApiResponse()));

        const response = await GET({});
        expect(response.headers.get('Cache-Control')).toBe(
            'public, max-age=86400, stale-while-revalidate=86400'
        );
    });

    it('returns status 200 with valid XML structure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEmptyApiResponse()));

        const response = await GET({});
        expect(response.status).toBe(200);

        const body = await response.text();
        expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
        expect(body).toContain('</urlset>');
    });

    it('emits accommodation entries with /alojamientos/ path for all 3 locales', async () => {
        const fetchMock = vi.fn();

        // accommodations
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(
                makeApiResponse([{ slug: 'hotel-solanas', updatedAt: '2026-01-15T00:00:00.000Z' }])
            )
        );
        // second page accommodations (empty = stop)
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // destinations, events, posts — all empty
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        // es locale — /es prefix (matches the page canonical; SPEC-157 REQ-2)
        expect(body).toContain('https://hospeda.test/es/alojamientos/hotel-solanas/');
        // en locale
        expect(body).toContain('https://hospeda.test/en/alojamientos/hotel-solanas/');
        // pt locale
        expect(body).toContain('https://hospeda.test/pt/alojamientos/hotel-solanas/');
    });

    it('does not send a status query param to the API (regression: status=published -> HTTP 400)', async () => {
        // The public list endpoints reject an unknown `status` param with HTTP 400,
        // which previously made every entity fetch fail and the sitemap come back empty.
        const fetchMock = vi.fn().mockResolvedValue(makeEmptyApiResponse());
        vi.stubGlobal('fetch', fetchMock);

        await GET({});

        expect(fetchMock).toHaveBeenCalled();
        for (const call of fetchMock.mock.calls) {
            expect(String(call[0])).not.toContain('status=');
        }
    });

    it('requests pageSize <= 100 (regression: pageSize=200 -> HTTP 400 -> empty sitemap)', async () => {
        // The public list endpoints cap pageSize at 100; a larger value returns
        // HTTP 400, breaking the fetch loop on the first page so the sitemap came
        // back empty. The request must never exceed the API maximum.
        const fetchMock = vi.fn().mockResolvedValue(makeEmptyApiResponse());
        vi.stubGlobal('fetch', fetchMock);

        await GET({});

        expect(fetchMock).toHaveBeenCalled();
        for (const call of fetchMock.mock.calls) {
            const pageSize = Number(new URL(String(call[0])).searchParams.get('pageSize'));
            expect(pageSize).toBeLessThanOrEqual(100);
        }
    });

    it('emits destination entries with /destinos/ path for all 3 locales', async () => {
        const fetchMock = vi.fn();

        // accommodations empty (2 calls: page1 empty)
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // destinations: 1 item
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(makeApiResponse([{ slug: 'concordia' }]))
        );
        // destinations page 2 empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // events and posts empty
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        expect(body).toContain('https://hospeda.test/es/destinos/concordia/');
        expect(body).toContain('https://hospeda.test/en/destinos/concordia/');
        expect(body).toContain('https://hospeda.test/pt/destinos/concordia/');
    });

    it('emits event entries with /eventos/ path for all 3 locales', async () => {
        const fetchMock = vi.fn();

        // accommodations empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // destinations empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // events: 1 item
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(makeApiResponse([{ slug: 'festival-litoral-2026' }]))
        );
        // events page 2 empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // posts empty
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        expect(body).toContain('https://hospeda.test/es/eventos/festival-litoral-2026/');
        expect(body).toContain('https://hospeda.test/en/eventos/festival-litoral-2026/');
        expect(body).toContain('https://hospeda.test/pt/eventos/festival-litoral-2026/');
    });

    it('emits post entries with /publicaciones/ path for all 3 locales', async () => {
        const fetchMock = vi.fn();

        // accommodations, destinations, events — all empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));
        // posts: 1 item
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(makeApiResponse([{ slug: 'turismo-litoral' }]))
        );
        // posts page 2 empty
        fetchMock.mockImplementationOnce(() => Promise.resolve(makeEmptyApiResponse()));

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        expect(body).toContain('https://hospeda.test/es/publicaciones/turismo-litoral/');
        expect(body).toContain('https://hospeda.test/en/publicaciones/turismo-litoral/');
        expect(body).toContain('https://hospeda.test/pt/publicaciones/turismo-litoral/');
    });

    it('emits every es-locale URL with the /es prefix (SPEC-157 REQ-2 regression)', async () => {
        const fetchMock = vi.fn();

        // accommodations: 1 item on page 1, empty thereafter
        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(makeApiResponse([{ slug: 'casa-rio' }]))
        );
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        // The es URL MUST carry the /es prefix so it matches the page canonical
        // and returns HTTP 200 — the unprefixed form 302-redirects to /es/.
        expect(body).toContain('<loc>https://hospeda.test/es/alojamientos/casa-rio/</loc>');
        // And the unprefixed es form must NOT be emitted as a <loc>.
        expect(body).not.toContain('<loc>https://hospeda.test/alojamientos/casa-rio/</loc>');
    });

    it('includes lastmod when updatedAt is present', async () => {
        const fetchMock = vi.fn();

        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(
                makeApiResponse([{ slug: 'cabana-norte', updatedAt: '2026-03-10T12:00:00.000Z' }])
            )
        );
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        expect(body).toContain('<lastmod>2026-03-10T12:00:00.000Z</lastmod>');
    });

    it('includes changefreq=weekly and priority=0.8', async () => {
        const fetchMock = vi.fn();

        fetchMock.mockImplementationOnce(() =>
            Promise.resolve(makeApiResponse([{ slug: 'hotel-test' }]))
        );
        fetchMock.mockResolvedValue(makeEmptyApiResponse());

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        const body = await response.text();

        expect(body).toContain('<changefreq>weekly</changefreq>');
        expect(body).toContain('<priority>0.8</priority>');
    });

    it('returns partial sitemap when one entity fetch fails (other entities still present)', async () => {
        // Use a URL-based mock so order does not depend on call sequence.
        // All fetches happen in parallel via Promise.allSettled.
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            const urlStr = String(url);

            // Destinations endpoint always fails
            if (urlStr.includes('/destinations')) {
                return Promise.reject(new Error('Network error'));
            }

            // Accommodations — return one item on page 1, empty on page 2
            if (urlStr.includes('/accommodations')) {
                if (urlStr.includes('page=1')) {
                    return Promise.resolve(makeApiResponse([{ slug: 'ok-accommodation' }]));
                }
                return Promise.resolve(makeEmptyApiResponse());
            }

            // Events — return one item on page 1, empty on page 2
            if (urlStr.includes('/events')) {
                if (urlStr.includes('page=1')) {
                    return Promise.resolve(makeApiResponse([{ slug: 'ok-event' }]));
                }
                return Promise.resolve(makeEmptyApiResponse());
            }

            // Posts — return one item on page 1, empty on page 2
            if (urlStr.includes('/posts')) {
                if (urlStr.includes('page=1')) {
                    return Promise.resolve(makeApiResponse([{ slug: 'ok-post' }]));
                }
                return Promise.resolve(makeEmptyApiResponse());
            }

            return Promise.resolve(makeEmptyApiResponse());
        });

        vi.stubGlobal('fetch', fetchMock);

        const response = await GET({});
        expect(response.status).toBe(200);

        const body = await response.text();

        // Accommodation, event, and post entries still present
        expect(body).toContain('/alojamientos/ok-accommodation/');
        expect(body).toContain('/eventos/ok-event/');
        expect(body).toContain('/publicaciones/ok-post/');

        // Destination detail absent (fetch failed); listing still present
        expect(body).not.toContain('/destinos/concordia');
        expect(body).toContain('/es/destinos/</loc>');

        // XML is still valid
        expect(body).toContain('<?xml version="1.0"');
        expect(body).toContain('</urlset>');
    });

    it('returns valid empty XML when all fetches fail', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('All down')));

        const response = await GET({});
        expect(response.status).toBe(200);

        const body = await response.text();
        expect(body).toContain('<?xml version="1.0"');
        expect(body).toContain('<urlset');
        expect(body).toContain('</urlset>');
        // Home page and listing pages are always emitted (priority 1.0/0.7)
        // even when API fetches fail — these are statically-known routes.
        expect(body).toContain('<loc>https://hospeda.test/es/</loc>');
        expect(body).toContain('<loc>https://hospeda.test/es/alojamientos/</loc>');
        expect(body).toContain('<loc>https://hospeda.test/es/destinos/</loc>');
        expect(body).toContain('<loc>https://hospeda.test/es/gastronomia/</loc>');
        expect(body).toContain('<loc>https://hospeda.test/es/experiencias/</loc>');
        // Entity detail pages (priority 0.8) are absent when API fails
        expect(body).not.toContain('/hotel-test');
    });

    it('returns HTTP 503 when env is not configured', async () => {
        vi.mocked(getApiUrl).mockImplementationOnce(() => {
            throw new Error('env not configured');
        });

        vi.stubGlobal('fetch', vi.fn());

        const response = await GET({});
        expect(response.status).toBe(503);
    });

    // SPEC-157 REQ-12: hreflang alternates so Googlebot associates the es/en/pt
    // versions of each entity. The static sitemap already emits these via its
    // serialize() hook; the dynamic one must mirror it.
    describe('hreflang alternates (SPEC-157 REQ-12)', () => {
        function fetchWithOneAccommodation(slug: string) {
            const fetchMock = vi.fn();
            fetchMock.mockImplementationOnce(() => Promise.resolve(makeApiResponse([{ slug }])));
            fetchMock.mockResolvedValue(makeEmptyApiResponse());
            vi.stubGlobal('fetch', fetchMock);
            return GET({});
        }

        it('declares the xhtml namespace on the <urlset>', async () => {
            const body = await (await fetchWithOneAccommodation('casa-rio')).text();
            expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
        });

        it('emits es/en/pt xhtml:link alternates for each URL', async () => {
            const body = await (await fetchWithOneAccommodation('casa-rio')).text();
            expect(body).toContain(
                '<xhtml:link rel="alternate" hreflang="es" href="https://hospeda.test/es/alojamientos/casa-rio/"'
            );
            expect(body).toContain(
                '<xhtml:link rel="alternate" hreflang="en" href="https://hospeda.test/en/alojamientos/casa-rio/"'
            );
            expect(body).toContain(
                '<xhtml:link rel="alternate" hreflang="pt" href="https://hospeda.test/pt/alojamientos/casa-rio/"'
            );
        });

        it('emits an x-default alternate pointing to the Spanish URL', async () => {
            const body = await (await fetchWithOneAccommodation('casa-rio')).text();
            expect(body).toContain(
                '<xhtml:link rel="alternate" hreflang="x-default" href="https://hospeda.test/es/alojamientos/casa-rio/"'
            );
        });
    });
});
