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
