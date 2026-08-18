/**
 * @file indexnow.test.ts
 * @description Protocol-level tests for the IndexNow client (HOS-585 G-1).
 *
 * The three properties worth guarding here, in order of how expensive they are
 * to get wrong:
 *
 * 1. `202` is acceptance, not failure. It is what a freshly-published key gets
 *    while the engines verify it — reading it as an error makes a working
 *    first submission look broken.
 * 2. The refusal paths must not reach the network. Sending a batch that is
 *    empty, oversized, or contains a foreign URL earns a protocol penalty, so
 *    "did not call fetch" is the assertion, not "returned success: false".
 * 3. It never throws. The caller is a fire-and-forget hook next to a content
 *    write.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    findForeignUrls,
    INDEXNOW_ENDPOINT,
    INDEXNOW_MAX_URLS_PER_REQUEST,
    type IndexNowPayload,
    submitToIndexNow,
    toIndexNowHost
} from '../../../src/lib/seo/indexnow';

const HOST = 'hospeda.com.ar';

const payloadWith = (urlList: readonly string[]): IndexNowPayload => ({
    host: HOST,
    key: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    keyLocation: `https://${HOST}/a1b2c3d4e5f6a1b2c3d4e5f6.txt`,
    urlList
});

/** A `fetch` stub that resolves with the given status and records its calls. */
const stubFetch = (status: number) =>
    vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;

describe('toIndexNowHost', () => {
    it('reduces an absolute site URL to its bare host', () => {
        expect(toIndexNowHost({ siteUrl: 'https://hospeda.com.ar/' })).toBe(HOST);
    });

    it('keeps the port, which is part of the host', () => {
        expect(toIndexNowHost({ siteUrl: 'http://localhost:4321/' })).toBe('localhost:4321');
    });

    it('returns undefined for a non-URL instead of throwing', () => {
        expect(toIndexNowHost({ siteUrl: 'not a url' })).toBeUndefined();
    });
});

describe('findForeignUrls', () => {
    it('accepts URLs on the same host', () => {
        const foreign = findForeignUrls({
            host: HOST,
            urls: [`https://${HOST}/es/`, `https://${HOST}/en/alojamientos/x/`]
        });

        expect(foreign).toEqual([]);
    });

    it('flags a URL on another host', () => {
        const foreign = findForeignUrls({
            host: HOST,
            urls: [`https://${HOST}/es/`, 'https://staging.hospeda.com.ar/es/']
        });

        expect(foreign).toEqual(['https://staging.hospeda.com.ar/es/']);
    });

    it('treats an unparseable string as foreign rather than letting it through', () => {
        expect(findForeignUrls({ host: HOST, urls: ['/es/relative'] })).toEqual(['/es/relative']);
    });
});

describe('submitToIndexNow — refusals never reach the network', () => {
    it('refuses an empty batch without calling fetch', async () => {
        const fetchImpl = stubFetch(200);

        const result = await submitToIndexNow({ payload: payloadWith([]), fetchImpl });

        expect(result.success).toBe(false);
        expect(result.submitted).toBe(0);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses an oversized batch without calling fetch, and does not truncate', async () => {
        const fetchImpl = stubFetch(200);
        const tooMany = Array.from(
            { length: INDEXNOW_MAX_URLS_PER_REQUEST + 1 },
            (_, i) => `https://${HOST}/es/p/${i}/`
        );

        const result = await submitToIndexNow({ payload: payloadWith(tooMany), fetchImpl });

        expect(result.success).toBe(false);
        expect(result.error).toContain(String(INDEXNOW_MAX_URLS_PER_REQUEST));
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses a batch containing a foreign URL without calling fetch', async () => {
        const fetchImpl = stubFetch(200);

        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`, 'https://example.com/es/']),
            fetchImpl
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('example.com');
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('submitToIndexNow — protocol statuses', () => {
    it('treats 200 as acceptance', async () => {
        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`]),
            fetchImpl: stubFetch(200)
        });

        expect(result.success).toBe(true);
        expect(result.submitted).toBe(1);
        expect(result.status).toBe(200);
    });

    /**
     * The one most likely to be "fixed" into a bug. 202 means the submission
     * was accepted while the key file is still being verified — exactly what
     * the first real submission after publishing a new key receives.
     */
    it('treats 202 as acceptance, not as a pending failure', async () => {
        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`]),
            fetchImpl: stubFetch(202)
        });

        expect(result.success).toBe(true);
        expect(result.submitted).toBe(1);
        expect(result.error).toBeUndefined();
    });

    it.each([
        [400, 'invalid format'],
        [403, 'key not valid'],
        [422, 'do not belong'],
        [429, 'rate-limited']
    ])('reports %i with an actionable explanation', async (status, fragment) => {
        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`]),
            fetchImpl: stubFetch(status)
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe(status);
        expect(result.error).toContain(fragment);
    });

    it('reports an undocumented status instead of assuming success', async () => {
        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`]),
            fetchImpl: stubFetch(500)
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe(500);
    });
});

describe('submitToIndexNow — wire format and failure containment', () => {
    it('POSTs the payload as JSON to the protocol endpoint', async () => {
        const fetchImpl = stubFetch(200);
        const payload = payloadWith([`https://${HOST}/es/`]);

        await submitToIndexNow({ payload, fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe(INDEXNOW_ENDPOINT);
        expect(init.method).toBe('POST');
        expect(init.headers['Content-Type']).toBe('application/json; charset=utf-8');
        expect(JSON.parse(init.body)).toEqual({
            host: payload.host,
            key: payload.key,
            keyLocation: payload.keyLocation,
            urlList: payload.urlList
        });
    });

    it('returns a failed result instead of throwing when the network rejects', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        }) as unknown as typeof fetch;

        const result = await submitToIndexNow({
            payload: payloadWith([`https://${HOST}/es/`]),
            fetchImpl
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('carries a timeout signal so a hung request cannot leak', async () => {
        const fetchImpl = stubFetch(200);

        await submitToIndexNow({ payload: payloadWith([`https://${HOST}/es/`]), fetchImpl });

        const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });
});
