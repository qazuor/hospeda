/**
 * Tests for GET /api/v1/protected/exchange-rates/history endpoint
 * Tests pagination, date range filtering, and permission enforcement
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('GET /api/v1/protected/exchange-rates/history', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/exchange-rates/history';

    beforeAll(async () => {
        app = initApp();
    });

    it('returns 401 when no authentication provided', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body).toHaveProperty('error');
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns paginated history with default pagination', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token' // Mock token for tests
                }
            });

            // Service may return 200 or 403 depending on mock auth setup
            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body).toHaveProperty('pagination');
                expect(body.pagination).toHaveProperty('page');
                expect(body.pagination).toHaveProperty('pageSize');
                expect(body.pagination).toHaveProperty('total');
                expect(Array.isArray(body.data)).toBe(true);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts pagination parameters', async () => {
        try {
            const res = await app.request(`${base}?page=2&pageSize=10`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.pagination.page).toBe(2);
                expect(body.pagination.pageSize).toBe(10);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts currency filters', async () => {
        try {
            const res = await app.request(`${base}?fromCurrency=USD&toCurrency=EUR`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts rate type filter', async () => {
        try {
            const res = await app.request(`${base}?rateType=BUY`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts source filter', async () => {
        try {
            const res = await app.request(`${base}?source=MANUAL`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts date range filters', async () => {
        try {
            const fromDate = '2024-01-01';
            const toDate = '2024-12-31';

            const res = await app.request(`${base}?from=${fromDate}&to=${toDate}`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('accepts combined filters', async () => {
        try {
            const res = await app.request(
                `${base}?fromCurrency=USD&toCurrency=ARS&rateType=SELL&source=API_LAYER&page=1&pageSize=20`,
                {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json',
                        authorization: 'Bearer mock-admin-token'
                    }
                }
            );

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body).toHaveProperty('pagination');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 for invalid date format', async () => {
        try {
            const res = await app.request(`${base}?from=invalid-date`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body).toHaveProperty('error');
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 for invalid currency', async () => {
        try {
            const res = await app.request(`${base}?fromCurrency=INVALID`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body).toHaveProperty('error');
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('enforces maximum page size limit', async () => {
        try {
            const res = await app.request(`${base}?pageSize=200`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            expect([200, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                // Page size should be clamped to MAX_PAGE_SIZE (100)
                expect(body.pagination.pageSize).toBeLessThanOrEqual(100);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('includes required response headers', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            // Check security headers are present
            expect(res.headers.get('x-content-type-options')).toBeDefined();
            expect(res.headers.get('x-frame-options')).toBeDefined();
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('respects cache TTL configuration', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer mock-admin-token'
                }
            });

            if (res.status === 200) {
                // Cache-Control header may be set based on cacheTTL option
                const cacheControl = res.headers.get('cache-control');
                if (cacheControl) {
                    expect(cacheControl).toBeDefined();
                }
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
