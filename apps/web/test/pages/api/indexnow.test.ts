/**
 * @file indexnow.test.ts
 * @description Tests for the search-engine notification endpoint (HOS-585 G-1).
 *
 * Strategy: mock `@/lib/env`, `@/lib/middleware-helpers` and the transport
 * (`submitToIndexNow`), then call the POST handler directly. Mocking the
 * transport rather than `fetch` is deliberate — the protocol itself is covered
 * in `test/lib/seo/indexnow.test.ts`, so what is under test here is the gating
 * and the URLs this endpoint decides to hand over.
 *
 * The assertions that matter most are the negative ones: every refusal must be
 * proven by "the transport was never called", not merely by the status code. A
 * gate that returns 403 *after* submitting has already leaked the URLs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SITE = 'https://hospeda.test';
const SECRET = 's3cr3t';
const KEY = 'a1b2c3d4e5f6a1b2c3d4';

const envMock = {
    getSiteUrl: vi.fn(() => SITE),
    getNoindexHosts: vi.fn((): string | undefined => undefined),
    getRevalidationSecret: vi.fn((): string | undefined => SECRET),
    getIndexNowKey: vi.fn((): string | undefined => KEY)
};

vi.mock('@/lib/env', () => envMock);

vi.mock('@/lib/middleware-helpers', () => ({
    parseNoindexHosts: vi.fn((raw: string | undefined) =>
        raw ? raw.split(',').map((h) => h.trim().toLowerCase()) : ['staging.hospeda.test']
    )
}));

const submitToIndexNow = vi.fn(async () => ({
    success: true,
    submitted: 3,
    status: 200,
    durationMs: 12
}));

vi.mock('@/lib/seo/indexnow', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/seo/indexnow')>();
    return { ...actual, submitToIndexNow };
});

/** Build a POST request for the endpoint. */
function makeRequest({
    secret = SECRET,
    host = 'hospeda.test',
    body = { entities: [{ entityType: 'accommodation', slug: 'hotel-x' }] },
    rawBody
}: {
    secret?: string | null;
    host?: string;
    body?: unknown;
    rawBody?: string;
} = {}): Request {
    const url = new URL('https://hospeda.test/api/indexnow/');
    if (secret !== null) url.searchParams.set('secret', secret);

    return new Request(url, {
        method: 'POST',
        headers: { host, 'Content-Type': 'application/json' },
        body: rawBody ?? JSON.stringify(body)
    });
}

/** Import the handler fresh so module-level mock state is respected. */
async function post(request: Request): Promise<Response> {
    const { POST } = await import('../../../src/pages/api/indexnow');
    return POST({ request } as unknown as Parameters<typeof POST>[0]) as Promise<Response>;
}

beforeEach(() => {
    vi.clearAllMocks();
    envMock.getSiteUrl.mockReturnValue(SITE);
    envMock.getNoindexHosts.mockReturnValue(undefined);
    envMock.getRevalidationSecret.mockReturnValue(SECRET);
    envMock.getIndexNowKey.mockReturnValue(KEY);
    submitToIndexNow.mockResolvedValue({
        success: true,
        submitted: 3,
        status: 200,
        durationMs: 12
    });
});

