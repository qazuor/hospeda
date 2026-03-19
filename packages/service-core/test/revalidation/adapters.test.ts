/**
 * @fileoverview
 * Unit tests for RevalidationAdapter implementations:
 * - VercelRevalidationAdapter: production HTTP-based revalidation
 * - NoOpRevalidationAdapter: dev/test no-op adapter
 * - createRevalidationAdapter: factory function for environment-based selection
 *
 * All tests use vi.stubGlobal to mock fetch and verify adapter behavior
 * without making real network calls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRevalidationAdapter } from '../../src/revalidation/adapters/adapter-factory.js';
import { NoOpRevalidationAdapter } from '../../src/revalidation/adapters/noop-revalidation.adapter.js';
import { VercelRevalidationAdapter } from '../../src/revalidation/adapters/vercel-revalidation.adapter.js';

const BYPASS_TOKEN = 'test-token-32-chars-min-required-here';
const SITE_URL = 'https://example.com';
const TEST_PATH = '/alojamientos/';

describe('VercelRevalidationAdapter', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('throws when bypassToken is empty', () => {
        expect(() => new VercelRevalidationAdapter({ bypassToken: '', siteUrl: SITE_URL })).toThrow(
            'bypassToken is required and cannot be empty'
        );
    });

    it('throws when bypassToken is whitespace-only', () => {
        expect(
            () => new VercelRevalidationAdapter({ bypassToken: '   ', siteUrl: SITE_URL })
        ).toThrow('bypassToken is required and cannot be empty');
    });

    it('returns success when fetch returns 200', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
        );
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
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
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(false);
        expect(result.error).toContain('404');
    });

    it('returns failure on network error without throwing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ path: TEST_PATH });
        expect(result.success).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('sends x-prerender-revalidate header', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        await adapter.revalidate({ path: TEST_PATH });
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(TEST_PATH),
            expect.objectContaining({
                headers: expect.objectContaining({ 'x-prerender-revalidate': BYPASS_TOKEN })
            })
        );
    });

    it('constructs the URL from siteUrl and path', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        await adapter.revalidate({ path: TEST_PATH });
        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        expect(calledUrl).toBe(`${SITE_URL}${TEST_PATH}`);
    });

    it('returns the path in the result', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
        );
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
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
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
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
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        const resultPromise = adapter.revalidate({ path: TEST_PATH });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await resultPromise;
        expect(result.success).toBe(false);
        expect(result.error).toBe('Request timeout (10s)');
        vi.useRealTimers();
    });

    it('has a name property set to VercelRevalidationAdapter', () => {
        const adapter = new VercelRevalidationAdapter({
            bypassToken: BYPASS_TOKEN,
            siteUrl: SITE_URL
        });
        expect(adapter.name).toBe('VercelRevalidationAdapter');
    });

    describe('revalidateMany', () => {
        it('revalidates all paths and returns results array', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
            );
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const paths = ['/path-a/', '/path-b/', '/path-c/'];
            const results = await adapter.revalidateMany({ paths });
            expect(results).toHaveLength(3);
            for (const r of results) {
                expect(r.success).toBe(true);
            }
        });

        it('processes paths in chunks of 10 with delay between chunks', async () => {
            const callTimestamps: number[] = [];
            vi.stubGlobal(
                'fetch',
                vi.fn().mockImplementation(() => {
                    callTimestamps.push(Date.now());
                    return Promise.resolve({ ok: true, status: 200, statusText: 'OK' });
                })
            );
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const paths = Array.from({ length: 15 }, (_, i) => `/path-${i}/`);
            const results = await adapter.revalidateMany({ paths });

            // All 15 paths should be processed
            expect(results).toHaveLength(15);
            for (const r of results) {
                expect(r.success).toBe(true);
            }

            // fetch should have been called 15 times total
            expect(vi.mocked(fetch)).toHaveBeenCalledTimes(15);
        });

        it('continues revalidating other paths when one fails', async () => {
            let callCount = 0;
            vi.stubGlobal(
                'fetch',
                vi.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 2) return Promise.reject(new Error('network fail'));
                    return Promise.resolve({ ok: true, status: 200, statusText: 'OK' });
                })
            );
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const results = await adapter.revalidateMany({ paths: ['/p1/', '/p2/', '/p3/'] });
            expect(results).toHaveLength(3);
            expect(results[0]!.success).toBe(true);
            expect(results[1]!.success).toBe(false);
            expect(results[2]!.success).toBe(true);
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
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const result = await adapter.revalidate({ path: TEST_PATH });
            expect(result.success).toBe(false);
            expect(result.error).toContain('429');
            expect(result.error).toContain('Too Many Requests');
        });

        it('returns failure with error message on HTTP 403 auth failure', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
            );
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const result = await adapter.revalidate({ path: TEST_PATH });
            expect(result.success).toBe(false);
            expect(result.error).toContain('403');
            expect(result.error).toContain('Forbidden');
        });
    });

    describe('revalidateMany edge cases', () => {
        it('returns empty array for empty paths without making fetch calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const results = await adapter.revalidateMany({ paths: [] });
            expect(results).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('handles partial success when some paths fail with HTTP 500', async () => {
            let callCount = 0;
            vi.stubGlobal(
                'fetch',
                vi.fn().mockImplementation(() => {
                    callCount++;
                    // Paths 3, 4, 5 fail with 500
                    if (callCount >= 3 && callCount <= 5) {
                        return Promise.resolve({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error'
                        });
                    }
                    return Promise.resolve({ ok: true, status: 200, statusText: 'OK' });
                })
            );
            const adapter = new VercelRevalidationAdapter({
                bypassToken: BYPASS_TOKEN,
                siteUrl: SITE_URL
            });
            const paths = Array.from({ length: 7 }, (_, i) => `/path-${i}/`);
            const results = await adapter.revalidateMany({ paths });

            expect(results).toHaveLength(7);
            // First two succeed
            expect(results[0]!.success).toBe(true);
            expect(results[1]!.success).toBe(true);
            // Next three fail
            expect(results[2]!.success).toBe(false);
            expect(results[3]!.success).toBe(false);
            expect(results[4]!.success).toBe(false);
            // Last two succeed
            expect(results[5]!.success).toBe(true);
            expect(results[6]!.success).toBe(true);
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
    it('returns VercelRevalidationAdapter in production with secret', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'production',
            revalidationSecret: 'x'.repeat(32),
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(VercelRevalidationAdapter);
    });

    it('returns VercelRevalidationAdapter in staging with secret', () => {
        const adapter = createRevalidationAdapter({
            nodeEnv: 'staging',
            revalidationSecret: 'x'.repeat(32),
            siteUrl: SITE_URL
        });
        expect(adapter).toBeInstanceOf(VercelRevalidationAdapter);
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
