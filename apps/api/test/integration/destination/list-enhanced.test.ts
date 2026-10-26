import { DestinationPublicSchema } from '@repo/schemas';
/**
 * Enhanced integration tests for GET /destinations (list) endpoint
 * Mirrors the depth of accommodation tests: response validation, pagination, sorting, filters.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { seedPublicDestinations } from '../helpers/seed-public-destinations';

// Response schema for list endpoint (Destination)
const DestinationListResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        items: z.array(DestinationPublicSchema),
        pagination: z.object({
            page: z.number().min(1),
            pageSize: z.number().min(1),
            total: z.number().min(0),
            totalPages: z.number().min(0)
        })
    }),
    metadata: z.object({
        timestamp: z.string(),
        requestId: z.string()
    })
});

describe('GET /destinations (Enhanced List)', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/destinations';

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    beforeEach(async () => {
        await seedPublicDestinations({ count: 3 });
    });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    describe('Basic Functionality (200)', () => {
        it('should return destinations list with default pagination', async () => {
            const response = await app.request(baseUrl, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            if (response.status === 200) {
                const data = await response.json();
                const validation = DestinationListResponseSchema.safeParse(data);
                expect(validation.success).toBe(true);
                if (validation.success) {
                    const res = validation.data;
                    expect(res.success).toBe(true);
                    expect(Array.isArray(res.data.items)).toBe(true);
                    expect(res.data.pagination.page).toBe(1);
                    expect(res.data.pagination.pageSize).toBeGreaterThan(0);
                    expect(res.data.pagination.total).toBe(3);
                    expect(res.data.items).toHaveLength(3);
                    expect(res.data.pagination.totalPages).toBeGreaterThanOrEqual(0);
                    expect(typeof res.metadata.timestamp).toBe('string');
                    expect(typeof res.metadata.requestId).toBe('string');
                    expect(new Date(res.metadata.timestamp).toString()).not.toBe('Invalid Date');
                }
            }
        });
    });

    describe('Pagination Parameters', () => {
        it('should handle valid pagination parameters', async () => {
            const paginationCases = [
                { page: 1, pageSize: 5 },
                { page: 2, pageSize: 10 },
                { page: 1, pageSize: 20 },
                { page: 3, pageSize: 15 }
            ];

            for (const { page, pageSize } of paginationCases) {
                const response = await app.request(`${baseUrl}?page=${page}&pageSize=${pageSize}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });
                expect(response.status).toBe(200);
                if (response.status === 200) {
                    const data = await response.json();
                    const parsed = DestinationListResponseSchema.safeParse(data);
                    expect(parsed.success).toBe(true);
                    if (parsed.success) {
                        expect(parsed.data.data.pagination.page).toBe(page);
                        expect(parsed.data.data.pagination.pageSize).toBe(pageSize);
                        expect(parsed.data.data.items.length).toBeLessThanOrEqual(pageSize);
                    }
                }
            }
        });

        it('should validate pagination bounds', async () => {
            const invalidCases = [
                { page: 0, pageSize: 10 },
                { page: -1, pageSize: 10 },
                { page: 1, pageSize: 0 },
                { page: 1, pageSize: -5 }
            ];
            for (const { page, pageSize } of invalidCases) {
                const response = await app.request(`${baseUrl}?page=${page}&pageSize=${pageSize}`, {
                    headers: { 'user-agent': 'vitest' }
                });
                expect([400]).toContain(response.status);
            }
        });

        it('should calculate total pages correctly when pageSize is provided', async () => {
            const response = await app.request(`${baseUrl}?pageSize=5`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });
            expect(response.status).toBe(200);
            if (response.status === 200) {
                const data = await response.json();
                const { total, pageSize, totalPages } = data.data.pagination;
                expect(totalPages).toBe(Math.ceil(total / pageSize));
            }
        });
    });

    describe('Filtering & Sorting', () => {
        // HOS-1899: ?city= alone answers 500 DATABASE_ERROR.
        it('currently answers 500 DATABASE_ERROR for ?city= alone (HOS-1899)', async () => {
            const response = await app.request(`${baseUrl}?city=CDU`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error.code).toBe('DATABASE_ERROR');
        });

        // Drop `.fails` (and the test above) once HOS-1899 is fixed.
        it.fails('filters by city (HOS-1899)', async () => {
            const response = await app.request(`${baseUrl}?city=CDU`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(DestinationListResponseSchema.safeParse(data).success).toBe(true);
            expect(data.data.items).toHaveLength(3);
        });

        // HOS-1899: ?country= alone answers 500 DATABASE_ERROR.
        it('currently answers 500 DATABASE_ERROR for ?country= alone (HOS-1899)', async () => {
            const response = await app.request(`${baseUrl}?country=AR`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error.code).toBe('DATABASE_ERROR');
        });

        // Drop `.fails` (and the test above) once HOS-1899 is fixed.
        it.fails('filters by country (HOS-1899)', async () => {
            const response = await app.request(`${baseUrl}?country=AR`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(DestinationListResponseSchema.safeParse(data).success).toBe(true);
            expect(data.data.items).toHaveLength(3);
        });

        it('supports the isFeatured filter and sort params', async () => {
            const response = await app.request(
                `${baseUrl}?isFeatured=true&sortBy=createdAt&sortOrder=desc`,
                { headers: { 'user-agent': 'vitest', Accept: 'application/json' } }
            );
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(DestinationListResponseSchema.safeParse(data).success).toBe(true);
            // None of the 3 seeded destinations is featured
            expect(data.data.items).toHaveLength(0);
        });

        it('rejects an unknown query param with 400', async () => {
            const response = await app.request(`${baseUrl}?bogus=1`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(response.status).toBe(400);
        });
    });

    describe('Content Negotiation', () => {
        it('should accept application/json and wildcard', async () => {
            const jsonRes = await app.request(baseUrl, { headers: { Accept: 'application/json' } });
            const anyRes = await app.request(baseUrl, { headers: { Accept: '*/*' } });
            expect([200, 400]).toContain(jsonRes.status);
            expect([200, 400]).toContain(anyRes.status);
        });
    });
});
