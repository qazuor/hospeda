/**
 * @fileoverview
 * Unit tests for the IndexNow key-ownership file (src/pages/[key].txt.ts).
 *
 * This route is the single point of failure for the whole feature: IndexNow
 * validates every submission by fetching it, so a wrong body or a wrong
 * content type turns every notification into a silent rejection.
 *
 * The assertions worth having are about what it does NOT serve — the key is
 * read per request precisely so a rotation takes effect without a rebuild, and
 * a route that answered on any path would hand an attacker the current key.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
    getIndexNowKey: vi.fn(() => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')
}));

import { getIndexNowKey } from '@/lib/env';
import { GET } from '@/pages/[key].txt';

const CONFIGURED_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

/** Invoke the handler the way Astro would, with the matched route param. */
function get(key: string | undefined): Promise<Response> | Response {
    return GET({
        params: { key },
        request: new Request(`https://hospeda.com.ar/${key}.txt`)
        // biome-ignore lint/suspicious/noExplicitAny: the handler reads `params` only
    } as any) as Response;
}

describe('IndexNow key file route', () => {
    beforeEach(() => {
        vi.mocked(getIndexNowKey).mockReturnValue(CONFIGURED_KEY);
    });

    it('serves the key as the entire body when the path matches', async () => {
        const response = await get(CONFIGURED_KEY);

        expect(response.status).toBe(200);
        // Exactly the key: IndexNow compares the body, so a trailing newline or
        // any wrapper is a failed verification.
        expect(await response.text()).toBe(CONFIGURED_KEY);
    });

    it('serves it as plain text', async () => {
        const response = await get(CONFIGURED_KEY);

        expect(response.headers.get('Content-Type')).toContain('text/plain');
    });

    it('is never shared-cacheable', async () => {
        const response = await get(CONFIGURED_KEY);

        // A rotation changes the URL, so a shared cache could pin a 404 on the
        // NEW key file — and a 404 here makes IndexNow reject every submission
        // until the TTL expires. No cache tag can purge it, which is why the
        // HOS-369 W1-1 static guard rejects this file if it ever becomes
        // publicly cacheable.
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('404s on any other path, without revealing the key', async () => {
        const response = await get('not-the-key');

        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain(CONFIGURED_KEY);
    });

    it('404s when no key is configured', async () => {
        vi.mocked(getIndexNowKey).mockReturnValue(undefined);

        const response = await get(CONFIGURED_KEY);

        expect(response.status).toBe(404);
    });

    it('404s on a missing route param rather than serving the key', async () => {
        const response = await get(undefined);

        expect(response.status).toBe(404);
    });

    it('reads the key on every request, so a rotation needs no rebuild', async () => {
        const first = await get(CONFIGURED_KEY);
        expect(first.status).toBe(200);

        // The operator rotates HOSPEDA_INDEXNOW_KEY on the platform.
        vi.mocked(getIndexNowKey).mockReturnValue('ffffffffffffffffffffffffffffffff');

        expect((await get(CONFIGURED_KEY)).status).toBe(404);
        const rotated = await get('ffffffffffffffffffffffffffffffff');
        expect(rotated.status).toBe(200);
        expect(await rotated.text()).toBe('ffffffffffffffffffffffffffffffff');
    });
});
