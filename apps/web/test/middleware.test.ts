/**
 * @file middleware.test.ts
 * @description Regression test for the Server Island get-session flood fix.
 *
 * `server:defer` islands are each a SEPARATE browser→server HTTP request,
 * routed by Astro via `/_server-islands/*`. Step 2 of `onRequest` used to
 * call `parseSessionUser()` (which hits `GET /api/auth/get-session`)
 * unconditionally for every such request — and since the mobile menu island
 * was mounted in the global Header on EVERY page, this fired an extra
 * `get-session` call on every single page view site-wide, flooding the
 * API's `auth` rate-limit bucket (50/5min per IP).
 *
 * This test exercises the REAL `onRequest` handler (not just the extracted
 * helper functions already covered by `test/lib/middleware-helpers.test.ts`)
 * to assert the fix at the actual call site: a `/_server-islands/*` request
 * must never trigger `parseSessionUser`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const parseSessionUserMock = vi.fn().mockResolvedValue({
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['USER'],
    image: null,
    mustChangePassword: false
});

// Mock only `parseSessionUser` from middleware-helpers — every other export
// (isServerIslandRoute, isStaticAssetRoute, buildCspHeader, ...) runs for
// real, exactly as `test/lib/middleware-helpers.test.ts` already exercises
// them safely (pure functions; Sentry.startSpan no-ops without a DSN).
vi.mock('../src/lib/middleware-helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/middleware-helpers')>();
    return {
        ...actual,
        parseSessionUser: parseSessionUserMock
    };
});

/** Minimal Astro APIContext double sufficient for the code paths exercised here. */
function createContext({
    pathname,
    cookieHeader = null,
    isPrerendered = false
}: {
    readonly pathname: string;
    readonly cookieHeader?: string | null;
    readonly isPrerendered?: boolean;
}) {
    const locals: Record<string, unknown> = {};
    return {
        url: new URL(`https://hospeda.test${pathname}`),
        locals,
        isPrerendered,
        request: {
            headers: new Headers(cookieHeader ? { cookie: cookieHeader } : {})
        },
        redirect: vi.fn(),
        rewrite: vi.fn(),
        cookies: {
            get: vi.fn()
        }
    };
}

describe('middleware onRequest — Server Island requests never trigger parseSessionUser', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    it('never calls parseSessionUser for a /_server-islands/* request (the get-session flood fix)', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({
            pathname: '/_server-islands/MobileMenuIsland',
            cookieHeader: 'better-auth.session_token=fake-session'
        });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(parseSessionUserMock).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('sets locals.user to null (not undefined) for a Server Island request, satisfying the App.Locals contract', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/_server-islands/NextEventsSection' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.locals.user).toBeNull();
    });

    it('this test would catch a regression: still calls parseSessionUser for a real protected route (Step 6, unaffected by the fix)', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({
            pathname: '/es/mi-cuenta/',
            cookieHeader: 'better-auth.session_token=fake-session'
        });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(parseSessionUserMock).toHaveBeenCalledTimes(1);
    });
});

describe('middleware onRequest — 410 Gone rewrite keeps the 410 status (soft-delete SEO desindex)', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    it('re-wraps a downstream 410 as a 410 rendering the /404 chrome (not a coerced 404)', async () => {
        const { onRequest } = await import('../src/middleware');
        // A real 410 producer (e.g. `alojamientos/[slug].astro` for a soft-deleted
        // entity) returns an empty-body 410. Use a valid, trailing-slashed,
        // session-optional public detail path so Steps 1-7 pass through without an
        // early return before Step 8b.
        const context = createContext({ pathname: '/es/alojamientos/x/' });
        // Mimic Astro's `/404` render: a 200/404 HTML page with chrome. Astro
        // assigns `/404` a 404 status by convention; the middleware must force it
        // back to 410.
        context.rewrite.mockReturnValue(
            new Response('<html>chrome</html>', {
                status: 404,
                headers: { 'content-type': 'text/html' }
            })
        );
        const next = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));

        const result = await onRequest(context as any, next);

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(410);
        expect(context.rewrite).toHaveBeenCalledWith('/404');
        // Body must be the /404 chrome, not empty — a regression that forces the
        // 410 status but drops `rendered.body` would reintroduce the blank-page bug.
        expect(await (result as Response).text()).toBe('<html>chrome</html>');
    });
});

