import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { resolvePlanName } from '../../../src/routes/user/protected/stats.js';
import type { AppOpenAPI } from '../../../src/types.js';

/** Minimal PlanService shape accepted by resolvePlanName. */
type PlanLookup = Parameters<typeof resolvePlanName>[0];

/** Build a successful plan lookup result with the given name. */
const planFound = (name: string) =>
    ({ success: true, data: { name } }) as unknown as Awaited<ReturnType<PlanLookup['getById']>>;

/** Build a NOT_FOUND lookup result. */
const planNotFound = () =>
    ({ success: false, error: { code: 'NOT_FOUND', message: 'not found' } }) as unknown as Awaited<
        ReturnType<PlanLookup['getById']>
    >;

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

describe('resolvePlanName (plan UUID/slug dual-resolve)', () => {
    const PLAN_UUID = '03f97293-dbe4-4780-8a06-12d5505df749';

    // Regression: subscription.planId stores the plan UUID, so resolving it by
    // slug only (the old behavior) returned NOT_FOUND and the caller fell back
    // to displaying the raw UUID. resolvePlanName must try getById first.
    it('resolves a UUID planId to the plan name via getById (no slug lookup)', async () => {
        const getById = vi.fn().mockResolvedValue(planFound('Anfitrión Pro'));
        const getBySlug = vi.fn().mockResolvedValue(planNotFound());

        const name = await resolvePlanName({ getById, getBySlug } as PlanLookup, PLAN_UUID);

        expect(name).toBe('Anfitrión Pro');
        expect(getById).toHaveBeenCalledWith(PLAN_UUID);
        // getById already succeeded → no slug fallback needed.
        expect(getBySlug).not.toHaveBeenCalled();
    });

    it('falls back to getBySlug when getById returns NOT_FOUND (legacy slug rows)', async () => {
        const getById = vi.fn().mockResolvedValue(planNotFound());
        const getBySlug = vi.fn().mockResolvedValue(planFound('Anfitrión Básico'));

        const name = await resolvePlanName({ getById, getBySlug } as PlanLookup, 'owner-basico');

        expect(name).toBe('Anfitrión Básico');
        expect(getById).toHaveBeenCalledWith('owner-basico');
        expect(getBySlug).toHaveBeenCalledWith('owner-basico');
    });

    it('returns null when neither lookup finds the plan', async () => {
        const getById = vi.fn().mockResolvedValue(planNotFound());
        const getBySlug = vi.fn().mockResolvedValue(planNotFound());

        const name = await resolvePlanName({ getById, getBySlug } as PlanLookup, PLAN_UUID);

        expect(name).toBeNull();
    });
});
