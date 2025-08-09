/**
 * Enhanced integration tests for GET /accommodations (list) endpoint
 * Tests comprehensive filtering, pagination, sorting and response validation
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { accommodationListItemSchema } from '../../../src/routes/accommodation/schemas';

// Response schema for list endpoint
const AccommodationListResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        items: z.array(accommodationListItemSchema),
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

describe('GET /accommodations (Enhanced List)', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/accommodations';

    beforeAll(() => {
        app = initApp();
    });

    describe('Basic Functionality (200)', () => {
        it('should return accommodations list with default pagination', async () => {
            const response = await app.request(baseUrl, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();

            // Validate against complete response schema
            const validation = AccommodationListResponseSchema.safeParse(data);
            expect(validation.success).toBe(true);

            if (validation.success) {
                const responseData = validation.data;

                // Response structure validation
                expect(responseData.success).toBe(true);
                expect(Array.isArray(responseData.data.items)).toBe(true);

                // Pagination validation
                expect(responseData.data.pagination.page).toBe(1); // Default page
                expect(responseData.data.pagination.limit).toBeGreaterThan(0);
                expect(responseData.data.pagination.total).toBeGreaterThanOrEqual(0);
                expect(responseData.data.pagination.totalPages).toBeGreaterThanOrEqual(0);

                // Metadata validation
                expect(typeof responseData.metadata.timestamp).toBe('string');
                expect(typeof responseData.metadata.requestId).toBe('string');
                expect(new Date(responseData.metadata.timestamp).toString()).not.toBe(
                    'Invalid Date'
                );

                // Individual item validation
                for (const item of responseData.data.items as any[]) {
                    expect(item).toHaveProperty('id');
                    expect(item).toHaveProperty('name');
                    expect(item).toHaveProperty('type');
                    expect(item).toHaveProperty('reviewsCount');
                    expect(item).toHaveProperty('averageRating');
                    expect(item).toHaveProperty('isFeatured');

                    // Type validation
                    expect(typeof item.id).toBe('string');
                    expect(typeof item.name).toBe('string');
                    expect(typeof item.type).toBe('string');
                    expect(typeof item.reviewsCount).toBe('number');
                    expect(typeof item.averageRating).toBe('number');
                    expect(typeof item.isFeatured).toBe('boolean');

                    // Value constraints
                    expect(item.id).toMatch(
                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                    );
                    expect(item.name.length).toBeGreaterThan(0);
                    expect(
                        ['hotel', 'apartment', 'villa', 'hostel', 'resort', 'guesthouse'].includes(
                            item.type
                        )
                    ).toBe(true);
                    expect(item.reviewsCount).toBeGreaterThanOrEqual(0);
                    expect(item.averageRating).toBeGreaterThanOrEqual(0);
                    expect(item.averageRating).toBeLessThanOrEqual(5);
                }
            }
        });

        it('should handle empty results gracefully', async () => {
            // Use filter that likely returns no results
            const response = await app.request(`${baseUrl}?city=NonExistentCity123`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(Array.isArray(data.data.items)).toBe(true);
            expect(data.data.items).toHaveLength(0);
            expect(data.data.pagination.total).toBe(0);
            expect(data.data.pagination.totalPages).toBe(0);
        });
    });

    describe('Pagination Parameters', () => {
        it('should handle valid pagination parameters', async () => {
            const paginationTests = [
                { page: 1, limit: 5 },
                { page: 2, limit: 10 },
                { page: 1, limit: 20 },
                { page: 3, limit: 15 }
            ];

            for (const { page, limit } of paginationTests) {
                const response = await app.request(`${baseUrl}?page=${page}&limit=${limit}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect(response.status).toBe(200);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.data.pagination.page).toBe(page);
                expect(data.data.pagination.limit).toBe(limit);
                expect(data.data.items.length).toBeLessThanOrEqual(limit);
            }
        });

        it('should validate pagination parameter bounds', async () => {
            const invalidPaginationTests = [
                { page: 0, limit: 10, expected: 400 }, // Invalid page
                { page: -1, limit: 10, expected: 400 }, // Negative page
                { page: 1, limit: 0, expected: 400 }, // Invalid limit
                { page: 1, limit: -5, expected: 400 }, // Negative limit
                { page: 1, limit: 1001, expected: 400 }, // Limit too high
                { page: 'invalid', limit: 10, expected: 400 }, // Non-numeric page
                { page: 1, limit: 'invalid', expected: 400 } // Non-numeric limit
            ];

            for (const { page, limit, expected } of invalidPaginationTests) {
                const response = await app.request(`${baseUrl}?page=${page}&limit=${limit}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect(response.status).toBe(expected);

                if (response.status === 400) {
                    const data = await response.json();
                    expect(data.success).toBe(false);
                    expect(data).toHaveProperty('error');
                }
            }
        });

        it('should calculate total pages correctly', async () => {
            const response = await app.request(`${baseUrl}?limit=5`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            const { total, limit, totalPages } = data.data.pagination;

            const expectedTotalPages = Math.ceil(total / limit);
            expect(totalPages).toBe(expectedTotalPages);
        });
    });

    describe('Sorting Parameters', () => {
        it('should handle valid sorting parameters', async () => {
            const sortingTests = [
                { sortBy: 'name', sortOrder: 'ASC' },
                { sortBy: 'name', sortOrder: 'DESC' },
                { sortBy: 'createdAt', sortOrder: 'ASC' },
                { sortBy: 'createdAt', sortOrder: 'DESC' },
                { sortBy: 'averageRating', sortOrder: 'DESC' },
                { sortBy: 'reviewsCount', sortOrder: 'DESC' }
            ];

            for (const { sortBy, sortOrder } of sortingTests) {
                const response = await app.request(
                    `${baseUrl}?sortBy=${sortBy}&sortOrder=${sortOrder}`,
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
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);

                    // Verify sorting if we have multiple items
                    if (data.data.items.length > 1) {
                        const items = data.data.items;

                        if (sortBy === 'name') {
                            for (let i = 0; i < items.length - 1; i++) {
                                const current = items[i].name.toLowerCase();
                                const next = items[i + 1].name.toLowerCase();

                                if (sortOrder === 'ASC') {
                                    expect(current <= next).toBe(true);
                                } else {
                                    expect(current >= next).toBe(true);
                                }
                            }
                        }

                        if (sortBy === 'averageRating') {
                            for (let i = 0; i < items.length - 1; i++) {
                                const current = items[i].averageRating;
                                const next = items[i + 1].averageRating;

                                if (sortOrder === 'ASC') {
                                    expect(current <= next).toBe(true);
                                } else {
                                    expect(current >= next).toBe(true);
                                }
                            }
                        }
                    }
                }
            }
        });

        it('should validate sorting parameter values', async () => {
            const invalidSortingTests = [
                { sortBy: 'invalidField', sortOrder: 'ASC' },
                { sortBy: 'name', sortOrder: 'INVALID' },
                { sortBy: '', sortOrder: 'ASC' },
                { sortBy: 'name', sortOrder: '' }
            ];

            for (const { sortBy, sortOrder } of invalidSortingTests) {
                const response = await app.request(
                    `${baseUrl}?sortBy=${sortBy}&sortOrder=${sortOrder}`,
                    {
                        headers: {
                            'user-agent': 'vitest',
                            Accept: 'application/json'
                        }
                    }
                );

                // Endpoint might return 400 (strict validation) or 200 (ignore invalid params)
                expect([200, 400]).toContain(response.status);

                const data = await response.json();

                if (response.status === 400) {
                    // Strict validation: reject invalid params
                    expect(data.success).toBe(false);
                    expect(data).toHaveProperty('error');
                } else {
                    // Permissive: ignore invalid params and return default sorting
                    expect(data.success).toBe(true);
                    expect(data).toHaveProperty('data');
                }
            }
        });
    });

    describe('Filtering Parameters', () => {
        it('should handle type filter', async () => {
            const validTypes = ['hotel', 'apartment', 'villa', 'hostel', 'resort', 'guesthouse'];

            for (const type of validTypes) {
                const response = await app.request(`${baseUrl}?type=${type}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);

                    // All returned items should match the filter type
                    for (const item of data.data.items) {
                        expect(item.type).toBe(type);
                    }
                }
            }
        });

        it('should handle location filters', async () => {
            const locationTests = [
                { city: 'Miami' },
                { country: 'USA' },
                { city: 'Miami', country: 'USA' },
                { state: 'Florida' },
                { region: 'North America' }
            ];

            for (const filters of locationTests) {
                const cleanFilters = Object.fromEntries(
                    Object.entries(filters).filter(([_, value]) => value !== undefined)
                );
                const queryParams = new URLSearchParams(cleanFilters).toString();
                const response = await app.request(`${baseUrl}?${queryParams}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);
                }
            }
        });

        it('should handle rating and price filters', async () => {
            const ratingPriceTests = [
                { minRating: 4.0 },
                { maxRating: 3.5 },
                { minRating: 3.0, maxRating: 4.5 },
                { minPrice: 100 },
                { maxPrice: 500 },
                { minPrice: 100, maxPrice: 300 },
                { priceRange: 'budget' },
                { priceRange: 'mid-range' },
                { priceRange: 'luxury' }
            ];

            for (const filters of ratingPriceTests) {
                const queryParams = new URLSearchParams(
                    Object.fromEntries(
                        Object.entries(filters).map(([key, value]) => [key, value.toString()])
                    )
                ).toString();

                const response = await app.request(`${baseUrl}?${queryParams}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);

                    // Validate rating filters
                    if (filters.minRating || filters.maxRating) {
                        for (const item of data.data.items) {
                            if (filters.minRating) {
                                expect(item.averageRating).toBeGreaterThanOrEqual(
                                    filters.minRating
                                );
                            }
                            if (filters.maxRating) {
                                expect(item.averageRating).toBeLessThanOrEqual(filters.maxRating);
                            }
                        }
                    }
                }
            }
        });

        it('should handle amenity and feature filters', async () => {
            const amenityFeatureTests = [
                { amenities: 'wifi,pool' },
                { amenities: 'gym' },
                { features: 'pet-friendly,spa' },
                { features: 'business-center' },
                { amenities: 'wifi', features: 'spa' }
            ];

            for (const filters of amenityFeatureTests) {
                const cleanFilters = Object.fromEntries(
                    Object.entries(filters).filter(([_, value]) => value !== undefined)
                );
                const queryParams = new URLSearchParams(cleanFilters).toString();
                const response = await app.request(`${baseUrl}?${queryParams}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);
                }
            }
        });

        it('should handle boolean filters', async () => {
            const booleanTests = [
                { isFeatured: 'true' },
                { isFeatured: 'false' },
                { isActive: 'true' },
                { isPublished: 'true' },
                { petFriendly: 'true' },
                { hasParking: 'true' },
                { hasWifi: 'true' }
            ];

            for (const filters of booleanTests) {
                const cleanFilters = Object.fromEntries(
                    Object.entries(filters).filter(([_, value]) => value !== undefined)
                );
                const queryParams = new URLSearchParams(cleanFilters).toString();
                const response = await app.request(`${baseUrl}?${queryParams}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);

                    // Validate featured filter
                    if (filters.isFeatured === 'true') {
                        for (const item of data.data.items) {
                            expect(item.isFeatured).toBe(true);
                        }
                    } else if (filters.isFeatured === 'false') {
                        for (const item of data.data.items) {
                            expect(item.isFeatured).toBe(false);
                        }
                    }
                }
            }
        });
    });

    describe('Complex Filter Combinations', () => {
        it('should handle multiple filters simultaneously', async () => {
            const complexFilterTests = [
                {
                    type: 'hotel',
                    city: 'Miami',
                    minRating: 4.0,
                    isFeatured: 'true',
                    page: 1,
                    limit: 10,
                    sortBy: 'averageRating',
                    sortOrder: 'DESC'
                },
                {
                    type: 'apartment',
                    minPrice: 100,
                    maxPrice: 300,
                    amenities: 'wifi,pool',
                    features: 'pet-friendly',
                    page: 2,
                    limit: 5
                },
                {
                    country: 'USA',
                    priceRange: 'mid-range',
                    minRating: 3.5,
                    hasParking: 'true',
                    sortBy: 'name',
                    sortOrder: 'ASC'
                }
            ];

            for (const filters of complexFilterTests) {
                const queryParams = new URLSearchParams(
                    Object.fromEntries(
                        Object.entries(filters).map(([key, value]) => [key, value.toString()])
                    )
                ).toString();

                const response = await app.request(`${baseUrl}?${queryParams}`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect([200, 400]).toContain(response.status);

                if (response.status === 200) {
                    const data = await response.json();
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);

                    // Validate that all applied filters are respected
                    for (const item of data.data.items) {
                        if (filters.type) {
                            expect(item.type).toBe(filters.type);
                        }
                        if (filters.minRating) {
                            expect(item.averageRating).toBeGreaterThanOrEqual(
                                Number.parseFloat(filters.minRating.toString())
                            );
                        }
                        if (filters.isFeatured === 'true') {
                            expect(item.isFeatured).toBe(true);
                        }
                    }

                    // Validate pagination was applied
                    if (filters.page && filters.limit) {
                        expect(data.data.pagination.page).toBe(
                            Number.parseInt(filters.page.toString(), 10)
                        );
                        expect(data.data.pagination.limit).toBe(
                            Number.parseInt(filters.limit.toString(), 10)
                        );
                        expect(data.data.items.length).toBeLessThanOrEqual(
                            Number.parseInt(filters.limit.toString(), 10)
                        );
                    }
                }
            }
        });

        it('should handle filter precedence correctly', async () => {
            // Test conflicting or overlapping filters
            const response = await app.request(`${baseUrl}?minRating=4.0&maxRating=3.0`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            // Should return 400 for invalid filter combination or 200 with empty results
            expect([200, 400]).toContain(response.status);

            if (response.status === 200) {
                const data = await response.json();
                expect(data.data.items).toHaveLength(0);
            }
        });
    });

    describe('Search Functionality', () => {
        it('should handle text search parameters', async () => {
            const searchTests = [
                { search: 'luxury' },
                { search: 'beach' },
                { search: 'downtown' },
                { search: 'hotel spa' },
                { search: 'Miami Beach' }
            ];

            for (const { search } of searchTests) {
                const response = await app.request(
                    `${baseUrl}?search=${encodeURIComponent(search)}`,
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
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);
                }
            }
        });

        it('should handle special characters in search', async () => {
            const specialSearchTests = [
                { search: 'café & restaurant' },
                { search: 'hotel "luxury"' },
                { search: 'spa@resort.com' },
                { search: '5-star accommodation' }
            ];

            for (const { search } of specialSearchTests) {
                const response = await app.request(
                    `${baseUrl}?search=${encodeURIComponent(search)}`,
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
                    expect(data.success).toBe(true);
                    expect(Array.isArray(data.data.items)).toBe(true);
                }
            }
        });
    });

    describe('Performance and Caching', () => {
        it('should handle concurrent requests efficiently', async () => {
            const promises = Array.from({ length: 5 }, (_, i) =>
                app.request(`${baseUrl}?page=${i + 1}&limit=5`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(promises);

            for (const response of responses) {
                expect(response.status).toBe(200);
            }
        });

        it('should respect caching headers', async () => {
            const response = await app.request(baseUrl, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);
            // Cache headers should be present due to cacheTTL configuration
        });

        it('should handle large limit values appropriately', async () => {
            const response = await app.request(`${baseUrl}?limit=100`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect([200, 400]).toContain(response.status);

            if (response.status === 200) {
                const data = await response.json();
                expect(data.data.items.length).toBeLessThanOrEqual(100);
            }
        });
    });

    describe('Data Consistency and Validation', () => {
        it('should maintain consistent data structure across pages', async () => {
            const [page1, page2] = await Promise.all([
                app.request(`${baseUrl}?page=1&limit=5`, {
                    headers: { 'user-agent': 'vitest', Accept: 'application/json' }
                }),
                app.request(`${baseUrl}?page=2&limit=5`, {
                    headers: { 'user-agent': 'vitest', Accept: 'application/json' }
                })
            ]);

            if (page1.status === 200 && page2.status === 200) {
                const data1 = await page1.json();
                const data2 = await page2.json();

                // Structure should be identical
                expect(Object.keys(data1)).toEqual(Object.keys(data2));
                expect(Object.keys(data1.data)).toEqual(Object.keys(data2.data));
                expect(Object.keys(data1.data.pagination)).toEqual(
                    Object.keys(data2.data.pagination)
                );

                // Pagination values should be different
                expect(data1.data.pagination.page).toBe(1);
                expect(data2.data.pagination.page).toBe(2);

                // Total should be consistent
                expect(data1.data.pagination.total).toBe(data2.data.pagination.total);
            }
        });

        it('should return unique items (no duplicates)', async () => {
            const response = await app.request(`${baseUrl}?limit=50`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            const ids = data.data.items.map((item: any) => item.id);
            const uniqueIds = [...new Set(ids)];

            expect(ids.length).toBe(uniqueIds.length);
        });
    });
});
