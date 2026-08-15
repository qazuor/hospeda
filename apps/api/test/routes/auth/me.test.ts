/**
 * `/auth/me` — the account flags that ride on the session (H-158).
 *
 * WHY THIS ENDPOINT CARRIES `ownsHostTradeListing` AT ALL. An approved
 * provider is an ordinary account: no role change, no `HOST_TRADE_*`
 * permission (HOS-278 AC-7). So nothing in `actor.roles` or
 * `actor.permissions` can tell the web whether to show the provider entry in
 * the account sidebar, and the layout that renders that sidebar wraps 123
 * pages. Asking a second endpoint from there put a blocking round-trip on
 * every one of them; this payload is already fetched once per protected
 * request, so the answer rides along for free.
 *
 * The tests below pin the two halves that matter: the flag reflects reality,
 * and a guest never pays for it.
 */

import { describe, expect, it, vi } from 'vitest';

const { mockGetOwn } = vi.hoisted(() => ({ mockGetOwn: vi.fn() }));

// PARTIAL mocks, via `importOriginal`. Replacing either barrel wholesale takes
// the suite down at load time — `@repo/db` alone is imported by half the
// middleware graph — and swapping out `@repo/service-core` entirely would also
// swap `ServiceError`, breaking every `instanceof` check downstream.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    HostTradeService: class {
        getOwn = mockGetOwn;
    }
}));

import { handleAuthMe } from '../../../src/routes/auth/me';

/** A `Context` carrying only what the handler reads. */
function ctxWith(actor: Record<string, unknown>) {
    return { get: (key: string) => (key === 'actor' ? actor : undefined) } as never;
}

const AUTHENTICATED = {
    id: '11111111-1111-4111-8111-111111111111',
    permissions: [] as string[],
    roles: ['USER']
};

/** The guest shape `createGuestActor()` produces — `isGuestActor` keys off the id. */
const GUEST = { id: 'guest', permissions: [] as string[], roles: ['GUEST'] };

describe('GET /auth/me — ownsHostTradeListing (H-158)', () => {
    it('reports true when the account owns a listing', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: { id: 'ht-1' } } });

        const result = await handleAuthMe(ctxWith(AUTHENTICATED));

        expect(result.ownsHostTradeListing).toBe(true);
    });

    it('reports false when the account owns none', async () => {
        mockGetOwn.mockResolvedValue({ data: { trade: null } });

        const result = await handleAuthMe(ctxWith(AUTHENTICATED));

        expect(result.ownsHostTradeListing).toBe(false);
    });

    it('does NOT look up a listing for a guest', async () => {
        // The cost guarantee. `/auth/me` is `skipAuth`, so it answers 200 with
        // a guest actor for every anonymous visitor — a lookup here would be
        // paid on anonymous traffic, which is the bulk of it.
        mockGetOwn.mockReset();

        const result = await handleAuthMe(ctxWith(GUEST));

        expect(mockGetOwn).not.toHaveBeenCalled();
        expect(result.ownsHostTradeListing).toBe(false);
    });

    it('degrades to false, and still answers, when the lookup fails', async () => {
        // A missing nav entry is recoverable on the next render. A 500 from
        // `/auth/me` is not: the web middleware treats a failed session parse
        // as anonymous, so it would sign the user out of every account page.
        mockGetOwn.mockRejectedValue(new Error('db down'));

        const result = await handleAuthMe(ctxWith(AUTHENTICATED));

        expect(result.ownsHostTradeListing).toBe(false);
        expect(result.isAuthenticated).toBe(true);
    });
});
