/**
 * @file revalidate.test.ts
 * @description Tests for the cache-purge endpoint — the choke point where, until
 * HOS-369 W1-1, every purge became `purge_everything: true` and the caller's
 * per-entity detail was discarded.
 *
 * The property that matters most here is negative: a whole-zone flush must be
 * reachable ONLY by an explicit `purgeEverything: true`. Nothing else — not a
 * missing body, not malformed JSON, not an empty tag list — may fall back to it.
 * That fallback is what the whole wave exists to remove, and it would be
 * invisible in production: the purge would report success and the cache would
 * simply keep emptying itself.
 *
 * Since HOS-369 W1-2 this endpoint is also THE divergence detector: it is the
 * only place in the system where a namespace derived by the API process meets a
 * namespace derived by the web process, so it is the only thing that can
 * OBSERVE the two disagreeing rather than merely make it less likely. The
 * `--- namespace ---` block below is that check, and it is the reason the
 * fixtures here carry a `test:` prefix.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheTagEnvironment } from '../../../src/lib/cache/cache-tag-environment';
import { POST } from '../../../src/pages/api/revalidate';

const SECRET = 'test-revalidation-secret';
const ZONE = 'test-zone-id';
const TOKEN = 'test-api-token';

/**
 * The namespace this deployment resolves to under vitest (`NODE_ENV=test`).
 *
 * Written as a literal, not derived from `resolveCacheTagEnvironment`: a
 * fixture that recomputes itself with the code under test cannot fail when that
 * code changes, which is exactly the failure this file must be able to catch.
 */
const NS = 'test:';
const NS_HOME = `${NS}home`;

/** Build the APIContext shape the route actually destructures. */
function makeContext({
    secret = SECRET,
    body
}: {
    readonly secret?: string | null;
    readonly body?: unknown;
}): Parameters<typeof POST>[0] {
    const url =
        secret === null
            ? 'https://hospeda.test/api/revalidate/'
            : `https://hospeda.test/api/revalidate/?secret=${encodeURIComponent(secret)}`;

    const request = new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body ?? {})
    });

    return { request } as unknown as Parameters<typeof POST>[0];
}

/** The JSON body of the last outgoing Cloudflare purge call. */
function lastPurgeBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
    const call = fetchMock.mock.calls.at(-1);
    if (!call) return undefined;
    const init = call[1] as RequestInit;
    return JSON.parse(String(init.body));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    process.env.HOSPEDA_REVALIDATION_SECRET = SECRET;
    process.env.CLOUDFLARE_ZONE_ID = ZONE;
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;

    fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetCacheTagEnvironment();
});

