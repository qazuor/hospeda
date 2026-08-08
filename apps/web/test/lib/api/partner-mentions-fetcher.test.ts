/**
 * `partnersApi.mineMentions` — the partner-facing mentions fetcher (HOS-377 T-026).
 *
 * Two things are worth pinning:
 *
 * 1. **It goes through `getProtected`, not `get`.** The route is auth-gated by
 *    ownership of the caller's session, so a non-credentialed request carries
 *    no cookie and comes back as somebody else's empty log — which looks
 *    exactly like "nothing was ever promoted for you", the single most
 *    damaging thing this page can wrongly say to a partner who is paying.
 * 2. **Not-a-partner is an EMPTY result, not an error.** The server answers
 *    `{ batches: [] }` rather than 403/404, and the page must be able to
 *    consume that without a special case.
 *
 * @module test/lib/api/partner-mentions-fetcher
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProtected = vi.fn();
const get = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        getProtected: (args: unknown) => getProtected(args),
        // Non-credentialed variant, exposed so the test can assert the fetcher
        // never routes through it.
        get: (args: unknown) => get(args),
        patch: vi.fn(),
        post: vi.fn(),
        postProtected: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

import { partnersApi } from '../../../src/lib/api/endpoints-protected';

beforeEach(() => {
    getProtected.mockReset();
    get.mockReset();
    getProtected.mockResolvedValue({ ok: true, data: { batches: [] } });
});

describe('partnersApi.mineMentions', () => {
    it('hits the protected mine/mentions route', async () => {
        await partnersApi.mineMentions();

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/partners/mine/mentions',
            cookieHeader: undefined
        });
    });

    it('forwards the SSR cookie header', async () => {
        await partnersApi.mineMentions({ cookieHeader: 'session=abc' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/partners/mine/mentions',
            cookieHeader: 'session=abc'
        });
    });

    it('uses the credentialed getProtected, never the plain get', async () => {
        await partnersApi.mineMentions({ cookieHeader: 'session=abc' });

        expect(get).not.toHaveBeenCalled();
    });

    it('carries no partner id — ownership is resolved from the session', async () => {
        // There is nothing to address but your own log, which is what makes
        // "a partner cannot read another's" structural rather than a check.
        await partnersApi.mineMentions();

        const call = getProtected.mock.calls[0]?.[0] as { path: string };
        expect(call.path).not.toMatch(/\/partners\/[0-9a-f-]{8}/i);
    });
});

describe('partnersApi.mineMentions — not-a-partner is empty, not an error', () => {
    it('returns an ok result with an empty batch list', async () => {
        getProtected.mockResolvedValue({ ok: true, data: { batches: [] } });

        const result = await partnersApi.mineMentions();

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.batches).toEqual([]);
        }
    });

    it('surfaces a genuine transport failure as a failed result', async () => {
        // The page degrades this to an empty list, but the fetcher must not
        // silently manufacture success — a caller that needs to tell "nothing
        // logged" from "the API is down" has to be able to.
        getProtected.mockResolvedValue({ ok: false, error: { message: 'boom' } });

        const result = await partnersApi.mineMentions();

        expect(result.ok).toBe(false);
    });
});