describe('middleware onRequest — BETA-162 legacy /blog alias redirects to /publicaciones/', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    it('301-redirects /es/blog/ to /es/publicaciones/', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/es/blog/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).toHaveBeenCalledWith('/es/publicaciones/', 301);
        expect(next).not.toHaveBeenCalled();
    });

    it('301-redirects a /blog subpath (e.g. /en/blog/some-post/) to the equivalent /publicaciones/ subpath', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/en/blog/some-post/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).toHaveBeenCalledWith('/en/publicaciones/some-post/', 301);
    });

    it('redirects for all three supported locales (es/en/pt)', async () => {
        const { onRequest } = await import('../src/middleware');

        for (const locale of ['es', 'en', 'pt'] as const) {
            const context = createContext({ pathname: `/${locale}/blog/` });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledWith(`/${locale}/publicaciones/`, 301);
        }
    });
});

describe('middleware onRequest — HOS-375 /publicaciones/autor/* redirects to /autores/*', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    /** Run the middleware for one path and return the redirect call's arguments. */
    async function redirectFor(pathname: string): Promise<readonly [string, number]> {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(next).not.toHaveBeenCalled();
        expect(context.redirect).toHaveBeenCalledTimes(1);
        return context.redirect.mock.calls[0] as unknown as readonly [string, number];
    }

    it('redirects a bare author slug', async () => {
        const [target, status] = await redirectFor('/es/publicaciones/autor/carmen-silva/');

        expect(target).toBe('/es/autores/carmen-silva/');
        expect(status).toBe(301);
    });

    it('redirects the bare /publicaciones/autor/ with no slug', async () => {
        // There is no authors index yet (NG-1), so the target 404s — but the old
        // URL 404'd too, and the day an index ships this already points at it.
        const [target, status] = await redirectFor('/es/publicaciones/autor/');

        expect(target).toBe('/es/autores/');
        expect(status).toBe(301);
    });

    it('preserves the /page/<n>/ tail AND the query string together (AC-2)', async () => {
        // The two are captured by different mechanisms — the tail by the regex
        // group, the query by `context.url.search` — so a fix that keeps one can
        // silently drop the other. Assert them in a single URL.
        const [target, status] = await redirectFor(
            '/es/publicaciones/autor/carmen-silva/page/3/?x=1&y=2'
        );

        expect(target).toBe('/es/autores/carmen-silva/page/3/?x=1&y=2');
        expect(status).toBe(301);
    });

    it('carries the events pagination sub-route across as well', async () => {
        // Nothing links to this shape today, but the redirect is a path splice —
        // it must not care which tail it is carrying, or a future inbound link
        // would break.
        const [target] = await redirectFor('/pt/publicaciones/autor/ana/eventos/page/2/');

        expect(target).toBe('/pt/autores/ana/eventos/page/2/');
    });

    it('is a 301 in every supported locale, never a 302', async () => {
        // A 302 would tell Google the move is temporary and withhold the link
        // equity this redirect exists to transfer.
        for (const locale of ['es', 'en', 'pt'] as const) {
            const [target, status] = await redirectFor(
                `/${locale}/publicaciones/autor/laura-vega/`
            );

            expect(target).toBe(`/${locale}/autores/laura-vega/`);
            expect(status).toBe(301);
        }
    });

    it('leaves the rest of the blog alone', async () => {
        // The regex must anchor on the `autor` segment. Matching `/publicaciones/`
        // more loosely would send every post detail page to a non-existent
        // `/autores/<post-slug>/`.
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/es/publicaciones/una-nota-cualquiera/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not hijack a sibling segment that merely starts with "autor"', async () => {
        // `/publicaciones/autores/` (or `/autoral/`) is a different path. The
        // tail group starts with `/`, so only the exact `autor` segment matches.
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/es/publicaciones/autores/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Regression: Step 4 (locale redirect) dropped the query string.
//
// `buildLocaleRedirect({ restOfPath })` took only the path, unlike Steps 3,
// 3.1 and 3.2 which all append `context.url.search`. So every URL without a
// locale segment lost its parameters in the 301: a campaign link to
// `hospeda.com.ar/?utm_source=newsletter` landed on a bare `/es/` and the
// attribution was gone before the first pageview was captured. Nothing looked
// broken — the page rendered fine — which is why it survived in production.
//
// These assert the CALL SITE, not just the helper: the helper accepting a
// `search` argument is useless if Step 4 forgets to pass it, and that omission
// is exactly what the bug was.
// ---------------------------------------------------------------------------
describe('middleware onRequest — Step 4 locale redirect preserves the query string', () => {
    it('carries the query string through the root redirect (campaign attribution)', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({
            pathname: '/?utm_source=newsletter&utm_campaign=verano'
        });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith(
            '/es/?utm_source=newsletter&utm_campaign=verano',
            301
        );
    });

    it('carries the query string through a nested path with an unsupported locale', async () => {
        // `/fr/...` is the unambiguous Step 4 case: a real (unsupported) locale
        // segment, which `extractLocaleFromPath` correctly strips, leaving the
        // rest of the path intact. Deliberately NOT `/alojamientos/?page=2` —
        // see the note below on why that URL behaves differently.
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/fr/alojamientos/?page=2' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/?page=2', 301);
    });

    it('emits no stray "?" when the URL carries no query string', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/', 301);
    });
});

