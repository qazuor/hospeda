/**
 * Performance Stack Integration Tests
 *
 * Exercises the complete middleware stack under concurrent and sustained load
 * and checks that it stays correct (statuses, request ids, formatting, metrics)
 * and responsive.
 *
 * The latency budgets are deliberately an order of magnitude above what the
 * in-process app needs (a few ms per request). They exist to catch a hang or a
 * pathological slowdown, not to benchmark: a tighter wall-clock threshold on a
 * shared CI runner is a flake, not a regression signal.
 *
 * Endpoint choice matters for what each test can claim:
 * - `/health/ready` is public and cached (a cache HIT is served before the
 *   metrics middleware and replays the first response), so it is used where
 *   only "answers 200 under load" matters.
 * - `GET /api/v1/admin/accommodations` without a session answers 401 and is
 *   never cached, so it is used where every response must be a fresh request
 *   (unique request ids, exact metric counts).
 */

import { RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { resetMetrics } from '../../src/middlewares/metrics';
import { validateApiEnv } from '../../src/utils/env';
import { testDb } from '../e2e/setup/test-database';
import {
    ADMIN_GATE_PERMISSIONS,
    buildMockActorHeaders,
    createMockActorUser
} from './helpers/mock-actor';
import { seedPublicAccommodation } from './helpers/seed-public-accommodation';

const READY = '/health/ready';
const UNCACHED_401 = '/api/v1/admin/accommodations';
const METRICS = '/api/v1/admin/metrics';

/** Budget for one request. A hang or a pathological slowdown, not a benchmark. */
const MAX_REQUEST_MS = 3000;
/** Budget for a whole batch of concurrent requests. */
const MAX_BATCH_MS = 10000;

/** Timing and outcome of one request. */
interface TimedResponse {
    readonly response: Response;
    readonly elapsedMs: number;
}

/** Runs one request and measures how long it took to settle. */
const timed = async ({
    run
}: {
    readonly run: () => Promise<Response>;
}): Promise<TimedResponse> => {
    const start = performance.now();
    const response = await run();
    return { response, elapsedMs: performance.now() - start };
};

/** Fires every request at once and reports each timing plus the batch duration. */
const fireBatch = async ({
    runs
}: {
    readonly runs: readonly (() => Promise<Response>)[];
}): Promise<{ readonly results: readonly TimedResponse[]; readonly batchMs: number }> => {
    const start = performance.now();
    const results = await Promise.all(runs.map((run) => timed({ run })));
    return { results, batchMs: performance.now() - start };
};

describe('Performance Stack Integration', () => {
    let app: ReturnType<typeof initApp>;
    let adminHeaders: Record<string, string>;

    const publicHeaders = (userAgent: string): Record<string, string> => ({
        'user-agent': userAgent,
        accept: 'application/json'
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
        const admin = await createMockActorUser({ label: 'perf-stack-admin' });
        adminHeaders = buildMockActorHeaders({
            actorId: admin.id,
            permissions: ADMIN_GATE_PERMISSIONS,
            role: RoleEnum.ADMIN
        });
    });

    beforeEach(() => {
        clearCache();
        resetMetrics();
    });

    afterAll(async () => {
        await testDb.clean();
        clearCache();
        await testDb.teardown();
    });

    describe('Single Request Performance', () => {
        it('should answer each system endpoint quickly with the full stack applied', async () => {
            const bare = await timed({
                run: () =>
                    app.request('/health', { headers: publicHeaders('performance-test/1.0') })
            });
            expect(bare.response.status).toBe(200);
            expect((await bare.response.json()).status).toBe('ok');
            expect(bare.elapsedMs).toBeLessThan(MAX_REQUEST_MS);

            const ready = await timed({
                run: () => app.request(READY, { headers: publicHeaders('performance-test/1.0') })
            });
            expect(ready.response.status).toBe(200);
            expect(ready.response.headers.get('x-request-id')).toBeTruthy();
            expect(ready.elapsedMs).toBeLessThan(MAX_REQUEST_MS);

            const metrics = await timed({
                run: () => app.request(METRICS, { headers: adminHeaders })
            });
            expect(metrics.response.status).toBe(200);
            expect(metrics.response.headers.get('x-request-id')).toBeTruthy();
            expect(metrics.elapsedMs).toBeLessThan(MAX_REQUEST_MS);
        });
    });

    describe('Concurrent Request Performance', () => {
        it('should keep every response correct and distinct under moderate concurrent load', async () => {
            const { results, batchMs } = await fireBatch({
                runs: Array.from(
                    { length: 10 },
                    (_, i) => () =>
                        app.request(UNCACHED_401, {
                            headers: publicHeaders(`concurrent-test-${i}/1.0`)
                        })
                )
            });

            expect(batchMs).toBeLessThan(MAX_BATCH_MS);
            for (const { response, elapsedMs } of results) {
                expect(response.status).toBe(401);
                expect(response.headers.get('x-content-type-options')).toBe('nosniff');
                expect(elapsedMs).toBeLessThan(MAX_REQUEST_MS);
            }
            const ids = results.map(({ response }) => response.headers.get('x-request-id'));
            expect(ids.every(Boolean)).toBe(true);
            expect(new Set(ids).size).toBe(10);
        });

        it('should handle burst traffic gracefully', async () => {
            const { results, batchMs } = await fireBatch({
                runs: Array.from(
                    { length: 20 },
                    (_, i) => () =>
                        app.request(READY, { headers: publicHeaders(`burst-test-${i}/1.0`) })
                )
            });

            expect(batchMs).toBeLessThan(MAX_BATCH_MS);
            for (const { response } of results) {
                expect(response.status).toBe(200);
            }
        });
    });

    describe('Mixed Workload Performance', () => {
        it('should handle different endpoint types efficiently', async () => {
            const seeded = await seedPublicAccommodation();
            const workload = [
                ...Array.from({ length: 5 }, (_, i) => ({
                    path: READY,
                    headers: publicHeaders(`health-check-${i}/1.0`),
                    status: 200
                })),
                ...Array.from({ length: 3 }, () => ({
                    path: METRICS,
                    headers: adminHeaders,
                    status: 200
                })),
                ...Array.from({ length: 2 }, (_, i) => ({
                    path: '/api/v1/public/accommodations',
                    headers: publicHeaders(`api-call-${i}/1.0`),
                    status: 200
                }))
            ];

            const { results, batchMs } = await fireBatch({
                runs: workload.map(
                    ({ path, headers }) =>
                        () =>
                            app.request(path, { headers })
                )
            });

            expect(batchMs).toBeLessThan(MAX_BATCH_MS);
            results.forEach(({ response }, index) => {
                expect(response.status).toBe(workload[index]?.status);
            });
            const listResponse = results[workload.length - 1]?.response;
            const listBody = await listResponse?.json();
            expect(listBody.data.items.map((item: { id: string }) => item.id)).toEqual([seeded.id]);
        });
    });

    describe('Error Handling Performance', () => {
        it('should handle validation errors quickly and keep them formatted', async () => {
            const { results, batchMs } = await fireBatch({
                runs: Array.from(
                    { length: 10 },
                    () => () =>
                        // Missing user-agent triggers the header validation error
                        app.request(READY, { headers: { accept: 'application/json' } })
                )
            });

            expect(batchMs).toBeLessThan(MAX_BATCH_MS);
            for (const { response, elapsedMs } of results) {
                expect(response.status).toBe(400);
                expect(elapsedMs).toBeLessThan(MAX_REQUEST_MS);
                const data = await response.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
                expect(data.metadata.requestId).toBe(response.headers.get('x-request-id'));
            }
        });
    });

    describe('Middleware Stack Performance Analysis', () => {
        it('should count every uncached request exactly in the admin metrics', async () => {
            await fireBatch({
                runs: Array.from(
                    { length: 15 },
                    (_, i) => () =>
                        app.request(UNCACHED_401, {
                            headers: publicHeaders(`metrics-load-${i}/1.0`)
                        })
                )
            });

            const start = performance.now();
            const res = await app.request(METRICS, { headers: adminHeaders });
            expect(performance.now() - start).toBeLessThan(MAX_REQUEST_MS);

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            const endpoint = body.data.endpoints.find(
                (item: { endpoint: string }) => item.endpoint === `GET ${UNCACHED_401}`
            );
            expect(endpoint).toMatchObject({ requests: 15, errors: 15, errorRate: 100 });
            expect(body.data.summary.totalRequests).toBeGreaterThanOrEqual(15);
        });
    });

    describe('Sustained load', () => {
        it('should stay correct across consecutive batches', async () => {
            const allIds = new Set<string>();
            const times: number[] = [];

            for (let batch = 0; batch < 5; batch++) {
                const { results } = await fireBatch({
                    runs: Array.from(
                        { length: 5 },
                        (_, i) => () =>
                            app.request(UNCACHED_401, {
                                headers: publicHeaders(`sustained-${batch}-${i}/1.0`)
                            })
                    )
                });
                for (const { response, elapsedMs } of results) {
                    expect(response.status).toBe(401);
                    allIds.add(response.headers.get('x-request-id') ?? '');
                    times.push(elapsedMs);
                }
            }

            expect(allIds.size).toBe(25);
            expect(allIds.has('')).toBe(false);
            const average = times.reduce((sum, value) => sum + value, 0) / times.length;
            expect(average).toBeLessThan(MAX_REQUEST_MS);
            expect(Math.max(...times)).toBeLessThan(MAX_BATCH_MS);
        });
    });

    describe('Middleware Overhead Analysis', () => {
        it('should apply the whole stack to every request in a batch', async () => {
            const { results } = await fireBatch({
                runs: Array.from(
                    { length: 8 },
                    (_, i) => () =>
                        app.request(READY, { headers: publicHeaders(`overhead-test-${i}/1.0`) })
                )
            });

            for (const { response } of results) {
                expect(response.status).toBe(200);
                expect(response.headers.get('x-content-type-options')).toBe('nosniff');
                expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
                expect(response.headers.get('x-request-id')).toBeTruthy();
                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.data.ready).toBe(true);
                expect(data.metadata.timestamp).toBeDefined();
            }
        });
    });
});
