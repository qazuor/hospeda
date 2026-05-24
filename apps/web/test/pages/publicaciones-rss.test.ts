/**
 * @fileoverview
 * Unit tests for the blog posts RSS feed helpers (src/lib/feeds.ts).
 *
 * Tests the core logic: fetchLatestPosts, buildPostsFeed, and validateLocale.
 * These functions power the GET /[lang]/publicaciones/rss.xml endpoint.
 *
 * Strategy: mock fetch() and @astrojs/rss, then call the lib functions directly.
 * The endpoint itself is a thin wrapper over these helpers — testing the helpers
 * gives full coverage without the Vite/[lang]-path resolution constraint.
 *
 * Asserts that:
 *  - Content-Type is application/xml (or rss+xml).
 *  - Body is valid RSS 2.0 (contains <rss, <channel>).
 *  - Items use locale-prefixed links (/es/publicaciones/{slug}/).
 *  - Unsupported locale returns null from validateLocale.
 *  - Graceful degradation: API failure → empty items array → valid empty feed.
 *  - Cache headers: Cache-Control is public, max-age=86400, stale-while-revalidate=86400.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level mock for @astrojs/rss — must be declared before any import of
// the module under test so Vitest hoists it before module evaluation.
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

function makePostsApiResponse(
    items: Array<{ slug: string; title?: string; publishedAt?: string; summary?: string }>
): Response {
    return new Response(
        JSON.stringify({
            ok: true,
            data: {
                data: items.map((item) => ({
                    id: `id-${item.slug}`,
                    slug: item.slug,
                    title: item.title ?? `Post ${item.slug}`,
                    summary: item.summary ?? `Summary for ${item.slug}`,
                    publishedAt: item.publishedAt ?? '2026-01-15T10:00:00.000Z',
                    category: 'general',
                    readingTimeMinutes: 5,
                    authorName: 'Equipo Hospeda',
                    isFeatured: false,
                    isNews: false
                }))
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('feeds.ts — blog posts RSS helpers', () => {
    let fetchLatestPosts: typeof import('../../src/lib/feeds').fetchLatestPosts;
    let buildPostsFeed: typeof import('../../src/lib/feeds').buildPostsFeed;
    let validateLocale: typeof import('../../src/lib/feeds').validateLocale;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const mod = await import('../../src/lib/feeds');
        fetchLatestPosts = mod.fetchLatestPosts;
        buildPostsFeed = mod.buildPostsFeed;
        validateLocale = mod.validateLocale;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // validateLocale
    // -------------------------------------------------------------------------

    describe('validateLocale', () => {
        it('returns the locale for es', () => {
            expect(validateLocale('es')).toBe('es');
        });

        it('returns the locale for en', () => {
            expect(validateLocale('en')).toBe('en');
        });

        it('returns the locale for pt', () => {
            expect(validateLocale('pt')).toBe('pt');
        });

        it('returns null for unsupported locale', () => {
            expect(validateLocale('fr')).toBeNull();
        });

        it('returns null for undefined', () => {
            expect(validateLocale(undefined)).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(validateLocale('')).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // fetchLatestPosts
    // -------------------------------------------------------------------------

    describe('fetchLatestPosts', () => {
        it('returns post items from successful API response', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(makePostsApiResponse([{ slug: 'turismo-litoral' }]))
            );

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            expect(posts).toHaveLength(1);
            expect(posts[0].slug).toBe('turismo-litoral');
        });

        it('returns empty array when API fetch throws', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            expect(posts).toHaveLength(0);
        });

        it('returns empty array when API response is not ok (HTTP 500)', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(JSON.stringify({ ok: false }), {
                        status: 500
                    })
                )
            );

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            expect(posts).toHaveLength(0);
        });

        it('returns empty array when API ok field is false', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(
                        new Response(
                            JSON.stringify({ ok: false, data: { data: [{ slug: 'hidden' }] } }),
                            { status: 200 }
                        )
                    )
            );

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            expect(posts).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // buildPostsFeed
    // -------------------------------------------------------------------------

    describe('buildPostsFeed', () => {
        it('returns Content-Type application/xml', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: []
            });

            const contentType = response.headers.get('Content-Type') ?? '';
            expect(contentType.toLowerCase()).toMatch(/application\/(xml|rss\+xml)/);
        });

        it('returns Cache-Control: public, max-age=86400, stale-while-revalidate=86400', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: []
            });

            expect(response.headers.get('Cache-Control')).toBe(
                'public, max-age=86400, stale-while-revalidate=86400'
            );
        });

        it('returns status 200 with valid RSS 2.0 structure', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: []
            });

            expect(response.status).toBe(200);
            const body = await response.text();
            expect(body).toContain('<rss');
            expect(body).toContain('<channel>');
        });

        it('emits items with locale-prefixed links (es → /es/publicaciones/{slug}/)', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: [{ slug: 'turismo-litoral', title: 'Turismo Litoral' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/es/publicaciones/turismo-litoral/');
        });

        it('emits items with locale-prefixed links (en → /en/publicaciones/{slug}/)', async () => {
            const response = await buildPostsFeed({
                locale: 'en',
                siteUrl: 'https://hospeda.test',
                posts: [{ slug: 'tourism-litoral', title: 'Tourism Litoral' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/en/publicaciones/tourism-litoral/');
        });

        it('emits items with locale-prefixed links (pt → /pt/publicaciones/{slug}/)', async () => {
            const response = await buildPostsFeed({
                locale: 'pt',
                siteUrl: 'https://hospeda.test',
                posts: [{ slug: 'turismo-litoral-pt', title: 'Turismo Litoral PT' }]
            });

            const body = await response.text();
            expect(body).toContain('https://hospeda.test/pt/publicaciones/turismo-litoral-pt/');
        });

        it('returns valid RSS with empty channel when posts array is empty', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: []
            });

            const body = await response.text();
            expect(body).toContain('<rss');
            expect(body).toContain('<channel>');
            expect(body).not.toContain('<item>');
        });

        it('includes post title and description in items', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: [
                    {
                        slug: 'test-post',
                        title: 'Mi Post de Prueba',
                        summary: 'Resumen del post'
                    }
                ]
            });

            const body = await response.text();
            expect(body).toContain('Mi Post de Prueba');
            expect(body).toContain('Resumen del post');
        });

        it('uses slug as title fallback when title is missing', async () => {
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts: [{ slug: 'my-post-slug' }]
            });

            const body = await response.text();
            expect(body).toContain('my-post-slug');
        });
    });

    // -------------------------------------------------------------------------
    // Integration: fetch → build pipeline
    // -------------------------------------------------------------------------

    describe('fetch → build pipeline', () => {
        it('graceful degradation: API failure → empty posts → valid empty RSS', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts
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
                    makePostsApiResponse([
                        { slug: 'artículo-uno', title: 'Artículo Uno' },
                        { slug: 'artículo-dos', title: 'Artículo Dos' }
                    ])
                )
            );

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts
            });

            const body = await response.text();
            expect(body).toContain('/es/publicaciones/artículo-uno/');
            expect(body).toContain('/es/publicaciones/artículo-dos/');
            expect(body).toContain('Artículo Uno');
            expect(body).toContain('Artículo Dos');
        });

        it('API non-ok HTTP response → empty feed', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 500 }))
            );

            const posts = await fetchLatestPosts({ apiUrl: 'http://api.test' });
            expect(posts).toHaveLength(0);

            const response = await buildPostsFeed({
                locale: 'es',
                siteUrl: 'https://hospeda.test',
                posts
            });

            const body = await response.text();
            expect(body).not.toContain('<item>');
        });
    });
});
