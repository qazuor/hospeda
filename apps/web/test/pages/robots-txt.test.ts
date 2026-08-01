/**
 * @fileoverview
 * Unit tests for the robots.txt endpoint (src/pages/robots.txt.ts).
 *
 * Strategy: mock `@/lib/env` and `@/lib/middleware-helpers`, then call the
 * GET handler directly with a synthetic Request object.
 *
 * Assertions cover:
 *  - REQ-16: Sitemap directive reflects the injected site URL (never hardcodes
 *    hospeda.com.ar; works correctly on staging/local).
 *  - REQ-17: every path in SITEMAP_EXCLUDED_PATHS has a matching Disallow
 *    directive; the shared constant is the single source of truth for both
 *    sitemap filter and robots.txt.
 *  - Noindex hosts receive a restrictive Disallow:/  policy with X-Robots-Tag header.
 *  - Non-noindex hosts receive the permissive policy.
 *  - Existing Disallow entries unrelated to the sitemap are preserved.
 */

import { describe, expect, it, vi } from 'vitest';
import { FACET_QUERY_PARAM_KEYS } from '../../src/lib/filters/facet-crawl-policy';
import { SITEMAP_EXCLUDED_PATHS } from '../../src/lib/seo-config';

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any dynamic import of the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/env', () => ({
    getSiteUrl: vi.fn(() => 'https://hospeda.test'),
    getNoindexHosts: vi.fn(() => undefined)
}));