describe('POST /api/revalidate — auth', () => {
    it('rejects a missing secret', async () => {
        const response = await POST(makeContext({ secret: null, body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret', async () => {
        const response = await POST(makeContext({ secret: 'nope', body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects everything when the server has no secret configured', async () => {
        // Empty string, not `undefined` — assigning undefined to process.env
        // stores the literal string "undefined", which would pass the check.
        process.env.HOSPEDA_REVALIDATION_SECRET = '';

        const response = await POST(makeContext({ body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('500s when the Cloudflare credentials are missing', async () => {
        process.env.CLOUDFLARE_API_TOKEN = '';

        const response = await POST(makeContext({ body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(500);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/revalidate — selective purge', () => {
    it('forwards the tags to Cloudflare', async () => {
        const response = await POST(
            makeContext({ body: { tags: [`${NS}accom-cabana-del-rio`, `${NS}list-accom`] } })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, purged: 2 });
        expect(lastPurgeBody(fetchMock)).toEqual({
            tags: [`${NS}accom-cabana-del-rio`, `${NS}list-accom`]
        });
    });

    it('sends the bearer token and hits the zone purge endpoint', async () => {
        await POST(makeContext({ body: { tags: [NS_HOME] } }));

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`);
        expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('surfaces a Cloudflare failure as 502 rather than a silent success', async () => {
        fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));

        const response = await POST(makeContext({ body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({
            error: 'cloudflare_purge_failed',
            status: 429
        });
    });

    it('rejects a 200 whose envelope says success:false', async () => {
        // The v4 API answers with `{ success, errors[] }` and uses success:false
        // on a 200 for several validation/entitlement failures. Trusting the
        // status line would report a purge that evicted nothing as a success —
        // the silent failure this whole wave exists to remove.
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ success: false, errors: [{ code: 10000 }] }), {
                status: 200
            })
        );

        const response = await POST(makeContext({ body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({ error: 'cloudflare_purge_rejected' });
    });

    it('rejects a 200 whose body is not parseable as the envelope', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>proxy error</html>', { status: 200 }));

        const response = await POST(makeContext({ body: { tags: [NS_HOME] } }));

        expect(response.status).toBe(502);
    });
});

describe('POST /api/revalidate — whole-zone flush is reachable ONLY explicitly', () => {
    it('flushes the zone on an explicit purgeEverything', async () => {
        const response = await POST(makeContext({ body: { purgeEverything: true } }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, purged: 'all' });
        expect(lastPurgeBody(fetchMock)).toEqual({ purge_everything: true });
    });

    it.each([
        ['an empty body', {}],
        // The literal string, not `null`: the helper does `JSON.stringify(body ?? {})`,
        // so passing `null` would send `{}` and silently duplicate the row above
        // instead of exercising the `body === null` branch.
        ['a JSON null body', 'null'],
        ['tags of the wrong type', { tags: 'home' }],
        ['an empty tag list', { tags: [] }],
        ['purgeEverything set to a truthy non-true value', { purgeEverything: 'yes' }],
        ['purgeEverything set to false', { purgeEverything: false }]
    ])('400s on %s and NEVER falls back to a whole-zone flush', async (_label, body) => {
        const response = await POST(makeContext({ body }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('400s when both modes are supplied, instead of silently picking one', async () => {
        const response = await POST(
            makeContext({ body: { tags: [NS_HOME], purgeEverything: true } })
        );

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('400s on malformed JSON without flushing', async () => {
        const response = await POST(makeContext({ body: '{not json' }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'invalid_json' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/revalidate — tag validation', () => {
    it.each([
        ['a space', 'has space'],
        ['a comma, the list separator', 'has,comma'],
        ['non-ASCII', 'concepción'],
        ['an empty string', '']
    ])('rejects a tag containing %s', async (_label, tag) => {
        const response = await POST(makeContext({ body: { tags: [tag] } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a non-string entry in the tag array', async () => {
        const response = await POST(makeContext({ body: { tags: [42] } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects more tags than Cloudflare accepts per request, rather than truncating', async () => {
        // Truncating would drop the tail silently — those entities would stay
        // cached with nothing able to evict them.
        const tags = Array.from({ length: 101 }, (_, i) => `${NS}t-${i}`);

        const response = await POST(makeContext({ body: { tags } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts exactly the per-request limit', async () => {
        const tags = Array.from({ length: 100 }, (_, i) => `${NS}t-${i}`);

        const response = await POST(makeContext({ body: { tags } }));

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// --- namespace --- the emitter/purger divergence detector (HOS-369 W1-2)
// ---------------------------------------------------------------------------

describe('POST /api/revalidate — cross-environment purges are refused', () => {
    it('forwards a tag whose namespace matches this deployment', async () => {
        const response = await POST(makeContext({ body: { tags: [`${NS}list-accom`] } }));

        expect(response.status).toBe(200);
        expect(lastPurgeBody(fetchMock)).toEqual({ tags: [`${NS}list-accom`] });
    });

    it('REFUSES a tag namespaced for another deployment, and purges nothing', async () => {
        // The failure this endpoint exists to catch: staging's API resolving
        // `prod` (or production's resolving `preview`) and posting here. The two
        // environments share one Cloudflare zone, so forwarding this would evict
        // the OTHER environment's cache and Cloudflare would report success.
        const response = await POST(makeContext({ body: { tags: ['prod:list-accom'] } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await response.json()).toMatchObject({ error: 'invalid_request' });
    });

    it('names BOTH namespaces in the error, so the misconfigured side is identifiable', async () => {
        const response = await POST(makeContext({ body: { tags: ['preview:home'] } }));
        const body = (await response.json()) as { detail: string };

        expect(body.detail).toContain('preview');
        expect(body.detail).toContain('test');
        expect(body.detail).toContain('HOSPEDA_DEPLOY_ENV');
    });

    it('refuses the WHOLE request when a single tag is foreign, not just that tag', async () => {
        // Partial acceptance would let a mismatched deployment keep purging the
        // tags that happened to agree, hiding the misconfiguration behind a 200.
        const response = await POST(
            makeContext({ body: { tags: [`${NS}home`, 'prod:home', `${NS}list-accom`] } })
        );

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a BARE, un-namespaced tag — the shape emitted before this change', async () => {
        const response = await POST(makeContext({ body: { tags: ['list-accom'] } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a namespace that is not a known environment', async () => {
        const response = await POST(makeContext({ body: { tags: ['staging:home'] } }));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('follows HOSPEDA_DEPLOY_ENV: the same tag is accepted or refused by configuration alone', async () => {
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'preview');
        _resetCacheTagEnvironment();

        const accepted = await POST(makeContext({ body: { tags: ['preview:list-accom'] } }));
        expect(accepted.status).toBe(200);

        const refused = await POST(makeContext({ body: { tags: [`${NS}list-accom`] } }));
        expect(refused.status).toBe(400);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('503s rather than purging when this deployment cannot name itself', async () => {
        // "I cannot tell whose tag this is" must never resolve to "forward it".
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();

        const response = await POST(makeContext({ body: { tags: ['prod:list-accom'] } }));

        expect(response.status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await response.json()).toMatchObject({ error: 'cache_tag_namespace_unresolved' });
    });
});
