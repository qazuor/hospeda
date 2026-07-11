/**
 * Tests for the API robots.txt route and the legacy RSS-path redirect
 * (HOS-109 T-011).
 *
 * Crawlers probe the API domain for `/robots.txt` (was 404) and guess a
 * feed-like `/api/v1/public/posts/slug/rss.xml` (was 400, matched as an invalid
 * post slug). The API now serves a Disallow-all robots.txt and 301-redirects the
 * RSS probe to the canonical blog feed on the web app.
 *
 * Exercised through the real app (`initApp`) so the global middleware stack —
 * including the Accept-header validation that would otherwise 400 a text/plain
 * response — is covered.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

describe('robots.txt + RSS redirect (HOS-109 T-011)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    describe('GET /robots.txt', () => {
        it('returns 200 text/plain with a Disallow-all body', async () => {
            const app = initApp();

            const res = await app.request('/robots.txt', {
                headers: { 'user-agent': 'test-crawler' }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/plain');

            const body = await res.text();
            expect(body).toContain('User-agent: *');
            expect(body).toContain('Disallow: /');
        });

        it('serves robots.txt even with a text/plain Accept header (skips validation)', async () => {
            const app = initApp();

            const res = await app.request('/robots.txt', {
                headers: { 'user-agent': 'test-crawler', accept: 'text/plain' }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/v1/public/posts/slug/rss.xml', () => {
        it('301-redirects to the web blog RSS feed instead of 400', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/posts/slug/rss.xml', {
                headers: { 'user-agent': 'test-crawler' }
            });

            expect(res.status).toBe(301);
            // HOSPEDA_SITE_URL is http://localhost:4321 in the test env (setup.ts).
            expect(res.headers.get('location')).toBe(
                'http://localhost:4321/es/publicaciones/rss.xml'
            );
        });

        it('redirects even with a strict application/rss+xml Accept header', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/posts/slug/rss.xml', {
                headers: { 'user-agent': 'test-crawler', accept: 'application/rss+xml' }
            });

            expect(res.status).toBe(301);
        });

        it('does NOT swallow other slugs — only the exact rss.xml path redirects', async () => {
            const app = initApp();

            // A different dotted slug must still fall through to getBySlug (which
            // rejects it as an invalid slug → 400), never the RSS redirect. This
            // locks in the registration-order guarantee the redirect depends on.
            const res = await app.request('/api/v1/public/posts/slug/rss.xmlfoo', {
                headers: { 'user-agent': 'test-crawler' }
            });

            expect(res.status).not.toBe(301);
            expect(res.headers.get('location')).toBeNull();
        });
    });
});