describe('POST /api/indexnow — refusals never submit', () => {
    it('401s when the secret does not match, without submitting', async () => {
        const response = await post(makeRequest({ secret: 'wrong' }));

        expect(response.status).toBe(401);
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });

    it('401s when no secret is configured at all', async () => {
        envMock.getRevalidationSecret.mockReturnValue(undefined);

        const response = await post(makeRequest({ secret: null }));

        expect(response.status).toBe(401);
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });

    /**
     * An unset key is the hard kill switch described in the schema's JSDoc: no
     * admin toggle can turn the feature on without it.
     */
    it('503s when the IndexNow key is not configured, without submitting', async () => {
        envMock.getIndexNowKey.mockReturnValue(undefined);

        const response = await post(makeRequest());

        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ error: 'indexnow_key_missing' });
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });

    /**
     * Staging serves `Disallow: /`. Submitting its URLs would contradict the
     * robots policy this same app emits.
     */
    it('403s on a noindex host, without submitting', async () => {
        envMock.getNoindexHosts.mockReturnValue('staging.hospeda.test');

        const response = await post(makeRequest({ host: 'staging.hospeda.test' }));

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: 'noindex_host' });
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });

    it('400s on malformed JSON', async () => {
        const response = await post(makeRequest({ rawBody: '{not json' }));

        expect(response.status).toBe(400);
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });

    it.each([
        [{}, 'missing entities'],
        [{ entities: 'nope' }, 'entities not an array'],
        [{ entities: [] }, 'empty array'],
        [{ entities: [{ entityType: 'tag', slug: 'x' }] }, 'entity type with no page'],
        [{ entities: [{ entityType: 'accommodation', slug: '../etc/passwd' }] }, 'bad slug'],
        [{ entities: [{ entityType: 'accommodation', slug: 'a/b' }] }, 'slug with a slash']
    ])('400s on %j (%s), without submitting', async (body) => {
        const response = await post(makeRequest({ body }));

        expect(response.status).toBe(400);
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });
});

describe('POST /api/indexnow — what it submits', () => {
    it('expands one entity into its three locale URLs', async () => {
        await post(makeRequest());

        expect(submitToIndexNow).toHaveBeenCalledTimes(1);
        const { payload } = submitToIndexNow.mock.calls[0][0];
        expect(payload.urlList).toEqual([
            `${SITE}/es/alojamientos/hotel-x/`,
            `${SITE}/en/alojamientos/hotel-x/`,
            `${SITE}/pt/alojamientos/hotel-x/`
        ]);
    });

    it('expands several entities in one submission', async () => {
        await post(
            makeRequest({
                body: {
                    entities: [
                        { entityType: 'event', slug: 'fiesta' },
                        { entityType: 'post', slug: 'guia' }
                    ]
                }
            })
        );

        const { payload } = submitToIndexNow.mock.calls[0][0];
        expect(payload.urlList).toHaveLength(6);
        expect(payload.urlList).toContain(`${SITE}/es/eventos/fiesta/`);
        expect(payload.urlList).toContain(`${SITE}/pt/publicaciones/guia/`);
    });

    /**
     * The same-origin guarantee that removes the protocol's 403/422 host
     * failure modes: the key file is advertised on the very host whose URLs are
     * being submitted.
     */
    it('points keyLocation at the key file on the submitting host', async () => {
        await post(makeRequest());

        const { payload } = submitToIndexNow.mock.calls[0][0];
        expect(payload.keyLocation).toBe(`${SITE}/${KEY}.txt`);
        expect(payload.host).toBe('hospeda.test');
        expect(payload.key).toBe(KEY);
    });

    it('never submits a URL carrying a query string', async () => {
        await post(makeRequest());

        const { payload } = submitToIndexNow.mock.calls[0][0];
        for (const url of payload.urlList) {
            expect(url).not.toContain('?');
        }
    });

    it('submits the valid entities and reports the rejected ones', async () => {
        const response = await post(
            makeRequest({
                body: {
                    entities: [
                        { entityType: 'accommodation', slug: 'hotel-x' },
                        { entityType: 'nonsense', slug: 'y' }
                    ]
                }
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.entities).toBe(1);
        expect(body.rejected).toHaveLength(1);
        expect(submitToIndexNow).toHaveBeenCalledTimes(1);
    });
});

describe('POST /api/indexnow — outcomes', () => {
    it('reports success with the submitted count', async () => {
        const response = await post(makeRequest());

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ submitted: 3, entities: 1, status: 200 });
    });

    it('surfaces a protocol rejection as 502 rather than a silent 200', async () => {
        submitToIndexNow.mockResolvedValue({
            success: false,
            submitted: 0,
            status: 403,
            error: 'key not valid',
            durationMs: 8
        });

        const response = await post(makeRequest());

        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({
            error: 'submission_failed',
            status: 403,
            attempted: 3
        });
    });

    it('500s when the configured site URL is not a URL', async () => {
        envMock.getSiteUrl.mockReturnValue('not a url');

        const response = await post(makeRequest());

        expect(response.status).toBe(500);
        expect(submitToIndexNow).not.toHaveBeenCalled();
    });
});
