import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { resolveUpstream } from './worker.js';

describe('resolveUpstream (path rewriting)', () => {
    it('routes /ingest/e/ to the ingestion host and flags it no-cache', () => {
        const result = resolveUpstream(new URL('https://hospeda.com.ar/ingest/e/?v=2&ip=1'));
        expect(result.upstreamUrl).toBe('https://us.i.posthog.com/e/?v=2&ip=1');
        expect(result.isIngestion).toBe(true);
    });

    it('routes /ingest/decide/ and /ingest/flags/ to the ingestion host', () => {
        expect(resolveUpstream(new URL('https://h/ingest/decide/')).upstreamUrl).toBe(
            'https://us.i.posthog.com/decide/'
        );
        expect(resolveUpstream(new URL('https://h/ingest/flags/')).isIngestion).toBe(true);
    });

    it('routes /ingest/static/* to the assets host and does NOT flag it as ingestion', () => {
        const result = resolveUpstream(new URL('https://hospeda.com.ar/ingest/static/array.js'));
        expect(result.upstreamUrl).toBe('https://us-assets.i.posthog.com/static/array.js');
        expect(result.isIngestion).toBe(false);
    });

    it('maps the bare /ingest prefix to the ingestion host root', () => {
        expect(resolveUpstream(new URL('https://h/ingest')).upstreamUrl).toBe(
            'https://us.i.posthog.com/'
        );
    });
});

describe('worker.fetch (forwarding behavior)', () => {
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn(
            async () =>
                new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('forwards POST /ingest/e/ to us.i.posthog.com with no-store + real client IP', async () => {
        const request = new Request('https://hospeda.com.ar/ingest/e/', {
            method: 'POST',
            headers: {
                'cf-connecting-ip': '203.0.113.7',
                'content-type': 'application/json'
            },
            body: JSON.stringify({ event: '$pageview' })
        });

        const response = await worker.fetch(request);

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://us.i.posthog.com/e/');
        expect(init.method).toBe('POST');
        expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
        expect(init.headers.get('Cache-Control')).toBe('no-store');
        // inbound Host header is dropped so the upstream URL host is used
        expect(init.headers.get('host')).toBeNull();
        // no-store also enforced on the response returned to the browser
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('forwards GET /ingest/static/array.js to the assets host without forcing no-store', async () => {
        const request = new Request('https://hospeda.com.ar/ingest/static/array.js', {
            headers: { 'cf-connecting-ip': '203.0.113.7' }
        });

        await worker.fetch(request);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://us-assets.i.posthog.com/static/array.js');
        expect(init.headers.get('Cache-Control')).toBeNull();
        expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
    });

    it('does not set X-Forwarded-For when cf-connecting-ip is absent', async () => {
        const request = new Request('https://hospeda.com.ar/ingest/decide/', { method: 'POST' });

        await worker.fetch(request);

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.get('X-Forwarded-For')).toBeNull();
    });

    it('rejects a path without the /ingest prefix with 404 and never calls upstream', async () => {
        const request = new Request('https://hospeda.com.ar/other/path');

        const response = await worker.fetch(request);

        expect(response.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
