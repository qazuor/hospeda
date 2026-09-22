/**
 * @fileoverview
 * HOS-1381 — regression: an RSS feed must not answer 200 with an empty channel
 * when the API fetch failed.
 *
 * These feeds bypass middleware (`isStaticAssetRoute` short-circuits on the
 * `.xml` extension), so HOS-1154's Step 11a degradation never sees them and the
 * decision has to be made inside the route. Before this fix, every failure mode
 * below produced a 200 carrying `public, max-age=86400, stale-while-revalidate=86400`:
 * an aggregator could not tell "the API is down" from "nothing was published",
 * and the edge pinned that answer for a day.
 *
 * The distinction the suite exists to defend is the pair at the end of each
 * describe: a GENUINELY empty list (`items: []`, HTTP 200, envelope ok) is real
 * content and stays publicly cacheable, while a failed fetch answers 503 and is
 * not cached. A test that only asserted "503 on failure" would stay green if the
 * route started answering 503 for an empty blog too.
 *
 * Exercised through the ROUTE modules, not the helpers: the defect is a
 * composition defect — `fetchLatest*` reporting failure is worthless if the
 * route still hands the result to `build*Feed`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PUBLIC_FEED_CONTROL = 'public, max-age=86400, stale-while-revalidate=86400';

vi.mock('@astrojs/rss', () => ({
    default: vi.fn(
        ({
            title,
            items
        }: {
            title: string;
            items: Array<{ title: string; link: string; pubDate: Date; description: string }>;
        }) => {
            const itemsXml = items
                .map((item) => `<item><title>${item.title}</title><link>${item.link}</link></item>`)
                .join('');
            return Promise.resolve(
                new Response(
                    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${title}</title>${itemsXml}</channel></rss>`,
                    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
                )
            );
        }
    )
}));

vi.mock('../../src/lib/env', () => ({
    getApiUrl: () => 'http://api.test',
    getSiteUrl: () => 'https://hospeda.test'
}));

/** The envelope `createPublicListRoute` actually returns, with `count` items. */
function okEnvelope(slugs: readonly string[]): Response {
    return new Response(
        JSON.stringify({
            ok: true,
            data: {
                pagination: { page: 1, pageSize: 50, total: slugs.length, totalPages: 1 },
                items: slugs.map((slug) => ({ id: `id-${slug}`, slug, title: slug, name: slug }))
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

/** Invoke an Astro `APIRoute` GET the way the adapter does. */
type GetRoute = (ctx: { params: Record<string, string | undefined> }) => Promise<Response>;

async function callFeed({
    route,
    lang = 'es'
}: {
    readonly route: GetRoute;
    readonly lang?: string;
}): Promise<Response> {
    return route({ params: { lang } });
}

interface FeedCase {
    readonly label: string;
    readonly modulePath: string;
}

const FEEDS: readonly FeedCase[] = [
    { label: 'posts', modulePath: '../../src/pages/[lang]/publicaciones/rss.xml' },
    { label: 'events', modulePath: '../../src/pages/[lang]/eventos/rss.xml' }
];

describe('HOS-1381 — RSS feeds must not cache an empty feed produced by an API failure', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const feed of FEEDS) {
        describe(`${feed.label} feed`, () => {
            async function loadGet(): Promise<GetRoute> {
                const mod = (await import(feed.modulePath)) as { GET: GetRoute };
                return mod.GET;
            }

            it('answers 503 — not an empty 200 — when the API connection fails', async () => {
                // Arrange
                vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

                // Act
                const response = await callFeed({ route: await loadGet() });

                // Assert
                expect(response.status).toBe(503);
                expect(await response.text()).not.toContain('<rss');
            });

            it('answers 503 when the API answers a 5xx', async () => {
                vi.stubGlobal(
                    'fetch',
                    vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
                );

                const response = await callFeed({ route: await loadGet() });

                expect(response.status).toBe(503);
            });

            it('answers 503 when the envelope reports failure', async () => {
                vi.stubGlobal(
                    'fetch',
                    vi
                        .fn()
                        .mockResolvedValue(
                            new Response(JSON.stringify({ ok: false }), { status: 200 })
                        )
                );

                const response = await callFeed({ route: await loadGet() });

                expect(response.status).toBe(503);
            });

            it('answers 503 when the payload carries no readable item list', async () => {
                vi.stubGlobal(
                    'fetch',
                    vi
                        .fn()
                        .mockResolvedValue(
                            new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 })
                        )
                );

                const response = await callFeed({ route: await loadGet() });

                expect(response.status).toBe(503);
            });

            it('never offers a failed feed to the shared cache', async () => {
                vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

                const response = await callFeed({ route: await loadGet() });

                const control = response.headers.get('Cache-Control') ?? '';
                expect(control).not.toBe(PUBLIC_FEED_CONTROL);
                expect(control).not.toContain('public');
                expect(control).toContain('private');
            });

            it('tells the aggregator when to come back', async () => {
                vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

                const response = await callFeed({ route: await loadGet() });

                expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
            });

            it('serves a GENUINELY empty list as cacheable content, not as a failure', async () => {
                // This is the other half of the distinction: zero published
                // entries is an answer, not an outage. Collapsing both into 503
                // would break a brand-new locale's feed forever.
                vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okEnvelope([])));

                const response = await callFeed({ route: await loadGet() });

                expect(response.status).toBe(200);
                expect(response.headers.get('Cache-Control')).toBe(PUBLIC_FEED_CONTROL);
                const body = await response.text();
                expect(body).toContain('<rss');
                expect(body).not.toContain('<item>');
            });

            it('still serves a populated feed as cacheable content', async () => {
                vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okEnvelope(['uno', 'dos'])));

                const response = await callFeed({ route: await loadGet() });

                expect(response.status).toBe(200);
                expect(response.headers.get('Cache-Control')).toBe(PUBLIC_FEED_CONTROL);
                expect((await response.text()).split('<item>').length - 1).toBe(2);
            });

            it('rejects an unsupported locale before touching the API', async () => {
                const fetchSpy = vi.fn().mockResolvedValue(okEnvelope(['uno']));
                vi.stubGlobal('fetch', fetchSpy);

                const response = await callFeed({ route: await loadGet(), lang: 'fr' });

                expect(response.status).toBe(404);
                expect(fetchSpy).not.toHaveBeenCalled();
            });
        });
    }
});
