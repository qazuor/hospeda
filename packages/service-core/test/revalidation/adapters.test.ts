/**
 * @fileoverview
 * Unit tests for RevalidationAdapter implementations:
 * - CloudflareRevalidationAdapter: production HTTP-based cache purge
 * - NoOpRevalidationAdapter: dev/test no-op adapter
 * - createRevalidationAdapter: factory function for environment-based selection
 *
 * All tests use vi.stubGlobal to mock fetch and verify adapter behavior
 * without making real network calls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRevalidationAdapter } from '../../src/revalidation/adapters/adapter-factory.js';
import { CloudflareRevalidationAdapter } from '../../src/revalidation/adapters/cloudflare-revalidation.adapter.js';
import { NoOpRevalidationAdapter } from '../../src/revalidation/adapters/noop-revalidation.adapter.js';

const SECRET = 'test-secret-32-chars-min-required-here';
const SITE_URL = 'https://example.com';
const TEST_PATH = '/alojamientos/';

describe('CloudflareRevalidationAdapter', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('throws when secret is empty', () => {
        expect(() => new CloudflareRevalidationAdapter({ secret: '', siteUrl: SITE_URL })).toThrow(
            'secret is required and cannot be empty'
        );
    });

    it('throws when secret is whitespace-only', () => {
        expect(
            () => new CloudflareRevalidationAdapter({ secret: '   ', siteUrl: SITE_URL })
        ).toThrow('secret is required and cannot be empty');
    });

    it('returns success when fetch returns 200', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(true);
        expect(result.path).toBe(TEST_PATH);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns failure when fetch returns non-200', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(false);
        expect(result.error).toContain('404');
    });

    it('returns failure on network error without throwing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('POSTs to /api/revalidate with the secret in the query string', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        await adapter.revalidate({ path: TEST_PATH });
        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        const calledOpts = mockFetch.mock.calls[0]![1] as { method: string };
        expect(calledOpts.method).toBe('POST');
        expect(calledUrl).toBe(`${SITE_URL}/api/revalidate?secret=${encodeURIComponent(SECRET)}`);
    });

    it('strips a trailing slash from siteUrl when building the request URL', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: `${SITE_URL}/`
        });
        await adapter.revalidate({ path: TEST_PATH });
        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        expect(calledUrl).toBe(`${SITE_URL}/api/revalidate?secret=${encodeURIComponent(SECRET)}`);
    });

    it('returns the path in the result', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.path).toBe(TEST_PATH);
    });

    it('includes statusText in the error message for non-200 responses', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Service Unavailable');
    });

    it('returns timeout error when fetch exceeds 10s', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(
                (_url: string, options: { signal: AbortSignal }) =>
                    new Promise((_resolve, reject) => {
                        options.signal.addEventListener('abort', () => {
                            const abortError = new Error('The operation was aborted');
                            abortError.name = 'AbortError';
                            reject(abortError);
                        });
                    })
            )
        );
        vi.useFakeTimers();
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const resultPromise = adapter.revalidate({ path: TEST_PATH });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await resultPromise;
        expect(result.success).toBe(false);
        expect(result.error).toBe('Request timeout (10s)');
        vi.useRealTimers();
    });

    it('has a name property set to CloudflareRevalidationAdapter', () => {
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        expect(adapter.name).toBe('CloudflareRevalidationAdapter');
    });

    describe('revalidateMany', () => {
        it('makes a single purge call for many paths and reports the same result for each', async () => {
            const mockFetch = vi
                .fn()
                .mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const paths = ['/path-a/', '/path-b/', '/path-c/'];
            const results = await adapter.revalidateMany({ paths });
            expect(results).toHaveLength(3);
            // Cloudflare purge_everything invalidates the whole zone — one
            // call covers all paths.
            expect(mockFetch).toHaveBeenCalledTimes(1);
            for (const r of results) {
                expect(r.success).toBe(true);
            }
        });

        it('returns failure for every path when the single purge call fails', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const paths = ['/p1/', '/p2/', '/p3/'];
            const results = await adapter.revalidateMany({ paths });
            expect(results).toHaveLength(3);
            for (const r of results) {
                expect(r.success).toBe(false);
                expect(r.error).toContain('502');
            }
        });

        it('returns empty array for empty paths without making fetch calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const results = await adapter.revalidateMany({ paths: [] });
            expect(results).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('echoes input paths into result objects', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const paths = ['/foo/', '/bar/', '/baz/'];
            const results = await adapter.revalidateMany({ paths });
            expect(results.map((r) => r.path)).toEqual(paths);
        });
    });

    describe('HTTP error status codes', () => {
        it('returns failure with error message on HTTP 429 rate limiting', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const result = await adapter.revalidate({ path: TEST_PATH });
            expect(result.success).toBe(false);
            expect(result.error).toContain('429');
            expect(result.error).toContain('Too Many Requests');
        });

        it('returns failure with error message on HTTP 401 missing secret', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const result = await adapter.revalidate({ path: TEST_PATH });
            expect(result.success).toBe(false);
            expect(result.error).toContain('401');
            expect(result.error).toContain('Unauthorized');
        });
    });
});

describe('NoOpRevalidationAdapter', () => {
    it('always returns success without making HTTP calls', async () => {
        const mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new NoOpRevalidationAdapter();
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns the path in the result', async () => {
        const adapter = new NoOpRevalidationAdapter();
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.path).toBe(TEST_PATH);
    });

    it('returns durationMs >= 0', async () => {
        const adapter = new NoOpRevalidationAdapter();
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('has a name property set to NoOpRevalidationAdapter', () => {
        const adapter = new NoOpRevalidationAdapter();
        expect(adapter.name).toBe('NoOpRevalidationAdapter');
    });

    describe('revalidateMany', () => {
        it('returns success for all paths without HTTP calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new NoOpRevalidationAdapter();
            const results = await adapter.revalidateMany({ paths: ['/p1/', '/p2/', '/p3/'] });
            expect(results).toHaveLength(3);
            for (const r of results) {
                expect(r.success).toBe(true);
            }
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('returns empty array for empty input', async () => {
            const adapter = new NoOpRevalidationAdapter();
            const results = await adapter.revalidateMany({ paths: [] });
            expect(results).toHaveLength(0);
        });
    });
});

describe('createRevalidationAdapter', () => {
    it('returns CloudflareRevalidationAdapter in production with secret', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'production',
            revalidationSecret: 'x'.repeat(32),
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(CloudflareRevalidationAdapter);
    });

    it('returns CloudflareRevalidationAdapter in staging with secret', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'staging',
            revalidationSecret: 'x'.repeat(32),
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(CloudflareRevalidationAdapter);
    });

    it('returns NoOpRevalidationAdapter in development', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'development',
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(NoOpRevalidationAdapter);
    });

    it('returns NoOpRevalidationAdapter in production without secret', () => {
        const adapter = createRevalidationAdapter({ nodeEnv: 'production', siteUrl: SITE_URL });
        expect(adapter).toBeInstanceOf(NoOpRevalidationAdapter);
    });

    it('returns NoOpRevalidationAdapter in test environment', () => {
        const adapter = createRevalidationAdapter({ nodeEnv: 'test', siteUrl: SITE_URL });
        expect(adapter).toBeInstanceOf(NoOpRevalidationAdapter);
    });

    it('returns NoOpRevalidationAdapter when nodeEnv is empty string', () => {
        const adapter = createRevalidationAdapter({ nodeEnv: '', siteUrl: SITE_URL });
        expect(adapter).toBeInstanceOf(NoOpRevalidationAdapter);
    });

    it('returns NoOpRevalidationAdapter in production with empty string secret', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'production',
            revalidationSecret: '',
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(NoOpRevalidationAdapter);
    });
});
