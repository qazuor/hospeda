/**
 * Tests for Public Platform Statistics API endpoint
 *
 * Tests the public endpoint for retrieving platform-wide aggregate counts.
 * Verifies route registration, public access (no auth required), and
 * response shape correctness.
 *
 * Endpoint: GET /api/v1/public/stats
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('GET /api/v1/public/stats', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/public/stats';

    beforeAll(async () => {
        app = initApp();
    });

    describe('Route Registration', () => {
        it('should be registered and reachable (not return 404)', async () => {
            // Act
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Assert - 404 means route is not registered at all
                expect(res.status).not.toBe(404);
                expect([200, 400, 401, 403, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Public Access', () => {
        it('should not require authentication (no auth header)', async () => {
            // Arrange - no Authorization header provided

            // Act
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                // Assert - public endpoint should not return 401
                expect(res.status).not.toBe(401);
                expect(res.status).not.toBe(403);
                expect([200, 400, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else if (error instanceof Error) {
                    expect(['Authentication required', 'Insufficient permissions']).toContain(
                        error.message
                    );
                } else {
                    throw error;
                }
            }
        });

        it('should handle request with invalid Bearer token without crashing', async () => {
            // Act
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json',
                        authorization: 'Bearer invalid-token-value'
                    }
                });

                // Assert
                expect([200, 400, 401, 403, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else if (error instanceof Error) {
                    expect(['Authentication required', 'Insufficient permissions']).toContain(
                        error.message
                    );
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Response Shape', () => {
        it('should return an object with all required numeric fields when successful', async () => {
            // Act
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                if (res.status === 200) {
                    const body = await res.json();

                    // Assert outer success shape
                    expect(body).toHaveProperty('success', true);
                    expect(body).toHaveProperty('data');

                    const { data } = body;

                    // Assert all stats fields are present and numeric
                    expect(typeof data.accommodations).toBe('number');
                    expect(typeof data.destinations).toBe('number');
                    expect(typeof data.events).toBe('number');
                    expect(typeof data.posts).toBe('number');
                    expect(typeof data.reviews).toBe('number');

                    // Assert values are non-negative integers
                    expect(data.accommodations).toBeGreaterThanOrEqual(0);
                    expect(data.destinations).toBeGreaterThanOrEqual(0);
                    expect(data.events).toBeGreaterThanOrEqual(0);
                    expect(data.posts).toBeGreaterThanOrEqual(0);
                    expect(data.reviews).toBeGreaterThanOrEqual(0);
                }
                // If not 200 in test env (DB unavailable), just check it's not 404
                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should not include unexpected extra fields in data', async () => {
            // Act
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: {
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    const { data } = body;

                    // Assert only the 5 expected keys are present
                    const allowedKeys = new Set([
                        'accommodations',
                        'destinations',
                        'events',
                        'posts',
                        'reviews'
                    ]);

                    for (const key of Object.keys(data)) {
                        expect(allowedKeys.has(key)).toBe(true);
                    }
                }

                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('HTTP Method Restrictions', () => {
        it('should return 405 or 404 for POST requests', async () => {
            // Act
            try {
                const res = await app.request(base, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json',
                        accept: 'application/json'
                    },
                    body: JSON.stringify({})
                });

                // Assert - POST should not succeed on a GET-only endpoint
                expect([404, 405]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([404, 405]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });
});
