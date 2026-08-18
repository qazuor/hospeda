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

// Built via vi.hoisted because vi.mock's factory is hoisted above any
// top-level declaration it would otherwise close over. A plain `const` here
// works only while `../src/middleware` is imported lazily (inside a test), and
// this file imports it statically — see the import below.
const { parseSessionUserMock } = vi.hoisted(() => ({
    parseSessionUserMock: vi.fn().mockResolvedValue({
        id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        roles: ['USER'],
        image: null,
        mustChangePassword: false
    })
}));

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

import {
    ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS,
    EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS,
    POST_CATEGORY_LEGACY_ENGLISH_SLUGS
} from '../src/lib/facet-slugs';

// Imported statically, NOT via `await import(...)` inside each test.
//
// `src/middleware` pulls a large module graph (env, i18n, media, cache-tags,
// the icon sprite, Sentry). Loading it inside a test body charges that graph's
// one-time transform+import cost to that test's own 15s timeout, and only to
// the FIRST test — every later one finds the module cached. On CI that first
// test sat right at the cliff: on the shard that carries this file, apps/web
// alone spends ~410s of import time across 117 files, and the test timed out
// there twice in a row while passing locally in milliseconds and passing on
// other runs of the identical file set. A static import pays the same cost
// once, during collection, where it is not measured against a test timeout.
import { onRequest } from '../src/middleware';

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
        // Real Astro's `context.redirect()` always returns a genuine `Response`
        // (Location header + status). Defaulting the mock to return one too
        // (rather than `undefined`) matches production and is required since
        // H-170: `onRequest` now always reads `.headers` off whatever
        // `runMiddlewarePipeline` returns, including redirects.
        redirect: vi.fn(
            (url: string, status = 302) =>
                new Response(null, { status, headers: { location: url } })
        ),
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
        const context = createContext({ pathname: '/_server-islands/NextEventsSection' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.locals.user).toBeNull();
    });

    it('this test would catch a regression: still calls parseSessionUser for a real protected route (Step 6, unaffected by the fix)', async () => {
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
        const context = createContext({ pathname: '/es/blog/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).toHaveBeenCalledWith('/es/publicaciones/', 301);
        expect(next).not.toHaveBeenCalled();
    });

    it('301-redirects a /blog subpath (e.g. /en/blog/some-post/) to the equivalent /publicaciones/ subpath', async () => {
        const context = createContext({ pathname: '/en/blog/some-post/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).toHaveBeenCalledWith('/en/publicaciones/some-post/', 301);
    });

    it('redirects for all three supported locales (es/en/pt)', async () => {
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
        const context = createContext({ pathname: '/es/publicaciones/una-nota-cualquiera/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not hijack a sibling segment that merely starts with "autor"', async () => {
        // `/publicaciones/autores/` (or `/autoral/`) is a different path. The
        // tail group starts with `/`, so only the exact `autor` segment matches.
        const context = createContext({ pathname: '/es/publicaciones/autores/' });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(context.redirect).not.toHaveBeenCalled();
    });
});

describe('middleware onRequest — H-110 legacy English facet-landing slugs redirect to Spanish', () => {
    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    /** Run the middleware for one path and return the redirect call's arguments. */
    async function redirectFor(pathname: string): Promise<readonly [string, number]> {
        const context = createContext({ pathname });
        const next = vi.fn().mockResolvedValue(new Response('ok'));

        await onRequest(context as any, next);

        expect(next).not.toHaveBeenCalled();
        expect(context.redirect).toHaveBeenCalledTimes(1);
        return context.redirect.mock.calls[0] as unknown as readonly [string, number];
    }

    describe('accommodation type (/alojamientos/tipo/)', () => {
        it.each(
            Object.entries(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS)
        )('301-redirects every legacy English slug %s -> %s', async (englishSlug, spanishSlug) => {
            const [target, status] = await redirectFor(`/es/alojamientos/tipo/${englishSlug}/`);
            expect(target).toBe(`/es/alojamientos/tipo/${spanishSlug}/`);
            expect(status).toBe(301);
        });

        it('redirects in every supported locale (the path segment itself never changes by locale)', async () => {
            for (const locale of ['es', 'en', 'pt'] as const) {
                const [target, status] = await redirectFor(`/${locale}/alojamientos/tipo/cabin/`);
                expect(target).toBe(`/${locale}/alojamientos/tipo/cabana/`);
                expect(status).toBe(301);
            }
        });

        it('preserves the /page/<n>/ tail AND the query string together', async () => {
            const [target, status] = await redirectFor(
                '/es/alojamientos/tipo/country-house/page/2/?sortBy=priceAsc'
            );
            expect(target).toBe('/es/alojamientos/tipo/casa-de-campo/page/2/?sortBy=priceAsc');
            expect(status).toBe(301);
        });

        it('does NOT redirect a slug identical in English and Spanish (loop safety — all 7: hotel, hostel, camping, motel, apart-hotel, estancia, bed-and-breakfast)', async () => {
            for (const identicalSlug of [
                'hotel',
                'hostel',
                'camping',
                'motel',
                'apart-hotel',
                'estancia',
                'bed-and-breakfast'
            ]) {
                const context = createContext({
                    pathname: `/es/alojamientos/tipo/${identicalSlug}/`
                });
                const next = vi.fn().mockResolvedValue(new Response('ok'));

                await onRequest(context as any, next);

                expect(context.redirect).not.toHaveBeenCalled();
            }
        });

        it('does NOT redirect an already-canonical Spanish slug (loop safety, e.g. cabana)', async () => {
            const context = createContext({ pathname: '/es/alojamientos/tipo/cabana/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('does NOT redirect an unknown/garbage slug — leaves it for the landing page 404', async () => {
            const context = createContext({ pathname: '/es/alojamientos/tipo/not-a-real-type/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('event category (/eventos/categoria/)', () => {
        it.each(
            Object.entries(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS)
        )('301-redirects every legacy English slug %s -> %s', async (englishSlug, spanishSlug) => {
            const [target, status] = await redirectFor(`/es/eventos/categoria/${englishSlug}/`);
            expect(target).toBe(`/es/eventos/categoria/${spanishSlug}/`);
            expect(status).toBe(301);
        });

        it('preserves the /page/<n>/ tail AND the query string together', async () => {
            const [target, status] = await redirectFor(
                '/en/eventos/categoria/gastronomy/page/3/?when=weekend'
            );
            expect(target).toBe('/en/eventos/categoria/gastronomia/page/3/?when=weekend');
            expect(status).toBe(301);
        });

        it('does NOT redirect a slug identical in English and Spanish (loop safety, e.g. festival)', async () => {
            const context = createContext({ pathname: '/es/eventos/categoria/festival/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('does NOT redirect an already-canonical Spanish slug (loop safety, e.g. gastronomia)', async () => {
            const context = createContext({ pathname: '/es/eventos/categoria/gastronomia/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('does NOT redirect an unknown/garbage slug — leaves it for the landing page 404', async () => {
            const context = createContext({
                pathname: '/es/eventos/categoria/not-a-real-category/'
            });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('post category (/publicaciones/categoria/)', () => {
        it.each(
            Object.entries(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)
        )('301-redirects every legacy English slug %s -> %s', async (englishSlug, spanishSlug) => {
            const [target, status] = await redirectFor(
                `/es/publicaciones/categoria/${englishSlug}/`
            );
            expect(target).toBe(`/es/publicaciones/categoria/${spanishSlug}/`);
            expect(status).toBe(301);
        });

        it('preserves the /page/<n>/ tail AND the query string together', async () => {
            const [target, status] = await redirectFor(
                '/pt/publicaciones/categoria/nightlife/page/2/?sortBy=newest'
            );
            expect(target).toBe('/pt/publicaciones/categoria/noche/page/2/?sortBy=newest');
            expect(status).toBe(301);
        });

        it('does NOT redirect a slug identical in English and Spanish (loop safety, e.g. general/rural)', async () => {
            for (const identicalSlug of ['general', 'rural']) {
                const context = createContext({
                    pathname: `/es/publicaciones/categoria/${identicalSlug}/`
                });
                const next = vi.fn().mockResolvedValue(new Response('ok'));

                await onRequest(context as any, next);

                expect(context.redirect).not.toHaveBeenCalled();
            }
        });

        it('does NOT redirect an already-canonical Spanish slug (loop safety, e.g. gastronomia)', async () => {
            const context = createContext({ pathname: '/es/publicaciones/categoria/gastronomia/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });

        it('does NOT redirect an unknown/garbage slug — leaves it for the landing page 404', async () => {
            const context = createContext({
                pathname: '/es/publicaciones/categoria/not-a-real-category/'
            });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('the /blog alias composes with the post-category legacy-slug redirect into ONE 301 (SEO — no chained hops)', () => {
        it('resolves /blog/categoria/<english>/ directly to /publicaciones/categoria/<spanish>/ in a SINGLE redirect call', async () => {
            const context = createContext({ pathname: '/es/blog/categoria/gastronomy/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            // The whole point: exactly ONE call to context.redirect, straight
            // to the final destination — never an intermediate
            // `/publicaciones/categoria/gastronomy/` hop.
            expect(next).not.toHaveBeenCalled();
            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith(
                '/es/publicaciones/categoria/gastronomia/',
                301
            );
        });

        it('carries the query string through the single composed redirect', async () => {
            const context = createContext({ pathname: '/en/blog/categoria/nightlife/?x=1' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith(
                '/en/publicaciones/categoria/noche/?x=1',
                301
            );
        });

        it('leaves an ordinary /blog post-detail link as a plain single-hop rewrite (composition never fires for non-category paths)', async () => {
            const context = createContext({ pathname: '/es/blog/una-nota-cualquiera/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith(
                '/es/publicaciones/una-nota-cualquiera/',
                301
            );
        });

        it('leaves a /blog/categoria/<already-Spanish> link alone at the composition step too (no self-redirect)', async () => {
            const context = createContext({ pathname: '/es/blog/categoria/gastronomia/' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith(
                '/es/publicaciones/categoria/gastronomia/',
                301
            );
        });
    });

    describe('a legacy link missing its trailing slash ALSO resolves in ONE hop (H-110 — Step 3 composes too)', () => {
        it('resolves /alojamientos/tipo/cabin (no trailing slash) directly to the canonical Spanish landing in a single redirect', async () => {
            const context = createContext({ pathname: '/es/alojamientos/tipo/cabin' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/tipo/cabana/', 301);
        });

        it('resolves /blog/categoria/gastronomy (no trailing slash, chained AND slash-missing) in a single redirect', async () => {
            const context = createContext({ pathname: '/es/blog/categoria/gastronomy' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith(
                '/es/publicaciones/categoria/gastronomia/',
                301
            );
        });

        it('resolves /mi-cuenta/messages (no trailing slash) to the 308 consultas alias in a single redirect, preserving the 308 status', async () => {
            const context = createContext({ pathname: '/es/mi-cuenta/messages' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith('/es/mi-cuenta/consultas/', 308);
        });

        it('still adds a plain trailing slash (no alias match) for an ordinary route missing one', async () => {
            const context = createContext({ pathname: '/es/alojamientos' });
            const next = vi.fn().mockResolvedValue(new Response('ok'));

            await onRequest(context as any, next);

            expect(context.redirect).toHaveBeenCalledTimes(1);
            expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/', 301);
        });
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
        const context = createContext({ pathname: '/fr/alojamientos/?page=2' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/?page=2', 301);
    });

    it('emits no stray "?" when the URL carries no query string', async () => {
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
        const context = createContext({ pathname: '/destinos/colon/' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/destinos/colon/', 301);
    });

    it('keeps the path AND the query string together', async () => {
        const context = createContext({ pathname: '/alojamientos/?page=2' });

        await onRequest(context as any, vi.fn());

        expect(context.redirect).toHaveBeenCalledWith('/es/alojamientos/?page=2', 301);
    });

    it('still replaces a real unsupported locale rather than keeping it', async () => {
        // The counter-case that stops the fix from being over-broad: `/fr/...`
        // must NOT become `/es/fr/...`.
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

// ---------------------------------------------------------------------------
// H-170 (August 2026 smoke) — baseline security headers on EVERY response.
//
// hospeda.com.ar was missing strict-transport-security, x-content-type-options
// and referrer-policy in production. apps/api already emits all three via
// `apps/api/src/middlewares/security.ts`; this closes the gap on apps/web by
// wrapping the ENTIRE middleware pipeline (`runMiddlewarePipeline`) so every
// exit path — SSR HTML, a static-asset early return, a redirect, a 404/410
// rewrite — carries them, not just the CSP branch's HTML-only path.
// ---------------------------------------------------------------------------
describe('middleware onRequest — H-170 baseline security headers on every response', () => {
    /** The exact values apps/api's security middleware defaults to (mirrored here, not env-driven). */
    const EXPECTED_HEADERS = {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
    } as const;

    function expectSecurityHeaders(response: Response) {
        for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
            expect(response.headers.get(name)).toBe(value);
        }
    }

    beforeEach(() => {
        parseSessionUserMock.mockClear();
    });

    it('carries all three headers on a normal SSR HTML page response', async () => {
        const context = createContext({ pathname: '/es/alojamientos/' });
        const next = vi
            .fn()
            .mockResolvedValue(
                new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
            );

        const result = (await onRequest(context as any, next)) as Response;

        expectSecurityHeaders(result);
    });

    it('carries all three headers on a static-asset early return (Step 1) — nosniff matters most here', async () => {
        // isStaticAssetRoute matches on extension; the middleware returns
        // next()'s response directly with no further processing.
        const context = createContext({ pathname: '/favicon.ico' });
        const next = vi.fn().mockResolvedValue(new Response('binary-data'));

        const result = (await onRequest(context as any, next)) as Response;

        expectSecurityHeaders(result);
    });

    it('carries all three headers on the /_image endpoint early return (Step 1)', async () => {
        const context = createContext({ pathname: '/_image' });
        const next = vi.fn().mockResolvedValue(new Response('image-bytes', { status: 200 }));

        const result = (await onRequest(context as any, next)) as Response;

        expectSecurityHeaders(result);
    });

    it('carries all three headers on a Server Island response (Step 2)', async () => {
        const context = createContext({ pathname: '/_server-islands/MobileMenuIsland' });
        const next = vi.fn().mockResolvedValue(new Response('island-html'));

        const result = (await onRequest(context as any, next)) as Response;

        expectSecurityHeaders(result);
    });

    it('carries all three headers on a redirect Response (Step 3.2 legacy /blog alias)', async () => {
        // createContext's default `redirect` mock already returns a real
        // Response (matching Astro), so no override is needed here.
        const context = createContext({ pathname: '/es/blog/' });

        const result = (await onRequest(context as any, vi.fn())) as Response;

        expect(result.status).toBe(301);
        expectSecurityHeaders(result);
    });

    it('carries all three headers on a 404 rewrite (Step 8)', async () => {
        const context = createContext({ pathname: '/es/no-existe/' });
        context.rewrite = vi
            .fn()
            .mockResolvedValue(
                new Response('<html>404</html>', { headers: { 'content-type': 'text/html' } })
            );
        const next = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

        const result = (await onRequest(context as any, next)) as Response;

        expectSecurityHeaders(result);
    });

    it('carries all three headers on a 410 Gone rewrite (Step 8b)', async () => {
        const context = createContext({ pathname: '/es/alojamientos/x/' });
        context.rewrite = vi.fn().mockResolvedValue(
            new Response('<html>chrome</html>', {
                status: 404,
                headers: { 'content-type': 'text/html' }
            })
        );
        const next = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));

        const result = (await onRequest(context as any, next)) as Response;

        expect(result.status).toBe(410);
        expectSecurityHeaders(result);
    });

    it('does not overwrite the CSP header the HTML branch already sets — both coexist', async () => {
        const context = createContext({ pathname: '/es/alojamientos/' });
        const next = vi
            .fn()
            .mockResolvedValue(
                new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
            );

        const result = (await onRequest(context as any, next)) as Response;

        expect(result.headers.get('content-security-policy')).toBeTruthy();
        expectSecurityHeaders(result);
    });
});
