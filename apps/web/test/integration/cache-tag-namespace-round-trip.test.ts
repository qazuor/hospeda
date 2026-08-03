/**
 * @file cache-tag-namespace-round-trip.test.ts
 * @description The emitter/purger namespace agreement, exercised end to end
 * (HOS-369 W1-2).
 *
 * Why this file exists as something other than a unit test: `apps/web` and
 * `@repo/service-core` already call the SAME function to build the namespace,
 * so a test asserting "both call `resolveCacheTagEnvironment`" proves nothing —
 * the two sides cannot diverge in CODE. They diverge in CONFIGURATION, because
 * they are different processes reading `HOSPEDA_DEPLOY_ENV` from different
 * places, and that is precisely the state production and staging were measured
 * in (the API had it, the web app did not).
 *
 * The only place that mismatch becomes observable is the purge endpoint, where
 * a tag namespaced by one process is checked against the namespace of the
 * other. So this drives the real round trip inside one process:
 *
 *     declareCacheTags  →  serializeCacheTags  →  the `Cache-Tag` header
 *                       →  POST /api/revalidate  →  Cloudflare
 *
 * and then breaks the configuration on one side and asserts the round trip
 * FAILS. A test that only ever shows the agreeing case would pass just as
 * happily against an endpoint that accepted anything.
 */

import { serializeCacheTags } from '@repo/cache-tags';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheTagEnvironment } from '../../src/lib/cache/cache-tag-environment';
import { declareCacheTags } from '../../src/lib/cache/response-cache';
import { POST } from '../../src/pages/api/revalidate';

const SECRET = 'test-revalidation-secret';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    process.env.HOSPEDA_REVALIDATION_SECRET = SECRET;
    process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id';
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';

    fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    _resetCacheTagEnvironment();
});

/** Minimal stand-in for the request-scoped locals the emitter writes into. */
function makeLocals(): App.Locals {
    return { cacheTags: new Set<string>() } as unknown as App.Locals;
}

/**
 * Run the emitter exactly as a page does, then serialize exactly as middleware
 * Step 11 does, and return the wire form of the `Cache-Tag` header.
 */
function emitCacheTagHeader(tags: readonly [string, ...string[]]): string | null {
    const locals = makeLocals();
    declareCacheTags({ locals, tags });
    return serializeCacheTags({ tags: locals.cacheTags }).header;
}

/** POST a purge for the exact tags a response was tagged with. */
function purge(tags: readonly string[]): Promise<Response> {
    const request = new Request(
        `https://hospeda.test/api/revalidate/?secret=${encodeURIComponent(SECRET)}`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tags })
        }
    );
    return POST({ request } as unknown as Parameters<typeof POST>[0]);
}

describe('cache-tag namespace round trip', () => {
    it('purges exactly what the emitter tagged, when both sides agree', async () => {
        const header = emitCacheTagHeader(['accom-cabana-del-rio', 'list-accom', 'home']);
        expect(header).not.toBeNull();

        const response = await purge((header as string).split(','));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, purged: 3 });
    });

    it('sends the namespaced form to Cloudflare, not the bare vocabulary', async () => {
        const header = emitCacheTagHeader(['list-accom']);

        await purge((header as string).split(','));

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(JSON.parse(String(init.body))).toEqual({ tags: ['test:list-accom'] });
    });

    it('FAILS the round trip when the emitter and the purger read different values', async () => {
        // The whole point. Tags are emitted while this process believes it is
        // `preview`; the purge endpoint then runs while it believes it is
        // `test` — the exact shape of the measured staging/prod mismatch,
        // simulated by moving one side's configuration between the two steps.
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'preview');
        _resetCacheTagEnvironment();
        const header = emitCacheTagHeader(['accom-cabana-del-rio', 'list-accom']);
        expect(header).toBe('preview:accom-cabana-del-rio,preview:list-accom');

        vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'test');
        _resetCacheTagEnvironment();
        const response = await purge((header as string).split(','));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('emits nothing to purge when the namespace is unresolvable on the emitting side', async () => {
        // Fail-closed at the source: with no namespace the response is never
        // declared cacheable, so there is nothing to keep fresh and nothing to
        // purge. Better than a cacheable response no purge can reach.
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();

        expect(emitCacheTagHeader(['list-accom'])).toBeNull();
    });
});
