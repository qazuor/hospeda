/**
 * Tests for the Umami server client's in-memory bounds (HOS-2119, T-019):
 * the queue cap (oldest events dropped, one warning per overflow burst that
 * counts the drops) and the `flushAt <= maxQueueItems` clamp.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function cap(client: { capture: (i: never) => void }, n = 1): void {
    for (let i = 0; i < n; i++) {
        (client.capture as (i: unknown) => void)({
            distinctId: 'user-1',
            event: 'ai_feature_used',
            properties: { feature: 'x' }
        });
    }
}

function sentBodies(fetchMock: ReturnType<typeof setup>['fetchMock']): unknown[][] {
    return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as unknown[]);
}

describe('createUmamiServerClient bounds', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('queue cap', () => {
        /**
         * A fetch held open until `release()`, so captures pile up behind an
         * in-flight flush: the only way the queue can overflow once
         * `flushAt <= maxQueueItems`.
         */
        function gatedFetch() {
            const releases: Array<() => void> = [];
            const fetchMock = vi.fn<FetchFn>(async (_url, init) => {
                const body = JSON.parse(String(init?.body)) as unknown[];
                await new Promise<void>((resolve) => releases.push(resolve));
                return okResponse(body.length);
            });
            return { fetchMock, release: () => releases.shift()?.() };
        }

        function capFeature(client: { capture: (i: never) => void }, from: number, to: number) {
            for (let i = from; i <= to; i++) {
                (client.capture as (i: unknown) => void)({
                    distinctId: 'user-1',
                    event: 'ai_feature_used',
                    properties: { feature: `f${i}` }
                });
            }
        }

        function overflowWarnings(logger: ReturnType<typeof setup>['logger']) {
            return logger.warn.mock.calls.filter(([m]) => /queue full/i.test(String(m)));
        }

        it('should drop the oldest events with ONE warning that counts the burst, never throwing', async () => {
            const gate = gatedFetch();
            const { client, logger } = setup({
                fetch: gate.fetchMock,
                maxQueueItems: 3,
                flushAt: 1
            });
            capFeature(client, 1, 1); // f1 goes out and stays in flight
            await vi.advanceTimersByTimeAsync(0);
            expect(() => capFeature(client, 2, 7)).not.toThrow(); // f2..f4 dropped

            gate.release();
            await vi.advanceTimersByTimeAsync(0);
            gate.release();
            await client.flush();

            const bodies = sentBodies(gate.fetchMock) as {
                payload: { data: { feature: string } };
            }[][];
            expect(bodies.map((b) => b.map((i) => i.payload.data.feature))).toEqual([
                ['f1'],
                ['f5', 'f6', 'f7']
            ]);
            expect(overflowWarnings(logger)).toEqual([
                ['Umami queue full, dropped oldest events', { maxQueueItems: 3, dropped: 3 }]
            ]);
        });

        it('should warn again, with its own count, for a new burst after a flush', async () => {
            const gate = gatedFetch();
            const { client, logger } = setup({
                fetch: gate.fetchMock,
                maxQueueItems: 1,
                flushAt: 1
            });
            capFeature(client, 1, 4); // f1 in flight, f2 and f3 dropped
            await vi.advanceTimersByTimeAsync(0);
            gate.release();
            await vi.advanceTimersByTimeAsync(0);
            capFeature(client, 5, 6); // f4 in flight, f5 dropped
            gate.release();
            await vi.advanceTimersByTimeAsync(0);
            gate.release();
            await vi.advanceTimersByTimeAsync(0);
            gate.release();
            await client.flush();

            const counts = overflowWarnings(logger).map(
                ([, ctx]) => (ctx as { dropped: number }).dropped
            );
            expect(counts).toEqual([2, 1]);
        });

        it('should report a burst on shutdown even when the deadline cuts the flush', async () => {
            const gate = gatedFetch();
            const { client, logger } = setup({
                fetch: gate.fetchMock,
                maxQueueItems: 1,
                flushAt: 1
            });
            capFeature(client, 1, 3); // f1 in flight forever, f2 dropped
            await vi.advanceTimersByTimeAsync(0);

            const done = client.shutdown({ timeoutMs: 100 });
            await vi.advanceTimersByTimeAsync(100);
            await done;

            expect(overflowWarnings(logger).map(([, ctx]) => ctx)).toEqual([
                { maxQueueItems: 1, dropped: 1 }
            ]);
        });

        it('should not warn when nothing overflowed', async () => {
            const { client, logger } = setup({ maxQueueItems: 10, flushAt: 10 });
            cap(client, 10);
            await client.flush();
            expect(overflowWarnings(logger)).toHaveLength(0);
        });
    });

    describe('flushAt validation', () => {
        it('should clamp flushAt to maxQueueItems with a warning, so the queue still flushes', async () => {
            const { client, fetchMock, logger } = setup({ flushAt: 50, maxQueueItems: 5 });
            expect(logger.warn).toHaveBeenCalledWith(
                'Umami flushAt exceeds maxQueueItems, clamped',
                { flushAt: 50, maxQueueItems: 5 }
            );

            cap(client, 5);
            await vi.advanceTimersByTimeAsync(0);

            expect(sentBodies(fetchMock).map((b) => b.length)).toEqual([5]);
            expect(logger.warn.mock.calls.filter(([m]) => /queue full/i.test(String(m)))).toEqual(
                []
            );
        });

        it('should keep a flushAt within maxQueueItems untouched and silent', () => {
            const { logger } = setup({ flushAt: 5, maxQueueItems: 5 });
            expect(logger.warn).not.toHaveBeenCalled();
        });
    });
});
