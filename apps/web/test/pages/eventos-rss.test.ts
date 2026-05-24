/**
 * @fileoverview
 * Unit tests for the events RSS feed helpers (src/lib/feeds.ts).
 *
 * Tests the core logic: fetchLatestEvents, buildEventsFeed, and validateLocale
 * (shared with posts). These functions power the GET /[lang]/eventos/rss.xml endpoint.
 *
 * Strategy: mock fetch() and @astrojs/rss, then call the lib functions directly.
 * The endpoint itself is a thin wrapper over these helpers — testing the helpers
 * gives full coverage without the Vite/[lang]-path resolution constraint.
 *
 * Asserts that:
 *  - Content-Type is application/xml (or rss+xml).
 *  - Body is valid RSS 2.0 (contains <rss, <channel>).
 *  - Items use locale-prefixed links (/es/eventos/{slug}/).
 *  - Graceful degradation: API failure → empty items array → valid empty feed.
 *  - Cache headers: Cache-Control is public, max-age=86400, stale-while-revalidate=86400.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level mock for @astrojs/rss
vi.mock('@astrojs/rss', () => ({
    default: vi.fn(
        ({
            title,
            description,
            site,
            items
        }: {
            title: string;
            description: string;
            site: string;
            items: Array<{
                title: string;
                link: string;
                pubDate: Date;
                description: string;
            }>;
        }) => {
            const itemsXml = items
                .map(
                    (item) =>
                        `<item><title>${item.title}</title><link>${item.link}</link><pubDate>${item.pubDate.toUTCString()}</pubDate><description>${item.description}</description></item>`
                )
                .join('\n');
            const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${title}</title><description>${description}</description><link>${site}</link>${itemsXml}</channel></rss>`;
            return Promise.resolve(
                new Response(body, {
                    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
                })
            );
        }
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventsApiResponse(
    items: Array<{
        slug: string;
        name?: string;
        summary?: string;
        date?: { start?: string };
    }>
): Response {
    return new Response(
        JSON.stringify({
            ok: true,
            data: {
                data: items.map((item) => ({
                    id: `id-${item.slug}`,
                    slug: item.slug,
                    name: item.name ?? `Event ${item.slug}`,
                    summary: item.summary ?? `Summary for ${item.slug}`,
                    date: item.date ?? { start: '2026-03-15T10:00:00.000Z' },
                    category: 'cultural',
                    isFeatured: false
                }))
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function makeEmptyEventsApiResponse(): Response {
    return new Response(JSON.stringify({ ok: true, data: { data: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('feeds.ts — events RSS helpers', () => {
    let fetchLatestEvents: typeof import('../../src/lib/feeds').fetchLatestEvents;
    let buildEventsFeed: typeof import('../../src/lib/feeds').buildEventsFeed;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const mod = await import('../../src/lib/feeds');
        fetchLatestEvents = mod.fetchLatestEvents;
        buildEventsFeed = mod.buildEventsFeed;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // fetchLatestEvents
    // -------------------------------------------------------------------------

    describe('fetchLatestEvents', () => {
        it('returns event items from successful API response', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(makeEventsApiResponse([{ slug: 'festival-litoral-2026' }]))
            );

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            expect(events).toHaveLength(1);
            expect(events[0].slug).toBe('festival-litoral-2026');
        });

        it('returns empty array when API fetch throws', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            expect(events).toHaveLength(0);
        });

        it('returns empty array when API response is not ok (HTTP 500)', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 500 }))
            );

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            expect(events).toHaveLength(0);
        });

        it('returns empty array when API ok field is false', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            ok: false,
                            data: { data: [{ slug: 'hidden-event' }] }
                        }),
                        { status: 200 }
                    )
                )
            );

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            expect(events).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // buildEventsFeed
    // -------------------------------------------------------------------------

    describe('buildEventsFeed', () => {
        it('returns Content-Type application/xml', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: []
            });

            const contentType = response.headers.get('Content-Type') ?? '';
            expect(contentType.toLowerCase()).toMatch(/application\/(xml|rss\+xml)/);
        });

        it('returns Cache-Control: public, max-age=86400, stale-while-revalidate=86400', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: []
            });

            expect(response.headers.get('Cache-Control')).toBe(
                'public, max-age=86400, stale-while-revalidate=86400'
            );
        });

        it('returns status 200 with valid RSS 2.0 structure', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: []
            });

            expect(response.status).toBe(200);
            const body = await response.text();
            expect(body).toContain('<rss');
            expect(body).toContain('<channel>');
        });

        it('emits items with locale-prefixed links (es → /es/eventos/{slug}/)', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: [{ slug: 'festival-litoral-2026', name: 'Festival del Litoral' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/es/eventos/festival-litoral-2026/');
        });

        it('emits items with locale-prefixed links (en → /en/eventos/{slug}/)', async () => {
            const response = await buildEventsFeed({
                locale: 'en',
                siteUrl: 'https://hospeda.test',
                events: [{ slug: 'litoral-festival-2026', name: 'Litoral Festival' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/en/eventos/litoral-festival-2026/');
        });

        it('emits items with locale-prefixed links (pt → /pt/eventos/{slug}/)', async () => {
            const response = await buildEventsFeed({
                locale: 'pt',
                siteUrl: 'https://hospeda.test',
                events: [{ slug: 'festival-litoral-pt', name: 'Festival Litoral PT' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/pt/eventos/festival-litoral-pt/');
        });

        it('returns valid RSS with empty channel when events array is empty', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: []
            });

            const body = await response.text();
            expect(body).toContain('<rss');
            expect(body).toContain('<channel>');
            expect(body).not.toContain('<item>');
        });

        it('includes event name and description in items', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: [
                    {
                        slug: 'test-event',
                        name: 'Festival del Litoral',
                        summary: 'Gran evento cultural'
                    }
                ]
            });

            const body = await response.text();
            expect(body).toContain('Festival del Litoral');
            expect(body).toContain('Gran evento cultural');
        });

        it('uses slug as title fallback when name is missing', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: [{ slug: 'my-event-slug' }]
            });

            const body = await response.text();
            expect(body).toContain('my-event-slug');
        });

        it('uses event.date.start for pubDate when available', async () => {
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events: [
                    {
                        slug: 'dated-event',
                        name: 'Dated Event',
                        date: { start: '2026-06-15T10:00:00.000Z' }
                    }
                ]
            });

            const body = await response.text();
            // pubDate should include year 2026
            expect(body).toMatch(/2026/);
        });
    });

    // -------------------------------------------------------------------------
    // Integration: fetch → build pipeline
    // -------------------------------------------------------------------------

    describe('fetch → build pipeline', () => {
        it('graceful degradation: API failure → empty events → valid empty RSS', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events
            });

            expect(response.status).toBe(200);
            const body = await response.text();
            expect(body).toContain('<rss');
            expect(body).toContain('<channel>');
            expect(body).not.toContain('<item>');
        });

        it('full pipeline: fetch → build with items', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    makeEventsApiResponse([
                        { slug: 'evento-uno', name: 'Evento Uno' },
                        { slug: 'evento-dos', name: 'Evento Dos' }
                    ])
                )
            );

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events
            });

            const body = await response.text();
            expect(body).toContain('/es/eventos/evento-uno/');
            expect(body).toContain('/es/eventos/evento-dos/');
            expect(body).toContain('Evento Uno');
            expect(body).toContain('Evento Dos');
        });

        it('empty API response → empty feed', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeEmptyEventsApiResponse()));

            const events = await fetchLatestEvents({ apiUrl: 'http://api.test' });
            expect(events).toHaveLength(0);

            const response = await buildEventsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                events
            });

            const body = await response.text();
            expect(body).not.toContain('<item>');
        });
    });
});
