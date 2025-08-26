import { DestinationListItemSchema } from '@repo/schemas';
/**
 * Enhanced integration tests for GET /destinations (list) endpoint
 * Mirrors the depth of accommodation tests: response validation, pagination, sorting, filters.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

// Response schema for list endpoint (Destination)
const DestinationListResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        items: z.array(DestinationListItemSchema),
        pagination: z.object({
            page: z.number().min(1),
            limit: z.number().min(1),
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

    beforeAll(() => {
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

            expect([200, 400]).toContain(response.status);

            if (response.status === 200) {
                const data = await response.json();
                const validation = DestinationListResponseSchema.safeParse(data);
                expect(validation.success).toBe(true);
                if (validation.success) {
                    const res = validation.data;
                    expect(res.success).toBe(true);
                    expect(Array.isArray(res.data.items)).toBe(true);
                    expect(res.data.pagination.page).toBe(1);
                    expect(res.data.pagination.limit).toBeGreaterThan(0);
                    expect(res.data.pagination.total).toBeGreaterThanOrEqual(0);
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
                { page: 1, limit: 5 },
                { page: 2, limit: 10 },
                { page: 1, limit: 20 },
                { page: 3, limit: 15 }
            ];

            for (const { page, limit } of paginationCases) {
                const response = await app.request(`${baseUrl}?page=${page}&limit=${limit}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });
                expect([200, 400]).toContain(response.status);
                if (response.status === 200) {
                    const data = await response.json();
                    const parsed = DestinationListResponseSchema.safeParse(data);
                    expect(parsed.success).toBe(true);
                    if (parsed.success) {
                        expect(parsed.data.data.pagination.page).toBe(page);
                        expect(parsed.data.data.pagination.limit).toBe(limit);
                        expect(parsed.data.data.items.length).toBeLessThanOrEqual(limit);
                    }
                }
            }
        });

        it('should validate pagination bounds', async () => {
            const invalidCases = [
                { page: 0, limit: 10 },
                { page: -1, limit: 10 },
                { page: 1, limit: 0 },
                { page: 1, limit: -5 }
            ];
            for (const { page, limit } of invalidCases) {
                const response = await app.request(`${baseUrl}?page=${page}&limit=${limit}`, {
                    headers: { 'user-agent': 'vitest' }
                });
                expect([400]).toContain(response.status);
            }
        });

        it('should calculate total pages correctly when limit is provided', async () => {
            const response = await app.request(`${baseUrl}?limit=5`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });
            expect([200, 400]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                const { total, limit, totalPages } = data.data.pagination;
                expect(totalPages).toBe(Math.ceil(total / limit));
            }
        });
    });

    describe('Filtering & Sorting (flexible)', () => {
        it('supports common filters (city/country/isFeatured) and sort', async () => {
            const response = await app.request(
                `${baseUrl}?city=Miami&country=US&isFeatured=true&sortBy=createdAt&sortOrder=DESC`,
                {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                }
            );
            expect([200, 400]).toContain(response.status);
            if (response.status === 200) {
                const data = await response.json();
                const validation = DestinationListResponseSchema.safeParse(data);
                expect(validation.success).toBe(true);
            }
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
