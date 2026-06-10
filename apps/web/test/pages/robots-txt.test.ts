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

        it('contains Disallow: /busqueda/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /busqueda/');
        });

        it('contains Disallow: /feedback/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /feedback/');
        });

        it('contains Disallow: /beta/', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('Disallow: /beta/');
        });

        it('SITEMAP_EXCLUDED_PATHS contains exactly the 5 expected paths', () => {
            // This test locks the shared constant content so any accidental
            // drift is caught immediately.
            expect(SITEMAP_EXCLUDED_PATHS).toHaveLength(5);
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/auth/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/mi-cuenta/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/busqueda/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/feedback/');
            expect(SITEMAP_EXCLUDED_PATHS).toContain('/beta/');
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

    describe('AI crawler blocks (AEO)', () => {
        const AI_BOTS = [
            'GPTBot',
            'OAI-SearchBot',
            'ChatGPT-User',
            'ClaudeBot',
            'anthropic-ai',
            'PerplexityBot',
            'Google-Extended',
            'CCBot'
        ];

        it('emits an explicit User-agent block for every AI crawler', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            for (const bot of AI_BOTS) {
                expect(body).toContain(`User-agent: ${bot}`);
            }
        });

        it('each AI crawler block carries Allow: / so they may crawl public pages', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            // Each AI bot block must be immediately followed by an Allow: / line.
            for (const bot of AI_BOTS) {
                const block = body.slice(body.indexOf(`User-agent: ${bot}`));
                const firstLines = block.split('\n').slice(0, 2).join('\n');
                expect(firstLines).toContain('Allow: /');
            }
        });

        it('each AI crawler block repeats the same Disallow rules as the * block (no privileged paths leak)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/robots.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            // Split into per-agent blocks (blank line delimited) and verify each
            // AI-bot block contains the privileged-path disallows + every
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

            for (const bot of AI_BOTS) {
                const block = blocks.find((b) => b.includes(`User-agent: ${bot}`));
                expect(block, `block for ${bot}`).toBeDefined();
                for (const line of requiredDisallows) {
                    expect(block, `${bot} block missing "${line}"`).toContain(line);
                }
            }
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
