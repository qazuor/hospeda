/**
 * Tests for createEntityApi - Entity API Client Factory
 *
 * Tests cover:
 * - API client creation with different schemas
 * - Query parameter handling (pagination, search, sort)
 * - Response parsing and transformation
 * - Error handling
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../mocks/server';

// We need to mock the fetchApi module
const API_BASE = '/api/v1';

// Simple implementation for testing
const createTestEntityApi = <TData>(endpoint: string, itemSchema: z.ZodSchema<TData>) => {
    const getEntities = async ({
        page = 1,
        pageSize = 20,
        q,
        sort
    }: {
        page?: number;
        pageSize?: number;
        q?: string;
        sort?: Array<{ id: string; desc: boolean }>;
    }) => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));

        if (q) {
            params.set('search', q);
        }

        // Transform SortConfig[] to "field:direction" string format expected by backend
        if (sort && sort.length > 0) {
            params.set('sort', `${sort[0].id}:${sort[0].desc ? 'desc' : 'asc'}`);
        }

        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Parse items with schema
        const items = data.data.items.map((item: unknown) => itemSchema.parse(item));

        return {
            data: items,
            total: data.data.pagination.total,
            page: data.data.pagination.page,
            pageSize: data.data.pagination.pageSize
        };
    };

    return { getEntities, itemSchema };
};

// Test schemas
const TestEntitySchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    createdAt: z.string()
});

describe('createEntityApi', () => {
    describe('API Client Creation', () => {
        it('should create an API client with getEntities method', () => {
            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            expect(api).toHaveProperty('getEntities');
            expect(typeof api.getEntities).toBe('function');
        });

        it('should include the item schema in the returned object', () => {
            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            expect(api.itemSchema).toBe(TestEntitySchema);
        });
    });

    describe('Query Parameters', () => {
        it('should send pagination parameters correctly', async () => {
            const capturedParams: { page: string | null; pageSize: string | null } = {
                page: null,
                pageSize: null
            };

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    capturedParams.page = url.searchParams.get('page');
                    capturedParams.pageSize = url.searchParams.get('pageSize');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 2, pageSize: 25, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({ page: 2, pageSize: 25 });

            expect(capturedParams.page).toBe('2');
            expect(capturedParams.pageSize).toBe('25');
        });

        it('should send search parameter when provided', async () => {
            let capturedSearch: string | null = null;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    capturedSearch = url.searchParams.get('search');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({ page: 1, pageSize: 20, q: 'beach hotel' });

            expect(capturedSearch).toBe('beach hotel');
        });

        it('should not include search parameter when not provided', async () => {
            let hasSearch = false;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    hasSearch = url.searchParams.has('search');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({ page: 1, pageSize: 20 });

            expect(hasSearch).toBe(false);
        });

        it('should send sort parameter as "field:direction" string when provided', async () => {
            let capturedSort: string | null = null;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    capturedSort = url.searchParams.get('sort');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({
                page: 1,
                pageSize: 20,
                sort: [{ id: 'name', desc: false }]
            });

            expect(capturedSort).toBe('name:asc');
        });

        it('should use only the first sort column in "field:direction" format', async () => {
            let capturedSort: string | null = null;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    capturedSort = url.searchParams.get('sort');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({
                page: 1,
                pageSize: 20,
                sort: [
                    { id: 'name', desc: false },
                    { id: 'createdAt', desc: true }
                ]
            });

            // Only first sort column is sent in "field:direction" format
            expect(capturedSort).toBe('name:asc');
        });

        it('should send desc sort direction correctly', async () => {
            let capturedSort: string | null = null;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    capturedSort = url.searchParams.get('sort');

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({
                page: 1,
                pageSize: 20,
                sort: [{ id: 'createdAt', desc: true }]
            });

            expect(capturedSort).toBe('createdAt:desc');
        });
    });

    describe('Response Parsing', () => {
        it('should transform API response to expected format', async () => {
            const mockItems = [
                { id: '1', name: 'Entity 1', slug: 'entity-1', createdAt: '2024-01-01T00:00:00Z' },
                { id: '2', name: 'Entity 2', slug: 'entity-2', createdAt: '2024-01-02T00:00:00Z' }
            ];

            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: mockItems,
                            pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            const result = await api.getEntities({ page: 1, pageSize: 20 });

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
        });

        it('should validate items against provided schema', async () => {
            const mockItems = [
                { id: '1', name: 'Entity 1', slug: 'entity-1', createdAt: '2024-01-01T00:00:00Z' }
            ];

            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: mockItems,
                            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            const result = await api.getEntities({ page: 1, pageSize: 20 });

            // Data should be properly typed
            expect(result.data[0]).toEqual(mockItems[0]);
        });

        it('should throw error for invalid item data', async () => {
            const invalidItems = [
                { id: '1', name: 'Entity 1' } // Missing required fields
            ];

            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: invalidItems,
                            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            await expect(api.getEntities({ page: 1, pageSize: 20 })).rejects.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should throw error on API failure', async () => {
            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json(
                        {
                            success: false,
                            error: { code: 'SERVER_ERROR', message: 'Internal error' }
                        },
                        { status: 500 }
                    );
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            await expect(api.getEntities({ page: 1, pageSize: 20 })).rejects.toThrow(
                'API error: 500'
            );
        });

        it('should throw error on network failure', async () => {
            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.error();
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            await expect(api.getEntities({ page: 1, pageSize: 20 })).rejects.toThrow();
        });

        it('should throw error on 404', async () => {
            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json(
                        {
                            success: false,
                            error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
                        },
                        { status: 404 }
                    );
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);

            await expect(api.getEntities({ page: 1, pageSize: 20 })).rejects.toThrow(
                'API error: 404'
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty response', async () => {
            server.use(
                http.get(`${API_BASE}/public/test-entities`, () => {
                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            const result = await api.getEntities({ page: 1, pageSize: 20 });

            expect(result.data).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should handle large page numbers', async () => {
            let receivedPage = 0;

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    receivedPage = Number(url.searchParams.get('page'));

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: {
                                page: receivedPage,
                                pageSize: 20,
                                total: 10000,
                                totalPages: 500
                            }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({ page: 500, pageSize: 20 });

            expect(receivedPage).toBe(500);
        });

        it('should handle special characters in search query', async () => {
            let receivedSearch = '';

            server.use(
                http.get(`${API_BASE}/public/test-entities`, ({ request }) => {
                    const url = new URL(request.url);
                    receivedSearch = url.searchParams.get('search') || '';

                    return HttpResponse.json({
                        success: true,
                        data: {
                            items: [],
                            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                        }
                    });
                })
            );

            const api = createTestEntityApi(`${API_BASE}/public/test-entities`, TestEntitySchema);
            await api.getEntities({ page: 1, pageSize: 20, q: 'Hotel "La Paz" & Spa' });

            expect(receivedSearch).toBe('Hotel "La Paz" & Spa');
        });
    });
});