vi.mock('@/lib/middleware-helpers', () => ({
    parseNoindexHosts: vi.fn((raw: string | undefined) =>
        raw ? raw.split(',').map((h) => h.trim().toLowerCase()) : ['staging.hospeda.com.ar']
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Request object with the given host header.
 */
function makeRequest(host: string): Request {
    return new Request('http://localhost/robots.txt', {
        headers: { host }
    });
}

/**
 * Fetch the permissive robots.txt body for an indexable host.
 */
async function getPermissiveBody(): Promise<string> {
    const { getSiteUrl } = await import('@/lib/env');
    vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');
    const { GET } = await import('../../src/pages/robots.txt.js');
    const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
    return await response.text();
}

/**
 * Compile one robots.txt path pattern into a regex, per RFC 9309: `*` matches
 * any sequence of characters and `$` (only at the end) anchors the match to the
 * end of the URL path+query. Everything else is literal.
 */
function compileRobotsPattern(pattern: string): RegExp {
    const endAnchored = pattern.endsWith('$');
    const body = endAnchored ? pattern.slice(0, -1) : pattern;
    const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}${endAnchored ? '$' : ''}`);
}

/**
 * Evaluate whether `pathAndQuery` is blocked by the `Disallow` rules of the
 * `User-agent: *` group in `body`.
 *
 * The group's only `Allow` is the bare `Allow: /`, which under RFC 9309's
 * most-specific-rule-wins tie-break is shorter than (and therefore loses to)
 * every `Disallow` pattern emitted here. So "any Disallow matches" is a
 * faithful verdict for this specific robots.txt, and the test does not need a
 * full RFC 9309 engine.
 */
function isDisallowedForAllAgents({
    body,
    pathAndQuery
}: {
    readonly body: string;
    readonly pathAndQuery: string;
}): boolean {
    const starBlock = body.split('\n\n').find((block) => block.startsWith('User-agent: *'));
    if (!starBlock) throw new Error('no `User-agent: *` block found in robots.txt');

    return starBlock
        .split('\n')
        .filter((line) => line.startsWith('Disallow: '))
        .map((line) => line.slice('Disallow: '.length).trim())
        .filter((pattern) => pattern.length > 0)
        .some((pattern) => compileRobotsPattern(pattern).test(pathAndQuery));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('robots.txt — GET handler', () => {
    it('returns status 200', async () => {
        const { GET } = await import('../../src/pages/robots.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.status).toBe(200);
    });

    it('returns Content-Type: text/plain', async () => {
        const { GET } = await import('../../src/pages/robots.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.headers.get('Content-Type')).toContain('text/plain');
    });

    it('returns Cache-Control: public, max-age=3600', async () => {
        const { GET } = await import('../../src/pages/robots.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    // -----------------------------------------------------------------------
    // REQ-16: Sitemap URL derived from getSiteUrl(), never hardcoded
    // -----------------------------------------------------------------------

    describe('REQ-16 — Sitemap URL derived from env', () => {
        it('uses the injected site URL (staging mock)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://staging.hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Sitemap: https://staging.hospeda.test/sitemap-index.xml');
            expect(body).not.toContain('hospeda.com.ar');
        });

        it('uses the injected site URL (production mock)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.com.ar');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Sitemap: https://hospeda.com.ar/sitemap-index.xml');
        });

        it('strips trailing slash from site URL before appending sitemap path', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test/');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            // Must not produce a double-slash like //sitemap-index.xml
            expect(body).toContain('Sitemap: https://hospeda.test/sitemap-index.xml');
            expect(body).not.toContain('//sitemap-index.xml');
        });

        it('points to sitemap-index.xml (correct filename)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('/sitemap-index.xml');
        });
    });

    // -----------------------------------------------------------------------
    // REQ-17: Disallow directives aligned with SITEMAP_EXCLUDED_PATHS
    // -----------------------------------------------------------------------

    describe('REQ-17 — Disallow entries aligned with SITEMAP_EXCLUDED_PATHS', () => {
        it('contains a Disallow directive for every path in SITEMAP_EXCLUDED_PATHS', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            for (const path of SITEMAP_EXCLUDED_PATHS) {
                expect(body).toContain(`Disallow: ${path}`);
            }
        });

        it('contains Disallow: /auth/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /auth/');
        });

        it('contains Disallow: /mi-cuenta/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /mi-cuenta/');
        });

        // The global site-search feature was cut from the product: the
        // `/busqueda/` page and the `GET /api/v1/public/search` endpoint behind it
        // were deleted. There is nothing left to keep out of the index, so the
        // Disallow must be gone too — a Disallow for a non-existent path is noise
        // that outlives the feature it described.
        it('does not contain Disallow: /busqueda/ (global search removed)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).not.toContain('busqueda');
        });

        it('contains Disallow: /feedback/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /feedback/');
        });

        it('SITEMAP_EXCLUDED_PATHS contains exactly the 3 expected paths', () => {
            // This test locks the shared constant content so any accidental
            // drift is caught immediately. `/busqueda/` was dropped when the
            // global site-search feature was cut from the product.
            expect(SITEMAP_EXCLUDED_PATHS).toHaveLength(3);
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/auth/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/mi-cuenta/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/feedback/');
            expect(SITEMAP_EXCLUDED_PATHS).not.toContain('/busqueda/');
        });
    });

    // -----------------------------------------------------------------------
    // Existing Disallow rules (non-sitemap-related) are preserved
    // -----------------------------------------------------------------------

    describe('existing Disallow rules preserved', () => {
        it('contains Disallow: /api/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /api/');
        });

        it('contains Disallow: /*/mi-cuenta/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /*/mi-cuenta/');
        });

        it('contains Disallow: /*/signin', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /*/signin');
        });

        it('contains Disallow: /_server-islands/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /_server-islands/');
        });

        it('contains Allow: /', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Allow: /');
        });
    });

    // -----------------------------------------------------------------------
    // AEO: explicit AI crawler allow blocks
    // -----------------------------------------------------------------------

    describe('AI crawler policy (AEO, HOS-369 WA-4)', () => {
        /**
         * Agents that produce CITATIONS — the visibility Hospeda actually wants.
         * Each is verified against its vendor's own documentation; see the
         * rationale block in `robots.txt.ts`.
         */
        const CITATION_BOTS = [
            'OAI-SearchBot',
            'ChatGPT-User',
            'Claude-User',
            'Claude-SearchBot',
            'PerplexityBot',
            'Google-Extended'
        ];

        /** Training-only crawlers + the list Cloudflare's managed block used to own. */
        const BLOCKED_BOTS = [
            'GPTBot',
            'ClaudeBot',
            'anthropic-ai',
            'CCBot',
            'Applebot-Extended',
            'Amazonbot',
            'Bytespider',
            'meta-externalagent',
            'CloudflareBrowserRenderingCrawler'
        ];

        it('emits an explicit User-agent block for every agent it has an opinion about', async () => {
            const body = await getPermissiveBody();

            for (const bot of [...CITATION_BOTS, ...BLOCKED_BOTS]) {
                expect(body, `missing block for ${bot}`).toContain(`User-agent: ${bot}`);
            }
        });

        it('each citation agent carries Allow: / so it may crawl public pages', async () => {
            const body = await getPermissiveBody();

            for (const bot of CITATION_BOTS) {
                const block = body.slice(body.indexOf(`User-agent: ${bot}`));
                const firstLines = block.split('\n').slice(0, 2).join('\n');
                expect(firstLines, `${bot} is not allowed`).toContain('Allow: /');
            }
        });

        it('each blocked agent carries a bare Disallow: / and nothing else', async () => {
            const body = await getPermissiveBody();
            const blocks = body.split('\n\n');

            for (const bot of BLOCKED_BOTS) {
                const block = blocks.find((b) => b.includes(`User-agent: ${bot}`));
                expect(block, `block for ${bot}`).toBeDefined();
                // A bare `Disallow: /` already covers everything. An `Allow: /`
                // here would defeat the block outright.
                expect(block).toBe(`User-agent: ${bot}\nDisallow: /`);
            }
        });

        it('keeps Applebot itself ALLOWED (D-1: real Siri/Spotlight visibility)', async () => {
            const body = await getPermissiveBody();
            const blocks = body.split('\n\n');

            // `Applebot-Extended` (the training opt-out token) IS blocked, but
            // the fetching crawler must not be caught by a prefix mistake.
            const applebotBlock = blocks.find((b) => b.startsWith('User-agent: Applebot\n'));
            expect(applebotBlock, 'Applebot must have no block of its own').toBeUndefined();
        });

        it('each citation-agent block repeats the same Disallow rules as the * block (no privileged paths leak)', async () => {
            const body = await getPermissiveBody();

            // Split into per-agent blocks (blank line delimited) and verify each
            // citation block contains the privileged-path disallows + every
            // SITEMAP_EXCLUDED_PATHS entry. A named block does NOT inherit the
            // `*` rules in the robots.txt spec, so they must be repeated.
            const blocks = body.split('\n\n');
            const requiredDisallows = [
                'Disallow: /api/',
                'Disallow: /*/mi-cuenta/',
                'Disallow: /*/signin',
                'Disallow: /*/signup',
                'Disallow: /*/forgot-password',
                'Disallow: /_server-islands/',
                ...SITEMAP_EXCLUDED_PATHS.map((p) => `Disallow: ${p}`)
            ];

            for (const bot of CITATION_BOTS) {
                const block = blocks.find((b) => b.includes(`User-agent: ${bot}`));
                expect(block, `block for ${bot}`).toBeDefined();
                for (const line of requiredDisallows) {
                    expect(block, `${bot} block missing "${line}"`).toContain(line);
                }
            }
        });
    });

    // -----------------------------------------------------------------------
    // HOS-369 WA-1 / AC-A2: facet query params are blocked, path-based facet
    // landings stay crawlable. BOTH directions are asserted — the second half is
    // what stops an over-broad `Disallow: /*?*` from silently de-indexing real
    // SEO surface (spec R-8).
    // -----------------------------------------------------------------------

    describe('AC-A2 — facet query params disallowed', () => {
        it('emits a Disallow directive for every facet query param key', async () => {
            const body = await getPermissiveBody();

            for (const key of FACET_QUERY_PARAM_KEYS) {
                expect(body, `missing Disallow for "${key}"`).toContain(`Disallow: /*?*${key}=`);
            }
        });

        it('repeats the facet Disallow rules in every named allow block', async () => {
            // A named `User-agent` block does NOT inherit the `*` rules, so a
            // facet rule present only in `*` would leave every allowed agent free
            // to walk the combinatorial tree. (Blocked agents need no facet rule
            // — their bare `Disallow: /` already covers it.)
            const body = await getPermissiveBody();
            const blocks = body.split('\n\n');

            for (const bot of [
                'OAI-SearchBot',
                'ChatGPT-User',
                'Claude-SearchBot',
                'PerplexityBot'
            ]) {
                const block = blocks.find((b) => b.includes(`User-agent: ${bot}`));
                expect(block, `block for ${bot}`).toBeDefined();
                expect(block, `${bot} missing facet rules`).toContain('Disallow: /*?*categories=');
                expect(block).toContain('Disallow: /*?*types=');
            }
        });

        it.each([
            ['/es/alojamientos/?types=HOTEL', 'accommodation type facet'],
            ['/es/alojamientos/?types=HOTEL%2CCABIN%2CHOSTEL', 'multi-value accumulation'],
            ['/es/eventos/?categories=MUSIC', 'event category facet'],
            ['/pt/destinos/concepcion-del-uruguay/?categories=termas', 'the POI crawl trap'],
            ['/es/destinos/?attractions=a,b', 'destinos attractions facet'],
            ['/es/eventos/?sortBy=date&categories=MUSIC', 'facet key in 2nd position'],
            ['/es/alojamientos/?checkIn=2026-08-01&checkOut=2026-08-05', 'date/occupancy'],
            ['/es/alojamientos/?adults=2&children=1', 'occupancy']
        ])('blocks %s (%s)', async (pathAndQuery) => {
            const body = await getPermissiveBody();
            expect(isDisallowedForAllAgents({ body, pathAndQuery })).toBe(true);
        });
    });

    describe('AC-A2 / R-8 — path-based facet landings stay crawlable', () => {
        it.each([
            ['/es/alojamientos/tipo/hotel/', 'HOS-96 accommodation type landing'],
            ['/es/alojamientos/tipo/cabana/', 'HOS-96 accommodation type landing'],
            ['/es/eventos/categoria/music/', 'SPEC-306 event category landing'],
            ['/es/publicaciones/categoria/guias/', 'post category landing'],
            ['/es/destinos/atraccion/termas/', 'destination attraction landing'],
            ['/es/alojamientos/', 'clean listing'],
            ['/es/alojamientos/page/2/', 'path-based pagination'],
            ['/pt/destinos/concepcion-del-uruguay/', 'destination detail'],
            ['/es/gastronomia/', 'clean commerce listing']
        ])('does not block %s (%s)', async (pathAndQuery) => {
            const body = await getPermissiveBody();
            expect(isDisallowedForAllAgents({ body, pathAndQuery })).toBe(false);
        });

        it('contains no blanket query-string Disallow', async () => {
            const body = await getPermissiveBody();

            expect(body).not.toContain('Disallow: /*?*\n');
            expect(body).not.toContain('Disallow: /*?\n');
            expect(body).not.toMatch(/^Disallow: \/\*\?\*?$/m);
        });
    });

    // -----------------------------------------------------------------------
    // Noindex host behaviour
    // -----------------------------------------------------------------------

    describe('noindex host — restrictive policy', () => {
        it('returns Disallow: / for a noindex host', async () => {
            const { GET } = await import('../../src/pages/robots.txt.js');
            // The mock for parseNoindexHosts defaults to ['staging.hospeda.com.ar']
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /');
        });

        it('sets X-Robots-Tag: noindex, nofollow for a noindex host', async () => {
            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);

            expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        });

        it('does NOT set X-Robots-Tag for an indexable host', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);

            expect(response.headers.get('X-Robots-Tag')).toBeNull();
        });

        it('does NOT include Sitemap directive in noindex policy', async () => {
            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);
            const body = await response.text();

            expect(body).not.toContain('Sitemap:');
        });

        it('does NOT emit per-bot Allow blocks on a noindex host (the * Disallow: / governs every crawler)', async () => {
            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);
            const body = await response.text();

            // The whole body is just the universal block-all rule.
            expect(body).toContain('User-agent: *');
            expect(body).toContain('Disallow: /');
            // No AI-bot-specific Allow blocks may appear here, otherwise they
            // would override the universal block-all and expose staging.
            expect(body).not.toContain('GPTBot');
            expect(body).not.toContain('ClaudeBot');
            expect(body).not.toContain('Allow: /\n');
        });
    });
});
