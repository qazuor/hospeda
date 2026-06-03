import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { resolveSentryUpstream } from './worker.js';

/** A valid Sentry envelope header line for a US-cloud project. */
const validHeader = JSON.stringify({
    event_id: 'abc123',
    sent_at: '2026-06-03T00:00:00.000Z',
    dsn: 'https://publickey@o123456.ingest.us.sentry.io/7890123'
});

/** A complete (tiny) envelope: header line + item header + item payload. */
function envelope(headerLine: string): string {
    return `${headerLine}\n{"type":"event"}\n{"message":"boom"}\n`;
}

describe('resolveSentryUpstream (DSN parsing + SSRF guard)', () => {
    it('derives the envelope upstream from a valid sentry.io DSN', () => {
        const result = resolveSentryUpstream(validHeader);
        expect(result).toEqual({
            upstreamUrl: 'https://o123456.ingest.us.sentry.io/api/7890123/envelope/'
        });
    });

    it('accepts the bare sentry.io apex host', () => {
        const header = JSON.stringify({ dsn: 'https://key@sentry.io/42' });
        expect(resolveSentryUpstream(header)).toEqual({
            upstreamUrl: 'https://sentry.io/api/42/envelope/'
        });
    });

    it('rejects a DSN whose host is NOT a sentry.io host (SSRF guard)', () => {
        const header = JSON.stringify({ dsn: 'https://key@evil.example.com/7890123' });
        const result = resolveSentryUpstream(header);
        expect('error' in result).toBe(true);
    });

    it('rejects a host that merely contains sentry.io as a substring', () => {
        const header = JSON.stringify({ dsn: 'https://key@sentry.io.evil.com/1' });
        expect('error' in resolveSentryUpstream(header)).toBe(true);
    });

    it('rejects the @-userinfo SSRF trick (last @ wins → real host is evil.com)', () => {
        const header = JSON.stringify({ dsn: 'https://key@sentry.io@evil.com/1' });
        expect('error' in resolveSentryUpstream(header)).toBe(true);
    });

    it('rejects a trailing-dot host (sentry.io.)', () => {
        const header = JSON.stringify({ dsn: 'https://key@sentry.io./1' });
        expect('error' in resolveSentryUpstream(header)).toBe(true);
    });

    it('accepts an uppercase host (URL lowercases it) and rebuilds the upstream lowercased', () => {
        const header = JSON.stringify({ dsn: 'https://key@O1.INGEST.US.SENTRY.IO/42' });
        expect(resolveSentryUpstream(header)).toEqual({
            upstreamUrl: 'https://o1.ingest.us.sentry.io/api/42/envelope/'
        });
    });

    it('ignores the DSN scheme and always forwards over https', () => {
        const header = JSON.stringify({ dsn: 'http://key@sentry.io/1' });
        expect(resolveSentryUpstream(header)).toEqual({
            upstreamUrl: 'https://sentry.io/api/1/envelope/'
        });
    });

    it('rejects a non-numeric project id', () => {
        const header = JSON.stringify({ dsn: 'https://key@o1.ingest.us.sentry.io/not-a-number' });
        expect('error' in resolveSentryUpstream(header)).toBe(true);
    });

    it('rejects an envelope header with no dsn', () => {
        expect('error' in resolveSentryUpstream(JSON.stringify({ event_id: 'x' }))).toBe(true);
    });

    it('rejects a header that is not valid JSON', () => {
        expect('error' in resolveSentryUpstream('not json')).toBe(true);
    });

    it('rejects an empty first line', () => {
        expect('error' in resolveSentryUpstream('')).toBe(true);
    });
});

describe('worker.fetch (forwarding behavior)', () => {
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn(
            async () =>
                new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('forwards a POST /api/event envelope to the DSN-derived upstream with no-store + real client IP', async () => {
        const request = new Request('https://hospeda.com.ar/api/event', {
            method: 'POST',
            headers: {
                'cf-connecting-ip': '203.0.113.7',
                'content-type': 'application/x-sentry-envelope'
            },
            body: envelope(validHeader)
        });

        const response = await worker.fetch(request);

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://o123456.ingest.us.sentry.io/api/7890123/envelope/');
        expect(init.method).toBe('POST');
        expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
        expect(init.headers.get('Cache-Control')).toBe('no-store');
        expect(init.headers.get('Content-Type')).toBe('application/x-sentry-envelope');
        // no-store also enforced on the response returned to the browser
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('does not set X-Forwarded-For when cf-connecting-ip is absent', async () => {
        const request = new Request('https://hospeda.com.ar/api/event', {
            method: 'POST',
            body: envelope(validHeader)
        });

        await worker.fetch(request);

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.get('X-Forwarded-For')).toBeNull();
    });

    it('defaults Content-Type to the envelope media type when the SDK omits it', async () => {
        // A Request whose body is a string with no explicit content-type: the
        // Worker must fall back to application/x-sentry-envelope, not text/plain.
        const request = new Request('https://hospeda.com.ar/api/event', {
            method: 'POST',
            body: envelope(validHeader)
        });
        // Strip the content-type the Request constructor auto-set for a string body.
        request.headers.delete('content-type');

        await worker.fetch(request);

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.get('Content-Type')).toBe('application/x-sentry-envelope');
    });

    it('rejects a non-sentry DSN with 403 and never calls upstream (SSRF guard)', async () => {
        const header = JSON.stringify({ dsn: 'https://key@evil.example.com/7890123' });
        const request = new Request('https://hospeda.com.ar/api/event', {
            method: 'POST',
            body: envelope(header)
        });

        const response = await worker.fetch(request);

        expect(response.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a non-POST method with 405 and never calls upstream', async () => {
        const request = new Request('https://hospeda.com.ar/api/event', { method: 'GET' });

        const response = await worker.fetch(request);

        expect(response.status).toBe(405);
        expect(response.headers.get('Allow')).toBe('POST');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a path other than /api/event with 404 and never calls upstream', async () => {
        const request = new Request('https://hospeda.com.ar/api/event/extra', {
            method: 'POST',
            body: envelope(validHeader)
        });

        const response = await worker.fetch(request);

        expect(response.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
