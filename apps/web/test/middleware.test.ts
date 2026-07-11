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
    role: 'USER',
    image: null
});

// Mock only `parseSessionUser` from middleware-helpers — every other export
// (isServerIslandRoute, isStaticAssetRoute, generateCspNonce, ...) runs for
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
