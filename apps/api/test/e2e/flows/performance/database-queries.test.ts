import { BillingIntervalEnum, BillingSchemeEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import {
    PERFORMANCE_THRESHOLDS,
    calculateMetrics,
    formatMetrics,
    measureRequest
} from '../../helpers/performance-utils.js';
import {
    createTestClient,
    createTestPlan,
    createTestSubscription,
    createTestUser
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * E2E Performance Tests: Database Query Performance
 *
 * Tests database query performance for various operations:
 * - Simple lookups by ID
 * - Filtered queries
 * - Join queries
 * - Aggregation queries
 * - All queries should complete within 300ms average
 */
describe('E2E Performance: Database Queries', () => {
    let app: ReturnType<typeof initApp>;
    let actor: ReturnType<typeof createMockAdminActor>;
    const testClients: any[] = [];
    const testPlans: any[] = [];
    const testSubscriptions: any[] = [];

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create test user for actor
        const testUser = await createTestUser({
            role: RoleEnum.ADMIN
        });

        actor = createMockAdminActor({ id: testUser.id });

        // Create test data for query tests
        console.info('Creating test data for database query tests...');

        // Create 20 clients
        for (let i = 0; i < 20; i++) {
            const client = await createTestClient({
                name: `DB Query Test Client ${i}`,
                billingEmail: `db-query-${i}@e2e-test.com`
            });
            testClients.push(client);
        }

        // Create 5 pricing plans
        for (let i = 0; i < 5; i++) {
            const plan = await createTestPlan({
                billingScheme:
                    i % 2 === 0 ? BillingSchemeEnum.RECURRING : BillingSchemeEnum.ONE_TIME,
                interval: i % 2 === 0 ? BillingIntervalEnum.MONTH : undefined,
                amount: 1000 + i * 500,
                currency: 'ARS'
            });
            testPlans.push(plan);
        }

        // Create subscriptions linking clients to plans
        for (let i = 0; i < 15; i++) {
            const client = testClients[i % testClients.length];
            const plan = testPlans[i % testPlans.length];
            const subscription = await createTestSubscription(client.id, plan.id);
            testSubscriptions.push(subscription);
        }

        console.info(
            `Created ${testClients.length} clients, ${testPlans.length} plans, ${testSubscriptions.length} subscriptions`
        );
    }, 60000);

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('Simple ID Lookups', () => {
        it('should perform client lookup by ID within threshold', async () => {
            const results: any[] = [];

            for (const client of testClients.slice(0, 10)) {
                const result = await measureRequest(
                    app,
                    'GET',
                    `/api/v1/clients/${client.id}`,
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Client ID Lookups'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.successRate).toBe(100);
        });

        it('should perform subscription lookup by ID within threshold', async () => {
            const results: any[] = [];

            for (const subscription of testSubscriptions.slice(0, 10)) {
                const result = await measureRequest(
                    app,
                    'GET',
                    `/api/v1/subscriptions/${subscription.id}`,
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Subscription ID Lookups'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.successRate).toBe(100);
        });

        it('should perform pricing plan lookup by ID within threshold', async () => {
            const results: any[] = [];

            for (const plan of testPlans) {
                const result = await measureRequest(
                    app,
                    'GET',
                    `/api/v1/pricing-plans/${plan.id}`,
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Pricing Plan ID Lookups'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SIMPLE_GET_AVG);
            expect(metrics.successRate).toBe(100);
        });
    });

    describe('Filtered Queries', () => {
        it('should perform filtered client query within threshold', async () => {
            const results: any[] = [];
            const iterations = 10;

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(
                    app,
                    'GET',
                    '/api/v1/clients?isActive=true&page=1&pageSize=10',
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Filtered Client Query (isActive)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBe(100);
        });

        it('should perform filtered subscription query within threshold', async () => {
            const results: any[] = [];
            const iterations = 10;

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(
                    app,
                    'GET',
                    '/api/v1/subscriptions?status=active&page=1&pageSize=10',
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Filtered Subscription Query (status)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBe(100);
        });
    });

    describe('Complex Queries', () => {
        it('should perform subscription query with client filter within threshold', async () => {
            const results: any[] = [];
            const iterations = 10;
            const clientId = testClients[0].id;

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(
                    app,
                    'GET',
                    `/api/v1/subscriptions?clientId=${clientId}&page=1&pageSize=10`,
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Subscription Query (by clientId)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY_AVG);
            expect(metrics.successRate).toBe(100);
        });

        it('should perform pricing plan query with billing scheme filter within threshold', async () => {
            const results: any[] = [];
            const iterations = 10;

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(
                    app,
                    'GET',
                    '/api/v1/pricing-plans?billingScheme=recurring&page=1&pageSize=10',
                    actor
                );
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Pricing Plan Query (billingScheme=recurring)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBe(100);
        });
    });

    describe('Query Performance Consistency', () => {
        it('should maintain consistent query times across multiple runs', async () => {
            const runs = 5;
            const runMetrics: any[] = [];

            for (let run = 0; run < runs; run++) {
                const results: any[] = [];

                for (let i = 0; i < 10; i++) {
                    const result = await measureRequest(
                        app,
                        'GET',
                        '/api/v1/clients?page=1&pageSize=10',
                        actor
                    );
                    results.push(result);
                }

                const metrics = calculateMetrics(results);
                runMetrics.push(metrics);
            }

            console.info('\nQuery Performance Across Runs:');
            runMetrics.forEach((m, i) => {
                console.info(
                    `  Run ${i + 1}: avg=${m.avg.toFixed(2)}ms, p95=${m.p95.toFixed(2)}ms`
                );
            });

            // Calculate variance
            const avgs = runMetrics.map((m) => m.avg);
            const avgOfAvgs = avgs.reduce((a, b) => a + b, 0) / avgs.length;
            const variance =
                avgs.reduce((sum, avg) => sum + (avg - avgOfAvgs) ** 2, 0) / avgs.length;
            const stdDev = Math.sqrt(variance);

            console.info(
                `\nStatistics: mean=${avgOfAvgs.toFixed(2)}ms, stdDev=${stdDev.toFixed(2)}ms`
            );

            // Standard deviation should be less than 50% of mean (consistent performance)
            expect(stdDev).toBeLessThan(avgOfAvgs * 0.5);
        });
    });

    describe('Write Operation Performance', () => {
        it('should perform client creation within threshold', async () => {
            const results: any[] = [];
            const iterations = 5;

            for (let i = 0; i < iterations; i++) {
                const result = await measureRequest(app, 'POST', '/api/v1/clients', actor, {
                    name: `DB Write Test ${Date.now()}-${i}`,
                    billingEmail: `db-write-${Date.now()}-${i}@test.com`,
                    userId: null
                });
                results.push(result);
            }

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Client Creation'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.WRITE_AVG);
            expect(metrics.successRate).toBe(100);
        });

        it('should perform subscription update within threshold', async () => {
            const results: any[] = [];
            const subscription = testSubscriptions[0];

            for (let i = 0; i < 5; i++) {
                const newEndDate = new Date();
                newEndDate.setMonth(newEndDate.getMonth() + i + 2);

                const result = await measureRequest(
                    app,
                    'PUT',
                    `/api/v1/subscriptions/${subscription.id}`,
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
            expect(metrics.successRate).toBe(100);
        });
    });
});
