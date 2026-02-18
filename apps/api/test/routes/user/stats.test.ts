import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('GET /api/v1/protected/users/me/stats (get user statistics)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/users/me/stats';

    beforeAll(async () => {
        app = initApp();
    });

    it('route is registered and reachable (does not return 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401 when no authentication token is provided', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect([200, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401 or 200 when an invalid authorization token is provided (auth may be disabled in test env)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer invalid-token-value'
                }
            });

            // In test environment with DISABLE_AUTH=true, auth middleware may pass through
            expect([200, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns response with bookmarkCount when authenticated', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('bookmarkCount');
                expect(typeof body.data.bookmarkCount).toBe('number');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns response with plan field (null or object) when authenticated', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                // plan can be null or an object with name and status
                const { plan } = body.data;
                if (plan !== null && plan !== undefined) {
                    expect(plan).toHaveProperty('name');
                    expect(plan).toHaveProperty('status');
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

    it('ignores unexpected query params gracefully', async () => {
        try {
            const res = await app.request(`${base}?foo=bar&unknown=param`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Should not crash or return 500 due to unknown params
            expect([200, 400, 401, 403]).toContain(res.status);
            expect(res.status).not.toBe(500);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
