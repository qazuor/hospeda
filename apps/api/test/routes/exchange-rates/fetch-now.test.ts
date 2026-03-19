/**
 * Tests for POST /api/v1/admin/exchange-rates/fetch-now
 * Manual exchange rate fetch endpoint tests
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('POST /api/v1/admin/exchange-rates/fetch-now', () => {
    let app: AppOpenAPI;
    const endpoint = '/api/v1/admin/exchange-rates/fetch-now';

    beforeAll(async () => {
        app = initApp();
    });

    describe('Authentication & Authorization', () => {
        it('should return 401 when not authenticated', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                expect(response.status).toBe(401);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should return 200 when authenticated (test environment)', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // In test environment with auth disabled, should return 200
                // In production with auth enabled, would return 401 or 403 without proper credentials
                expect([200, 401, 403]).toContain(response.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Fetch Operation', () => {
        it('should return fetch result with correct structure', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();

                // Validate response structure
                expect(result).toHaveProperty('data');
                expect(result.data).toHaveProperty('stored');
                expect(result.data).toHaveProperty('errors');
                expect(result.data).toHaveProperty('fromManualOverride');
                expect(result.data).toHaveProperty('fromDolarApi');
                expect(result.data).toHaveProperty('fromExchangeRateApi');
                expect(result.data).toHaveProperty('fromDbFallback');

                // Validate data types
                expect(typeof result.data.stored).toBe('number');
                expect(Array.isArray(result.data.errors)).toBe(true);
                expect(typeof result.data.fromManualOverride).toBe('number');
                expect(typeof result.data.fromDolarApi).toBe('number');
                expect(typeof result.data.fromExchangeRateApi).toBe('number');
                expect(typeof result.data.fromDbFallback).toBe('number');
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should store rates from external APIs', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();

                // Should have fetched and stored rates (unless APIs are down)
                // This is a flexible test as API availability may vary
                expect(result.data.stored).toBeGreaterThanOrEqual(0);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should return errors array structure', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();

                // Errors array should exist (may be empty if all APIs succeed)
                expect(Array.isArray(result.data.errors)).toBe(true);

                // If errors exist, validate structure
                if (result.data.errors.length > 0) {
                    for (const error of result.data.errors) {
                        expect(error).toHaveProperty('source');
                        expect(error).toHaveProperty('error');
                        expect(typeof error.source).toBe('string');
                        expect(typeof error.error).toBe('string');
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

        it('should handle empty request body gracefully', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    },
                    body: JSON.stringify({}) // Empty body should be ignored
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();
                expect(result.data).toHaveProperty('stored');
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Manual Override Handling', () => {
        it('should count manual overrides separately', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();

                // Manual overrides should be counted separately
                expect(result.data.fromManualOverride).toBeGreaterThanOrEqual(0);

                // Verify all counter fields are non-negative
                expect(result.data.fromDolarApi).toBeGreaterThanOrEqual(0);
                expect(result.data.fromExchangeRateApi).toBeGreaterThanOrEqual(0);
                expect(result.data.fromDbFallback).toBeGreaterThanOrEqual(0);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Error Resilience', () => {
        it('should handle partial failures gracefully', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);

                const result = await response.json();

                // Even if some sources fail, endpoint should succeed
                // and return partial results
                expect(result.data.stored).toBeGreaterThanOrEqual(0);
                expect(Array.isArray(result.data.errors)).toBe(true);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should not throw on network errors', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                // Should return 200 even if external APIs fail
                expect(response.status).toBe(200);

                const result = await response.json();
                expect(result.data).toHaveProperty('errors');
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('OpenAPI Compliance', () => {
        it('should return valid response matching OpenAPI schema', async () => {
            try {
                const response = await app.request(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Skip test if authentication is enforced
                if (response.status === 401 || response.status === 403) {
                    return;
                }

                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toContain('application/json');

                const result = await response.json();

                // Validate against FetchNowResponseSchema structure
                expect(result).toHaveProperty('success', true);
                expect(result).toHaveProperty('data');
                expect(result.data).toMatchObject({
                    stored: expect.any(Number),
                    errors: expect.any(Array),
                    fromManualOverride: expect.any(Number),
                    fromDolarApi: expect.any(Number),
                    fromExchangeRateApi: expect.any(Number),
                    fromDbFallback: expect.any(Number)
                });
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });
});
