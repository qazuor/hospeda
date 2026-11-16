/**
 * Tests for the Umami server client (HOS-2119, T-019).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UMAMI_SYNTHETIC_USER_AGENT } from '../src/providers/umami-payload.js';
import { createUmamiServerClient } from '../src/providers/umami-server.js';

const URL_BASE = 'https://umami.example.com';
const WEBSITE = '11111111-2222-4333-8444-555555555555';
const HOSTNAME = 'api.hospeda.com.ar';

type FetchFn = typeof fetch;

function okResponse(size: number): Response {
    return new Response(JSON.stringify({ size, processed: size, errors: 0, details: [] }), {
        status: 200
    });
}

function setup(overrides: Record<string, unknown> = {}) {
    const fetchMock = vi.fn<FetchFn>(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as unknown[];
        return okResponse(body.length);
    });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const client = createUmamiServerClient({
        url: URL_BASE,
        websiteId: WEBSITE,
        hostname: HOSTNAME,
        fetch: fetchMock,
        logger,
        ...overrides
    });
    return { fetchMock, logger, client };
}

function cap(client: { capture: (i: never) => void }, n = 1, event = 'ai_feature_used'): void {
    for (let i = 0; i < n; i++) {
        (client.capture as (i: unknown) => void)({
            distinctId: 'user-1',
            event,
            properties: { feature: 'x' }
        });
    }
}

function sentBodies(fetchMock: ReturnType<typeof setup>['fetchMock']): unknown[][] {
    return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as unknown[]);
}

describe('createUmamiServerClient', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('request shape', () => {
        it('should POST the mapped array with the synthetic user agent', async () => {
            const { client, fetchMock } = setup();
            client.capture({
                distinctId: 'user-1',
                event: 'ai_feature_used',
                properties: { feature: 'x' },
                uuid: 'u-1',
                timestamp: new Date('2026-01-01T00:00:00Z')
            });
            await client.flush();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0] ?? [];
            expect(url).toBe(`${URL_BASE}/api/batch`);
            expect(init?.method).toBe('POST');
            expect(init?.headers).toEqual({
                'Content-Type': 'application/json',
                'User-Agent': UMAMI_SYNTHETIC_USER_AGENT
            });
            expect(JSON.parse(String(init?.body))).toEqual([
                {
                    type: 'event',
                    payload: {
                        website: WEBSITE,
                        hostname: HOSTNAME,
                        url: '/_server/ai_feature_used',
                        name: 'ai_feature_used',
                        data: { feature: 'x', user_id: 'user-1', event_uuid: 'u-1' },
                        ip: '127.0.0.1',
                        userAgent: UMAMI_SYNTHETIC_USER_AGENT,
                        timestamp: 1767225600
                    }
                }
            ]);
        });

        it('should strip trailing slashes from the url', async () => {
            const { client, fetchMock } = setup({ url: `${URL_BASE}/` });
            cap(client);
            await client.flush();
            expect(fetchMock.mock.calls[0]?.[0]).toBe(`${URL_BASE}/api/batch`);
        });
    });

    describe('visitor attribution', () => {
        const SYNTHETIC = { ip: '127.0.0.1', userAgent: UMAMI_SYNTHETIC_USER_AGENT };

        async function sendOne(visitor?: unknown) {
            const { client, fetchMock } = setup();
            (client.capture as (i: unknown) => void)({
                distinctId: 'user-1',
                event: 'ai_feature_used',
                properties: { feature: 'x' },
                ...(visitor === undefined ? {} : { visitor })
            });
            await client.flush();
            return sentBodies(fetchMock)[0]?.[0] as {
                payload: { ip: string; userAgent: string; data: unknown };
            };
        }

        it('should send the visitor ip and user agent and keep them out of data', async () => {
            const item = await sendOne({
                ip: '203.0.113.9',
                userAgent:
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
            });
            expect(item.payload.ip).toBe('203.0.113.9');
            expect(item.payload.userAgent).toBe(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
            );
            expect(item.payload.data).toEqual({ feature: 'x', user_id: 'user-1' });
        });

        it('should forward a valid IPv6 visitor ip', async () => {
            const item = await sendOne({
                ip: '2001:db8::1',
                userAgent:
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
            });
            expect(item.payload.ip).toBe('2001:db8::1');
            expect(item.payload.userAgent).toBe(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
            );
        });

        it('should use the synthetic identity without a visitor', async () => {
            const item = await sendOne();
            expect({ ip: item.payload.ip, userAgent: item.payload.userAgent }).toEqual(SYNTHETIC);
        });

        it.each([
            ['empty ip', { ip: '', userAgent: 'Mozilla/5.0' }],
            ['600-char user agent', { ip: '1.1.1.1', userAgent: 'a'.repeat(600) }],
            ['65-char ip', { ip: '1'.repeat(65), userAgent: 'Mozilla/5.0' }],
            ['non-ip text "not-an-ip"', { ip: 'not-an-ip', userAgent: 'Mozilla/5.0' }],
            ['non-ip text "unknown"', { ip: 'unknown', userAgent: 'Mozilla/5.0' }]
        ])('should fall back to synthetic and still send when %s', async (_label, visitor) => {
            const item = await sendOne(visitor);
            expect(item).toBeDefined();
            expect({ ip: item.payload.ip, userAgent: item.payload.userAgent }).toEqual(SYNTHETIC);
            expect(item.payload.data).toEqual({ feature: 'x', user_id: 'user-1' });
        });
    });

    describe('flush triggers', () => {
        it('should flush when the queue reaches flushAt', async () => {
            const { client, fetchMock } = setup({ flushAt: 3 });
            cap(client, 2);
            expect(fetchMock).not.toHaveBeenCalled();
            cap(client, 1);
            await vi.advanceTimersByTimeAsync(0);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(sentBodies(fetchMock)[0]).toHaveLength(3);
        });

        it('should flush on the interval timer', async () => {
            const { client, fetchMock } = setup({ flushIntervalMs: 10_000 });
            cap(client, 2);
            await vi.advanceTimersByTimeAsync(10_000);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(sentBodies(fetchMock)[0]).toHaveLength(2);
        });

        it('should flush on shutdown and clear the timer', async () => {
            const { client, fetchMock } = setup();
            cap(client, 2);
            await client.shutdown();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('should bound shutdown by the timeout when fetch hangs', async () => {
            const fetchMock = vi.fn<FetchFn>(() => new Promise<Response>(() => {}));
            const { client } = setup({ fetch: fetchMock });
            cap(client);
            let done = false;
            const p = client.shutdown({ timeoutMs: 3000 }).then(() => {
                done = true;
            });
            await vi.advanceTimersByTimeAsync(2999);
            expect(done).toBe(false);
            await vi.advanceTimersByTimeAsync(2);
            await p;
            expect(done).toBe(true);
        });

        it('should make capture a no-op after shutdown', async () => {
            const { client, fetchMock } = setup();
            await client.shutdown();
            cap(client, 5);
            await client.flush();
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('failures', () => {
        it('should log once and not throw on 5xx', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(new Response('boom', { status: 503 }));
            expect(() => cap(client, 3)).not.toThrow();
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
            const text = JSON.stringify(logger.error.mock.calls[0]);
            expect(text).toContain('503');
            expect(text).not.toContain('ai_feature_used');
        });

        it('should log once on a network error', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockRejectedValue(new TypeError('fetch failed'));
            cap(client, 2);
            await expect(client.flush()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should abort a slow request after timeoutMs without throwing', async () => {
            const fetchMock = vi.fn<FetchFn>(
                (_u, init) =>
                    new Promise<Response>((_res, rej) => {
                        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
                    })
            );
            const { client, logger } = setup({ fetch: fetchMock, timeoutMs: 1000 });
            cap(client);
            const p = client.flush();
            await vi.advanceTimersByTimeAsync(1000);
            await expect(p).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should drop a failed chunk without retrying', async () => {
            const { client, fetchMock } = setup();
            fetchMock.mockResolvedValue(new Response('x', { status: 500 }));
            cap(client);
            await client.flush();
            await client.flush();
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should log a partial failure on HTTP 200 with processed < size', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        size: 2,
                        processed: 1,
                        errors: 1,
                        details: ['bad event A', 'bad event B']
                    }),
                    { status: 200 }
                )
            );
            cap(client, 2);
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
            const text = JSON.stringify(logger.error.mock.calls[0]);
            expect(text).toContain('bad event A');
            expect(text).toContain('processed');
        });

        it('should redact ip and userAgent echoed back in details before logging', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        size: 1,
                        processed: 0,
                        errors: 1,
                        details: [
                            {
                                ip: '203.0.113.7',
                                user_agent: 'UA-secret/1',
                                payload: { ip: '198.51.100.9', userAgent: 'UA-secret/2', url: '/x' }
                            }
                        ]
                    }),
                    { status: 200 }
                )
            );
            cap(client);
            await client.flush();
            const text = JSON.stringify(logger.error.mock.calls[0]);
            expect(text).toContain('[redacted]');
            expect(text).toContain('/x');
            expect(text).not.toContain('203.0.113.7');
            expect(text).not.toContain('198.51.100.9');
            expect(text).not.toContain('UA-secret');
        });

        it('should log when only processed < size signals the loss', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(
                new Response(JSON.stringify({ size: 2, processed: 1, errors: 0, details: [] }), {
                    status: 200
                })
            );
            cap(client, 2);
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should log when details is non-empty even if counts match', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(
                new Response(
                    JSON.stringify({ size: 1, processed: 1, errors: 0, details: ['odd'] }),
                    { status: 200 }
                )
            );
            cap(client);
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should log when errors > 0 even if processed equals size', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(
                new Response(JSON.stringify({ size: 1, processed: 1, errors: 1, details: [] }), {
                    status: 200
                })
            );
            cap(client);
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should log on a 200 with an unparseable body', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
            cap(client);
            await client.flush();
            expect(logger.error).toHaveBeenCalledTimes(1);
        });

        it('should report the real status on a 2xx with an unparseable body', async () => {
            const { client, logger, fetchMock } = setup();
            fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
            cap(client);
            await client.flush();
            const text = JSON.stringify(logger.error.mock.calls[0]);
            expect(text).toContain('HTTP 204');
            expect(text).not.toContain('HTTP 200');
        });

        it('should not log on a clean 200', async () => {
            const { client, logger } = setup();
            cap(client, 2);
            await client.flush();
            expect(logger.error).not.toHaveBeenCalled();
            expect(logger.warn).not.toHaveBeenCalled();
        });
    });

    describe('chunking', () => {
        it('should split 1001 events into 500/500/1', async () => {
            const { client, fetchMock } = setup({ flushAt: 100_000, maxQueueItems: 100_000 });
            cap(client, 1001);
            await client.flush();
            expect(sentBodies(fetchMock).map((b) => b.length)).toEqual([500, 500, 1]);
        });

        it('should split by bytes', async () => {
            const probe = setup();
            cap(probe.client);
            await probe.client.flush();
            const oneItem = JSON.stringify(sentBodies(probe.fetchMock)[0]?.[0]).length;

            const { client, fetchMock, logger } = setup({
                flushAt: 100_000,
                maxBatchBytes: oneItem * 2 + 3
            });
            cap(client, 5);
            await client.flush();
            expect(sentBodies(fetchMock).map((b) => b.length)).toEqual([2, 2, 1]);
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should measure the byte cap in UTF-8 bytes, not string length', async () => {
            const multibyte = (client: { capture: (i: never) => void }, n: number): void => {
                for (let i = 0; i < n; i++) {
                    (client.capture as (i: unknown) => void)({
                        distinctId: 'user-1',
                        event: 'ai_feature_used',
                        properties: { feature: 'ñ'.repeat(40) }
                    });
                }
            };
            const probe = setup();
            multibyte(probe.client, 1);
            await probe.client.flush();
            const json = JSON.stringify(sentBodies(probe.fetchMock)[0]?.[0]);
            const lengthOne = json.length;
            const bytesOne = new TextEncoder().encode(json).byteLength;
            expect(bytesOne).toBeGreaterThan(lengthOne + 30);

            // Two items fit by string length, but not by bytes.
            const { client, fetchMock } = setup({
                flushAt: 100_000,
                maxBatchBytes: lengthOne * 2 + 3 + 10
            });
            multibyte(client, 5);
            await client.flush();
            expect(sentBodies(fetchMock).map((b) => b.length)).toEqual([1, 1, 1, 1, 1]);
        });

        it('should drop a single item larger than the byte cap and log it', async () => {
            const { client, fetchMock, logger } = setup({ maxBatchBytes: 50 });
            cap(client);
            await client.flush();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });
    });

    describe('mapper integration', () => {
        it('should log mapper warnings once per flush, aggregated', async () => {
            const { client, logger } = setup();
            for (let i = 0; i < 3; i++) {
                client.capture({
                    distinctId: 'user-1',
                    event: 'ai_feature_used',
                    properties: { bad: Number.POSITIVE_INFINITY }
                });
            }
            await client.flush();
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });

        it('should drop an event the mapper rejects, log it, and keep the rest', async () => {
            const { client, logger, fetchMock } = setup();
            expect(() =>
                client.capture({ distinctId: 'user-1', event: '  ', properties: {} })
            ).not.toThrow();
            cap(client);
            await client.flush();
            expect(sentBodies(fetchMock)[0]).toHaveLength(1);
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });
    });

    describe('concurrency', () => {
        it('should not send the same item twice across concurrent flushes', async () => {
            let release: () => void = () => {};
            const gate = new Promise<void>((r) => {
                release = r;
            });
            const fetchMock = vi.fn<FetchFn>(async (_u, init) => {
                await gate;
                return okResponse((JSON.parse(String(init?.body)) as unknown[]).length);
            });
            const { client } = setup({ fetch: fetchMock, flushAt: 2 });
            cap(client, 2);
            await vi.advanceTimersByTimeAsync(0);
            cap(client, 2);
            await vi.advanceTimersByTimeAsync(0);
            const extra = client.flush();
            release();
            await extra;
            await client.shutdown();
            const total = sentBodies(fetchMock).reduce((n, b) => n + b.length, 0);
            expect(total).toBe(4);
        });

        it('should make shutdown await the in-flight flush', async () => {
            let release: () => void = () => {};
            const gate = new Promise<void>((r) => {
                release = r;
            });
            let finished = false;
            const fetchMock = vi.fn<FetchFn>(async () => {
                await gate;
                finished = true;
                return okResponse(1);
            });
            const { client } = setup({ fetch: fetchMock, flushAt: 1 });
            cap(client);
            await vi.advanceTimersByTimeAsync(0);
            let resolved = false;
            const p = client.shutdown({ timeoutMs: 3000 }).then(() => {
                resolved = true;
            });
            await vi.advanceTimersByTimeAsync(0);
            expect(resolved).toBe(false);
            expect(finished).toBe(false);
            release();
            await p;
            expect(resolved).toBe(true);
            expect(finished).toBe(true);
        });

        it('should keep at most one request in flight and clean up on shutdown', async () => {
            let live = 0;
            let maxLive = 0;
            const signals: AbortSignal[] = [];
            const fetchMock = vi.fn<FetchFn>(
                (_u, init) =>
                    new Promise<Response>((_res, rej) => {
                        live++;
                        maxLive = Math.max(maxLive, live);
                        const signal = init?.signal as AbortSignal;
                        signals.push(signal);
                        signal.addEventListener('abort', () => {
                            live--;
                            rej(new Error('aborted'));
                        });
                    })
            );
            const { client } = setup({ fetch: fetchMock, flushAt: 20 });
            cap(client, 2000);
            await vi.advanceTimersByTimeAsync(0);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(maxLive).toBe(1);

            const p = client.shutdown({ timeoutMs: 1000 });
            await vi.advanceTimersByTimeAsync(1000);
            await p;
            expect(vi.getTimerCount()).toBe(0);
            expect(signals.every((s) => s.aborted)).toBe(true);
            await vi.advanceTimersByTimeAsync(0);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(maxLive).toBe(1);
        });

        it('should return the first shutdown promise on a second call', async () => {
            const { client } = setup();
            cap(client);
            const first = client.shutdown();
            const second = client.shutdown();
            expect(second).toBe(first);
            await first;
        });
    });

    describe('notes buffer', () => {
        it('should log and cap notes when every capture fails, without fetching', async () => {
            const { client, logger, fetchMock } = setup();
            for (let i = 0; i < 1000; i++) {
                client.capture({ distinctId: 'user-1', event: '  ', properties: {} });
            }
            await vi.advanceTimersByTimeAsync(10_000);
            expect(logger.warn).toHaveBeenCalledTimes(1);
            const ctx = logger.warn.mock.calls[0]?.[1] as { count: number; dropped: number };
            expect(ctx.count).toBe(50);
            expect(ctx.dropped).toBe(950);
            expect(fetchMock).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(10_000);
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });
    });

    describe('no-op client', () => {
        it.each([
            { url: '', websiteId: WEBSITE },
            { url: '  ', websiteId: WEBSITE },
            { url: URL_BASE, websiteId: '' },
            { url: undefined, websiteId: WEBSITE },
            { url: URL_BASE, websiteId: undefined }
        ])('should do nothing when config is %j', async (cfg) => {
            const { client, fetchMock } = setup(cfg);
            expect(vi.getTimerCount()).toBe(0);
            cap(client, 30);
            await client.flush();
            await client.shutdown();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        });
    });
});