// ---------------------------------------------------------------------------
// Regression: Step 4 ate the first path segment of any locale-less URL.
//
// `extractLocaleFromPath` consumed the first segment whenever it was not a
// supported locale, without asking whether it looked like a locale at all. So
// `/destinos/colon/` — a URL a visitor could plausibly type, or an old link
// could point at — redirected to `/es/colon/`, which is a 404. Verified against
// production before the fix.
//
// The distinguishing signal is SHAPE: `fr` is a language tag, `destinos` is a
// route segment.
// ---------------------------------------------------------------------------
describe('middleware onRequest — Step 4 keeps the path when there is no locale segment', () => {
    it('redirects /destinos/colon/ to /es/destinos/colon/, not /es/colon/', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/destinos/colon/' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/destinos/colon/', 301);
    });

    it('keeps the path AND the query string together', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/alojamientos/?page=2' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/?page=2', 301);
    });

    it('still replaces a real unsupported locale rather than keeping it', async () => {
        // The counter-case that stops the fix from being over-broad: `/fr/...`
        // must NOT become `/es/fr/...`.
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/fr/alojamientos/' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/', 301);
    });
});

describe('middleware onRequest — Step 11 emits the Cache-Tag purge header (HOS-369 W1-1)', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    /**
     * Render a page response through the real `onRequest`, letting the page
     * declare its cache tags the way a real one does — from frontmatter, i.e.
     * while `next()` is running.
     */
    async function runPage({
        pathname,
        cacheControl,
        tags
    }: {
        readonly pathname: string;
        readonly cacheControl?: string;
        readonly tags?: readonly string[];
    }): Promise<Response> {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname });
        const next = vi.fn().mockImplementation(() => {
            for (const tag of tags ?? []) {
                (context.locals as { cacheTags: Set<string> }).cacheTags.add(tag);
            }
            const headers = new Headers({ 'content-type': 'text/html' });
            if (cacheControl) headers.set('Cache-Control', cacheControl);
            return Promise.resolve(new Response('<html>page</html>', { headers }));
        });

        return (await onRequest(context as any, next)) as Response;
    }

    it('opens the collector before next(), so page frontmatter can contribute', async () => {
        const { onRequest } = await import('../src/middleware');
        const context = createContext({ pathname: '/es/alojamientos/' });
        let seen: unknown;
        const next = vi.fn().mockImplementation(() => {
            seen = (context.locals as { cacheTags?: unknown }).cacheTags;
            return Promise.resolve(new Response('ok'));
        });

        await onRequest(context as any, next);

        expect(seen).toBeInstanceOf(Set);
    });

    it('emits the collected tags on a shared-cacheable response', async () => {
        const response = await runPage({
            pathname: '/es/alojamientos/',
            cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
            tags: ['list-accom', 'home']
        });

        expect(response.headers.get('Cache-Tag')).toBe('list-accom,home');
    });

    it('emits NOTHING on a private response — an uncached page has nothing to purge', async () => {
        const response = await runPage({
            pathname: '/es/alojamientos/',
            cacheControl: 'private, no-cache',
            tags: ['list-accom']
        });

        expect(response.headers.get('Cache-Tag')).toBeNull();
    });

    it('emits nothing when the page declared no tags', async () => {
        const response = await runPage({
            pathname: '/es/alojamientos/',
            cacheControl: 'public, s-maxage=300',
            tags: []
        });

        expect(response.headers.get('Cache-Tag')).toBeNull();
    });

    it('survives the CSP branch, which REPLACES the response object', async () => {
        // Step 9 rebuilds `response` to hash the body. A header written before
        // that point would be dropped for every SSR HTML page — which is every
        // cacheable page there is. This asserts the ordering, not the CSP.
        const response = await runPage({
            pathname: '/es/alojamientos/',
            cacheControl: 'public, s-maxage=300',
            tags: ['list-accom']
        });

        expect(response.headers.get('content-security-policy')).toBeTruthy();
        expect(response.headers.get('Cache-Tag')).toBe('list-accom');
    });

    it('drops a tag Cloudflare would reject rather than shipping a malformed header', async () => {
        const response = await runPage({
            pathname: '/es/alojamientos/',
            cacheControl: 'public, s-maxage=300',
            tags: ['list-accom', 'has space']
        });

        expect(response.headers.get('Cache-Tag')).toBe('list-accom');
    });
});
