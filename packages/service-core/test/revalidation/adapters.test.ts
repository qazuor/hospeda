/**
 * @fileoverview
 * Unit tests for RevalidationAdapter implementations:
 * - CloudflareRevalidationAdapter: production HTTP-based cache-tag purge
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
import { WHOLE_ZONE_TARGET } from '../../src/revalidation/adapters/revalidation.adapter.js';

const SECRET = 'test-secret-32-chars-min-required-here';
const SITE_URL = 'https://example.com';
const TEST_TAG = 'list-accom';

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
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: true, purged: 1 })
            })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(true);
        expect(result.target).toBe(TEST_TAG);
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
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(false);
        expect(result.error).toContain('404');
    });

    // HOS-424 regression. The adapter used to derive `success` from the status
    // line alone and never read the body, so a purge the endpoint explicitly
    // declined was written to `revalidation_log` as `status = 'success'`. The
    // endpoint only answers `{ ok: true }` after checking Cloudflare's own
    // envelope (a Cloudflare 200 can mean "purged nothing"), so the body is the
    // verdict and the status line is not.
    it('returns failure when the endpoint answers 200 but does not confirm the purge', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: false, error: 'cloudflare_purge_rejected' })
            })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(false);
        expect(result.error).toContain('did not confirm');
        expect(result.error).toContain('cloudflare_purge_rejected');
    });

    it('returns failure when the endpoint answers 200 with an unparseable body', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => {
                    throw new SyntaxError('Unexpected token < in JSON at position 0');
                }
            })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(false);
        expect(result.error).toContain('unparseable response body');
    });

    it('returns failure on network error without throwing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('POSTs to /api/revalidate/ (trailing slash) with the secret in the query string', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true, purged: 1 })
        });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        await adapter.revalidate({ tag: TEST_TAG });
        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        const calledOpts = mockFetch.mock.calls[0]![1] as { method: string };
        expect(calledOpts.method).toBe('POST');
        // Trailing slash is required — the web runs `trailingSlash: 'always'`, so
        // the unslashed form 301→GET→404s (HOS-203).
        expect(calledUrl).toBe(`${SITE_URL}/api/revalidate/?secret=${encodeURIComponent(SECRET)}`);
    });

    it('strips a trailing slash from siteUrl when building the request URL', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true, purged: 1 })
        });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: `${SITE_URL}/`
        });
        await adapter.revalidate({ tag: TEST_TAG });
        const calledUrl = mockFetch.mock.calls[0]![0] as string;
        expect(calledUrl).toBe(`${SITE_URL}/api/revalidate/?secret=${encodeURIComponent(SECRET)}`);
    });

    it('returns the tag in the result', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: true, purged: 1 })
            })
        );
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.target).toBe(TEST_TAG);
    });

    it('sends the tag in the request body as { tags: [...] }', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true, purged: 1 })
        });
        vi.stubGlobal('fetch', mockFetch);
        const adapter = new CloudflareRevalidationAdapter({
            secret: SECRET,
            siteUrl: SITE_URL
        });
        await adapter.revalidate({ tag: TEST_TAG });
        const calledOpts = mockFetch.mock.calls[0]![1] as { body: string };
        expect(JSON.parse(calledOpts.body)).toEqual({ tags: [TEST_TAG] });
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
        const result = await adapter.revalidate({ tag: TEST_TAG });
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
        const resultPromise = adapter.revalidate({ tag: TEST_TAG });
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
        it('makes a single purge call for up to 100 tags and reports the same result for each', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: true, purged: 1 })
            });
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const tags = ['tag-a', 'tag-b', 'tag-c'];
            const results = await adapter.revalidateMany({ tags });
            expect(results).toHaveLength(3);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            for (const r of results) {
                expect(r.success).toBe(true);
            }
        });

        it('chunks a batch over the 100-tags-per-request limit into multiple requests', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: true, purged: 1 })
            });
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const tags = Array.from({ length: 250 }, (_, i) => `tag-${i}`);
            const results = await adapter.revalidateMany({ tags });

            expect(results).toHaveLength(250);
            // 250 tags / 100 per request = 3 requests (100 + 100 + 50)
            expect(mockFetch).toHaveBeenCalledTimes(3);

            const bodies = mockFetch.mock.calls.map(
                (call) => JSON.parse((call[1] as { body: string }).body) as { tags: string[] }
            );
            expect(bodies[0]?.tags).toHaveLength(100);
            expect(bodies[1]?.tags).toHaveLength(100);
            expect(bodies[2]?.tags).toHaveLength(50);
        });

        it('returns failure for every tag when the single purge call fails', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const tags = ['tag-1', 'tag-2', 'tag-3'];
            const results = await adapter.revalidateMany({ tags });
            expect(results).toHaveLength(3);
            for (const r of results) {
                expect(r.success).toBe(false);
                expect(r.error).toContain('502');
            }
        });

        it('returns empty array for empty tags without making fetch calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const results = await adapter.revalidateMany({ tags: [] });
            expect(results).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('echoes input tags into result objects', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: async () => ({ ok: true, purged: 1 })
                })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const tags = ['foo', 'bar', 'baz'];
            const results = await adapter.revalidateMany({ tags });
            expect(results.map((r) => r.target)).toEqual(tags);
        });
    });

    describe('purgeEverything', () => {
        it('POSTs { purgeEverything: true, reason } and returns a result targeting WHOLE_ZONE_TARGET', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ ok: true, purged: 1 })
            });
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const result = await adapter.purgeEverything({ reason: 'deploy' });

            expect(result.success).toBe(true);
            expect(result.target).toBe(WHOLE_ZONE_TARGET);
            const calledOpts = mockFetch.mock.calls[0]![1] as { body: string };
            expect(JSON.parse(calledOpts.body)).toEqual({
                purgeEverything: true,
                reason: 'deploy'
            });
        });

        it('returns failure without throwing when fetch fails', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })
            );
            const adapter = new CloudflareRevalidationAdapter({
                secret: SECRET,
                siteUrl: SITE_URL
            });
            const result = await adapter.purgeEverything({});
            expect(result.success).toBe(false);
            expect(result.target).toBe(WHOLE_ZONE_TARGET);
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
            const result = await adapter.revalidate({ tag: TEST_TAG });
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
            const result = await adapter.revalidate({ tag: TEST_TAG });
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
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.success).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns the tag in the result', async () => {
        const adapter = new NoOpRevalidationAdapter();
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.target).toBe(TEST_TAG);
    });

    it('returns durationMs >= 0', async () => {
        const adapter = new NoOpRevalidationAdapter();
        const result = await adapter.revalidate({ tag: TEST_TAG });
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('has a name property set to NoOpRevalidationAdapter', () => {
        const adapter = new NoOpRevalidationAdapter();
        expect(adapter.name).toBe('NoOpRevalidationAdapter');
    });

    describe('revalidateMany', () => {
        it('returns success for all tags without HTTP calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new NoOpRevalidationAdapter();
            const results = await adapter.revalidateMany({ tags: ['tag-1', 'tag-2', 'tag-3'] });
            expect(results).toHaveLength(3);
            for (const r of results) {
                expect(r.success).toBe(true);
            }
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('returns empty array for empty input', async () => {
            const adapter = new NoOpRevalidationAdapter();
            const results = await adapter.revalidateMany({ tags: [] });
            expect(results).toHaveLength(0);
        });
    });

    describe('purgeEverything', () => {
        it('simulates a successful whole-zone flush without making HTTP calls', async () => {
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const adapter = new NoOpRevalidationAdapter();
            const result = await adapter.purgeEverything({ reason: 'deploy' });
            expect(result.success).toBe(true);
            expect(result.target).toBe(WHOLE_ZONE_TARGET);
            expect(mockFetch).not.toHaveBeenCalled();
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
