import { BillingIntervalEnum, BillingSchemeEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import {
    PERFORMANCE_THRESHOLDS,
    calculateMetrics,
    formatMetrics,
    measureConcurrent,
    measureRequest
} from '../../helpers/performance-utils.js';
import { createTestClient, createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * E2E Performance Tests: Concurrent Load
 *
 * Tests API behavior under concurrent load:
 * - 10 concurrent requests
 * - 25 concurrent requests
 * - 50 concurrent requests
 * - Mixed read/write operations
 * - Success rate should remain >= 99%
 */
describe('E2E Performance: Concurrent Load', () => {
    let app: ReturnType<typeof initApp>;
    let actor: ReturnType<typeof createMockAdminActor>;
    let testClient: any;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create test user for actor
        const testUser = await createTestUser({
            role: RoleEnum.ADMIN
        });

        actor = createMockAdminActor({ id: testUser.id });

        // Create base test data
        testClient = await createTestClient({
            name: 'Concurrent Test Client',
            billingEmail: 'concurrent-test@e2e-test.com'
        });

        // Create test plan for subscription tests (used indirectly)
        await createTestPlan({
            billingScheme: BillingSchemeEnum.RECURRING,
            interval: BillingIntervalEnum.MONTH,
            amount: 1000,
            currency: 'ARS'
        });
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('Concurrent GET Requests', () => {
        it('should handle 10 concurrent GET requests', async () => {
            const results = await measureConcurrent(
                app,
                'GET',
                `/api/v1/clients/${testClient.id}`,
                actor,
                10
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '10 Concurrent GET Requests'));

            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
        });

        it('should handle 25 concurrent GET requests', async () => {
            const results = await measureConcurrent(
                app,
                'GET',
                `/api/v1/clients/${testClient.id}`,
                actor,
                25
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '25 Concurrent GET Requests'));

            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
        });

        it('should handle 50 concurrent GET requests', async () => {
            const results = await measureConcurrent(
                app,
                'GET',
                `/api/v1/clients/${testClient.id}`,
                actor,
                50
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '50 Concurrent GET Requests'));

            // Higher concurrency may have slightly lower success rate
            expect(metrics.successRate).toBeGreaterThanOrEqual(95);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST * 2);
        });
    });

    describe('Concurrent LIST Requests', () => {
        it('should handle 10 concurrent LIST requests', async () => {
            const results = await measureConcurrent(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                10
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '10 Concurrent LIST Requests'));

            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
        });

        it('should handle 25 concurrent LIST requests', async () => {
            const results = await measureConcurrent(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                25
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '25 Concurrent LIST Requests'));

            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
        });
    });

    describe('Concurrent Write Requests', () => {
        it('should handle 10 concurrent client creations', async () => {
            const promises = [];

            for (let i = 0; i < 10; i++) {
                promises.push(
                    measureRequest(app, 'POST', '/api/v1/clients', actor, {
                        name: `Concurrent Write Test ${Date.now()}-${i}`,
                        billingEmail: `concurrent-write-${Date.now()}-${i}@test.com`,
                        userId: null
                    })
                );
            }

            const results = await Promise.all(promises);
            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '10 Concurrent Client Creations'));

            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
        });
    });

    describe('Mixed Read/Write Load', () => {
        it('should handle mixed concurrent operations', async () => {
            const promises: Promise<any>[] = [];

            // 5 GET requests
            for (let i = 0; i < 5; i++) {
                promises.push(
                    measureRequest(app, 'GET', `/api/v1/clients/${testClient.id}`, actor).then(
                        (r) => ({
                            ...r,
                            type: 'GET'
                        })
                    )
                );
            }

            // 3 LIST requests
            for (let i = 0; i < 3; i++) {
                promises.push(
                    measureRequest(app, 'GET', '/api/v1/clients?page=1&pageSize=10', actor).then(
                        (r) => ({
                            ...r,
                            type: 'LIST'
                        })
                    )
                );
            }

            // 2 POST requests
            for (let i = 0; i < 2; i++) {
                promises.push(
                    measureRequest(app, 'POST', '/api/v1/clients', actor, {
                        name: `Mixed Load Test ${Date.now()}-${i}`,
                        billingEmail: `mixed-load-${Date.now()}-${i}@test.com`,
                        userId: null
                    }).then((r) => ({ ...r, type: 'POST' }))
                );
            }

            const allResults = await Promise.all(promises);

            // Group by type for analysis
            const byType: Record<string, any[]> = { GET: [], LIST: [], POST: [] };
            for (const r of allResults) {
                const typeKey = r.type as string;
                if (byType[typeKey]) {
                    byType[typeKey].push(r);
                }
            }

            console.info('\nMixed Load Results by Type:');
            for (const [type, typeResults] of Object.entries(byType)) {
                const metrics = calculateMetrics(typeResults);
                console.info(
                    `  ${type}: avg=${metrics.avg.toFixed(2)}ms, success=${metrics.successRate}%`
                );
            }

            const overallMetrics = calculateMetrics(allResults);
            console.info(formatMetrics(overallMetrics, 'Mixed Load (Overall)'));

            expect(overallMetrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });

    describe('Sustained Load', () => {
        it('should maintain performance over 100 sequential requests', async () => {
            const results: any[] = [];

            for (let i = 0; i < 100; i++) {
                const result = await measureRequest(
                    app,
                    'GET',
                    `/api/v1/clients/${testClient.id}`,
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, '100 Sequential Requests'));

            // Check for performance degradation
            const firstHalf = results.slice(0, 50);
            const secondHalf = results.slice(50);

            const firstHalfMetrics = calculateMetrics(firstHalf);
            const secondHalfMetrics = calculateMetrics(secondHalf);

            console.info(`First 50 avg: ${firstHalfMetrics.avg.toFixed(2)}ms`);
            console.info(`Last 50 avg: ${secondHalfMetrics.avg.toFixed(2)}ms`);

            // Second half should not be more than 2x slower than first half
            expect(secondHalfMetrics.avg).toBeLessThan(firstHalfMetrics.avg * 2);
            expect(metrics.successRate).toBe(100);
        });
    });
});
