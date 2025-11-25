import { BillingIntervalEnum, BillingSchemeEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import {
    PERFORMANCE_THRESHOLDS,
    calculateMetrics,
    formatMetrics,
    measureRequest,
    runLoadTest,
    runPublicLoadTest
} from '../../helpers/performance-utils.js';
import {
    createTestClient,
    createTestPlan,
    createTestSubscription,
    createTestUser
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * E2E Performance Tests: API Response Times
 *
 * Tests API response times against defined thresholds:
 * - Simple GET requests: < 100ms avg
 * - List/paginated requests: < 200ms avg
 * - Complex queries: < 300ms avg
 * - Write operations: < 200ms avg
 * - P95 should be < 2x average
 * - No single request > 1000ms
 * - Success rate >= 99%
 */
describe('E2E Performance: API Response Times', () => {
    let app: ReturnType<typeof initApp>;
    let actor: ReturnType<typeof createMockAdminActor>;
    let testClient: any;
    let testPlan: any;
    let testSubscription: any;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create test user for actor
        const testUser = await createTestUser({
            role: RoleEnum.ADMIN
        });

        actor = createMockAdminActor({ id: testUser.id });

        // Create test data for performance tests
        testClient = await createTestClient({
            name: 'Performance Test Client',
            billingEmail: 'perf-test@e2e-test.com'
        });

        testPlan = await createTestPlan({
            billingScheme: BillingSchemeEnum.RECURRING,
            interval: BillingIntervalEnum.MONTH,
            amount: 1000,
            currency: 'ARS'
        });

        testSubscription = await createTestSubscription(testClient.id, testPlan.id);
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('Simple GET Requests', () => {
        it('should respond to health check within threshold', async () => {
            const iterations = 10;
            // Health check is a public endpoint at /health, no auth required
            const results = await runPublicLoadTest(app, 'GET', '/health', iterations, 1);

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Health Check'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should respond to single client GET within threshold', async () => {
            const iterations = 10;
            const results = await runLoadTest(
                app,
                'GET',
                `/api/v1/clients/${testClient.id}`,
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Single Client GET'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should respond to single subscription GET within threshold', async () => {
            const iterations = 10;
            const results = await runLoadTest(
                app,
                'GET',
                `/api/v1/subscriptions/${testSubscription.id}`,
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Single Subscription GET'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });

    describe('List/Paginated Requests', () => {
        it('should respond to clients list within threshold', async () => {
            const iterations = 10;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should respond to subscriptions list within threshold', async () => {
            const iterations = 10;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/subscriptions?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Subscriptions List'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should respond to pricing plans list within threshold', async () => {
            const iterations = 10;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/pricing-plans?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Pricing Plans List'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });

    describe('Write Operations', () => {
        it('should respond to client creation within threshold', async () => {
            const iterations = 5;
            const results: any[] = [];

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(app, 'POST', '/api/v1/clients', actor, {
                    name: `Perf Test Client ${Date.now()}-${i}`,
                    billingEmail: `perf-write-${Date.now()}-${i}@test.com`,
                    userId: null
                });
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Client Creation'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.WRITE_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should respond to subscription update within threshold', async () => {
            const iterations = 5;
            const results: any[] = [];

            for (let i = 0; i < iterations; i++) {
                const newEndDate = new Date();
                newEndDate.setMonth(newEndDate.getMonth() + i + 1);

                const result = await measureRequest(
                    app,
                    'PUT',
                    `/api/v1/subscriptions/${testSubscription.id}`,
                    actor,
                    {
                        endDate: newEndDate.toISOString()
                    }
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Subscription Update'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.WRITE_AVG);
            expect(metrics.max).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_SINGLE_REQUEST);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });

    describe('P95 Latency Requirements', () => {
        it('should maintain P95 within 2x average for GET requests', async () => {
            const iterations = 20;
            const results = await runLoadTest(
                app,
                'GET',
                `/api/v1/clients/${testClient.id}`,
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'P95 Test - Client GET'));

            // P95 should be less than 2x average
            expect(metrics.p95).toBeLessThan(metrics.avg * PERFORMANCE_THRESHOLDS.P95_MULTIPLIER);
        });

        it('should maintain P95 within 2x average for LIST requests', async () => {
            const iterations = 20;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'P95 Test - Clients List'));

            // P95 should be less than 2x average
            expect(metrics.p95).toBeLessThan(metrics.avg * PERFORMANCE_THRESHOLDS.P95_MULTIPLIER);
        });
    });
});
