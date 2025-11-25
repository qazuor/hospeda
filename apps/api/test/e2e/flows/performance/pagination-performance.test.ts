import { RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import {
    PERFORMANCE_THRESHOLDS,
    calculateMetrics,
    formatMetrics,
    runLoadTest
} from '../../helpers/performance-utils.js';
import { createTestClient, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * E2E Performance Tests: Pagination Performance
 *
 * Tests pagination performance with varying page sizes and page numbers:
 * - Small page sizes (10, 20)
 * - Large page sizes (50, 100)
 * - Deep pagination (page 10+)
 * - Response time should remain consistent across page numbers
 */
describe('E2E Performance: Pagination', () => {
    let app: ReturnType<typeof initApp>;
    let actor: ReturnType<typeof createMockAdminActor>;
    const CLIENTS_TO_CREATE = 50; // Create enough data for pagination testing

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create test user for actor
        const testUser = await createTestUser({
            role: RoleEnum.ADMIN
        });

        actor = createMockAdminActor({ id: testUser.id });

        // Create multiple clients for pagination testing
        console.info(`Creating ${CLIENTS_TO_CREATE} test clients for pagination tests...`);
        const createPromises = [];
        for (let i = 0; i < CLIENTS_TO_CREATE; i++) {
            createPromises.push(
                createTestClient({
                    name: `Pagination Test Client ${i.toString().padStart(3, '0')}`,
                    billingEmail: `pagination-test-${i}@e2e-test.com`
                })
            );
        }
        await Promise.all(createPromises);
        console.info('Test clients created successfully.');
    }, 60000); // Increase timeout for data creation

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('Page Size Performance', () => {
        it('should handle pageSize=10 efficiently', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (pageSize=10)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should handle pageSize=20 efficiently', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=20',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (pageSize=20)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });

        it('should handle pageSize=50 within acceptable threshold', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=50',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (pageSize=50)'));

            // Larger page sizes can be slightly slower
            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY_AVG);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });

    describe('Deep Pagination Performance', () => {
        it('should handle page 1 efficiently', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (page=1)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
        });

        it('should handle page 3 with similar performance to page 1', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=3&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (page=3)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
        });

        it('should handle page 5 (deep pagination) within threshold', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=5&pageSize=10',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (page=5)'));

            // Deep pagination might be slightly slower but should still be acceptable
            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY_AVG);
        });
    });

    describe('Pagination Consistency', () => {
        it('should maintain consistent response times across pages', async () => {
            const pages = [1, 2, 3, 4, 5];
            const pageMetrics: Record<number, number> = {};

            for (const page of pages) {
                const results = await runLoadTest(
                    app,
                    'GET',
                    `/api/v1/clients?page=${page}&pageSize=10`,
                    actor,
                    3,
                    1
                );

                const metrics = calculateMetrics(results);
                pageMetrics[page] = metrics.avg;
            }

            console.info('Page Response Times (avg):');
            for (const [page, avg] of Object.entries(pageMetrics)) {
                console.info(`  Page ${page}: ${avg.toFixed(2)}ms`);
            }

            // Response times should not vary more than 3x between pages
            const times = Object.values(pageMetrics);
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            expect(maxTime).toBeLessThan(minTime * 3);
        });
    });

    describe('Filtered Pagination Performance', () => {
        it('should handle pagination with isActive filter efficiently', async () => {
            const iterations = 5;
            const results = await runLoadTest(
                app,
                'GET',
                '/api/v1/clients?page=1&pageSize=10&isActive=true',
                actor,
                iterations,
                1
            );

            const metrics = calculateMetrics(results);
            console.info(formatMetrics(metrics, 'Clients List (filtered by isActive)'));

            expect(metrics.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_AVG);
            expect(metrics.successRate).toBeGreaterThanOrEqual(
                PERFORMANCE_THRESHOLDS.MIN_SUCCESS_RATE
            );
        });
    });
});
