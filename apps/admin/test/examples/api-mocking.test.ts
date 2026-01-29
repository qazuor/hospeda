/**
 * Example: API Mocking with MSW
 *
 * This file demonstrates how to test API interactions using MSW (Mock Service Worker).
 * Use these patterns when testing components or hooks that make API calls.
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
    mockData,
    mockErrorResponse,
    mockPaginatedResponse,
    mockSuccessResponse
} from '../mocks/handlers';
import { server } from '../mocks/server';

const API_BASE = '/api/v1';

describe('API Mocking Examples', () => {
    describe('Basic Request Mocking', () => {
        it('should use default handlers for standard responses', async () => {
            // Default handlers are already configured in handlers.ts
            // They provide mock data for common endpoints
            const response = await fetch(`${API_BASE}/public/accommodations`);
            const data = await response.json();

            expect(response.ok).toBe(true);
            expect(data.success).toBe(true);
            expect(data.data.items).toHaveLength(1);
            expect(data.data.items[0].id).toBe('acc-1');
        });

        it('should return mock data with correct structure', async () => {
            const response = await fetch(`${API_BASE}/public/destinations`);
            const data = await response.json();

            // Verify response structure matches API standards
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data).toHaveProperty('metadata');
            expect(data.metadata).toHaveProperty('timestamp');
            expect(data.metadata).toHaveProperty('requestId');
        });
    });

    describe('Runtime Handler Override', () => {
        it('should override handlers for specific test scenarios', async () => {
            // Use server.use() to override handlers for a specific test
            const customAccommodation = {
                id: 'custom-acc',
                name: 'Custom Test Hotel',
                slug: 'custom-test-hotel',
                type: 'hotel',
                lifecycleState: 'active'
            };

            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockPaginatedResponse([customAccommodation, mockData.accommodation])
                    );
                })
            );

            const response = await fetch(`${API_BASE}/public/accommodations`);
            const data = await response.json();

            expect(data.data.items).toHaveLength(2);
            expect(data.data.items[0].name).toBe('Custom Test Hotel');
        });

        it('should simulate error responses', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.json(
                        mockErrorResponse('SERVER_ERROR', 'Internal server error'),
                        { status: 500 }
                    );
                })
            );

            const response = await fetch(`${API_BASE}/public/accommodations`);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVER_ERROR');
        });

        it('should simulate network errors', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, () => {
                    return HttpResponse.error();
                })
            );

            await expect(fetch(`${API_BASE}/public/accommodations`)).rejects.toThrow();
        });
    });

    describe('Testing Different HTTP Methods', () => {
        it('should mock POST requests for creating entities', async () => {
            const newEntity = {
                id: 'new-id',
                name: 'New Entity',
                createdAt: new Date().toISOString()
            };

            server.use(
                http.post(`${API_BASE}/admin/accommodations`, async ({ request }) => {
                    const body = (await request.json()) as Record<string, unknown>;
                    return HttpResponse.json(mockSuccessResponse({ ...newEntity, ...body }), {
                        status: 201
                    });
                })
            );

            const response = await fetch(`${API_BASE}/admin/accommodations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Created Hotel' })
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.name).toBe('Created Hotel');
        });

        it('should mock PATCH requests for updating entities', async () => {
            server.use(
                http.patch(`${API_BASE}/admin/accommodations/:id`, async ({ params, request }) => {
                    const body = (await request.json()) as Record<string, unknown>;
                    return HttpResponse.json(
                        mockSuccessResponse({
                            id: params.id,
                            ...body,
                            updatedAt: new Date().toISOString()
                        })
                    );
                })
            );

            const response = await fetch(`${API_BASE}/admin/accommodations/acc-1`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Hotel' })
            });
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.id).toBe('acc-1');
            expect(data.data.name).toBe('Updated Hotel');
        });

        it('should mock DELETE requests', async () => {
            server.use(
                http.delete(`${API_BASE}/admin/accommodations/:id`, ({ params }) => {
                    return HttpResponse.json(
                        mockSuccessResponse({ deleted: true, id: params.id }),
                        { status: 200 }
                    );
                })
            );

            const response = await fetch(`${API_BASE}/admin/accommodations/acc-1`, {
                method: 'DELETE'
            });
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.deleted).toBe(true);
        });
    });

    describe('Testing Pagination', () => {
        it('should mock paginated responses with different page sizes', async () => {
            const manyAccommodations = Array.from({ length: 50 }, (_, i) => ({
                id: `acc-${i}`,
                name: `Hotel ${i}`,
                slug: `hotel-${i}`,
                type: 'hotel'
            }));

            server.use(
                http.get(`${API_BASE}/public/accommodations`, ({ request }) => {
                    const url = new URL(request.url);
                    const page = Number(url.searchParams.get('page')) || 1;
                    const pageSize = Number(url.searchParams.get('pageSize')) || 20;

                    const start = (page - 1) * pageSize;
                    const end = start + pageSize;
                    const items = manyAccommodations.slice(start, end);

                    return HttpResponse.json(mockPaginatedResponse(items, page, pageSize));
                })
            );

            // Test first page
            const response1 = await fetch(`${API_BASE}/public/accommodations?page=1&pageSize=10`);
            const data1 = await response1.json();

            expect(data1.data.items).toHaveLength(10);
            expect(data1.data.pagination.page).toBe(1);
            expect(data1.data.pagination.pageSize).toBe(10);

            // Test second page
            const response2 = await fetch(`${API_BASE}/public/accommodations?page=2&pageSize=10`);
            const data2 = await response2.json();

            expect(data2.data.items[0].id).toBe('acc-10');
        });
    });

    describe('Testing Query Parameters', () => {
        it('should access and validate query parameters', async () => {
            server.use(
                http.get(`${API_BASE}/public/accommodations`, ({ request }) => {
                    const url = new URL(request.url);
                    const searchQuery = url.searchParams.get('q');
                    const sort = url.searchParams.get('sort');

                    // Filter based on search query
                    let items = [mockData.accommodation];
                    if (searchQuery) {
                        items = items.filter((item) =>
                            item.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    }

                    return HttpResponse.json(mockPaginatedResponse(items), {
                        headers: {
                            'X-Search-Query': searchQuery || '',
                            'X-Sort': sort || 'default'
                        }
                    });
                })
            );

            const response = await fetch(`${API_BASE}/public/accommodations?q=test&sort=name`);

            expect(response.headers.get('X-Search-Query')).toBe('test');
            expect(response.headers.get('X-Sort')).toBe('name');
        });
    });

    describe('Testing Authentication Headers', () => {
        it('should verify authorization headers are sent', async () => {
            let receivedAuthHeader: string | null = null;

            server.use(
                http.get(`${API_BASE}/protected/accommodations`, ({ request }) => {
                    receivedAuthHeader = request.headers.get('Authorization');

                    if (!receivedAuthHeader || !receivedAuthHeader.startsWith('Bearer ')) {
                        return HttpResponse.json(
                            mockErrorResponse('UNAUTHORIZED', 'Missing or invalid token'),
                            { status: 401 }
                        );
                    }

                    return HttpResponse.json(mockPaginatedResponse([mockData.accommodation]));
                })
            );

            // Request without auth - should fail
            const response1 = await fetch(`${API_BASE}/protected/accommodations`);
            expect(response1.status).toBe(401);

            // Request with auth - should succeed
            const response2 = await fetch(`${API_BASE}/protected/accommodations`, {
                headers: { Authorization: 'Bearer test-token' }
            });
            expect(response2.ok).toBe(true);
            expect(receivedAuthHeader).toBe('Bearer test-token');
        });
    });
});
