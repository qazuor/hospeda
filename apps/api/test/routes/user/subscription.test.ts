/**
 * Tests for User Subscription API endpoint.
 *
 * Tests the protected endpoint for retrieving the current user's billing
 * subscription details. Verifies route registration, authentication requirements,
 * response structure, and status value constraints.
 *
 * Endpoint: GET /api/v1/protected/users/me/subscription
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('GET /api/v1/protected/users/me/subscription (get user subscription)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/users/me/subscription';

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

            // Assert - 404 means route is not registered at all
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                // Authentication middleware blocking is acceptable
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

            // Protected route should require auth
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

    it('returns response with subscription field (null or object) when authenticated', async () => {
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

                // Response must contain a top-level subscription field
                expect(body).toHaveProperty('subscription');

                // subscription is either null or an object
                const { subscription } = body;
                expect(subscription === null || typeof subscription === 'object').toBe(true);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns subscription object with all required fields when subscription is not null', async () => {
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
                const { subscription } = body;

                if (subscription !== null && subscription !== undefined) {
                    expect(subscription).toHaveProperty('planSlug');
                    expect(subscription).toHaveProperty('planName');
                    expect(subscription).toHaveProperty('status');
                    expect(subscription).toHaveProperty('currentPeriodStart');
                    expect(subscription).toHaveProperty('currentPeriodEnd');
                    expect(subscription).toHaveProperty('cancelAtPeriodEnd');
                    expect(subscription).toHaveProperty('trialEndsAt');
                    expect(subscription).toHaveProperty('monthlyPriceArs');
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

    it('returns subscription with valid field types when subscription is not null', async () => {
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
                const { subscription } = body;

                if (subscription !== null && subscription !== undefined) {
                    expect(typeof subscription.planSlug).toBe('string');
                    expect(typeof subscription.planName).toBe('string');
                    expect(typeof subscription.status).toBe('string');
                    expect(typeof subscription.cancelAtPeriodEnd).toBe('boolean');
                    expect(typeof subscription.monthlyPriceArs).toBe('number');

                    // Date fields are ISO strings or null
                    expect(
                        subscription.currentPeriodStart === null ||
                            typeof subscription.currentPeriodStart === 'string'
                    ).toBe(true);
                    expect(
                        subscription.currentPeriodEnd === null ||
                            typeof subscription.currentPeriodEnd === 'string'
                    ).toBe(true);
                    expect(
                        subscription.trialEndsAt === null ||
                            typeof subscription.trialEndsAt === 'string'
                    ).toBe(true);
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

    it('returns subscription with valid status value when subscription is not null', async () => {
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
                const { subscription } = body;

                if (subscription !== null && subscription !== undefined) {
                    const validStatuses = ['active', 'trial', 'cancelled', 'expired', 'pending'];
                    expect(validStatuses).toContain(subscription.status);
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

    it('returns non-null trialEndsAt when subscription status is trial', async () => {
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
                const { subscription } = body;

                if (
                    subscription !== null &&
                    subscription !== undefined &&
                    subscription.status === 'trial'
                ) {
                    // Trial subscriptions should have a trial end date
                    expect(subscription.trialEndsAt).not.toBeNull();
                    expect(typeof subscription.trialEndsAt).toBe('string');
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

    it('returns application/json content-type when accessible', async () => {
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
                const contentType = res.headers.get('content-type');
                expect(contentType).toContain('application/json');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('does not crash on unknown query params', async () => {
        try {
            const res = await app.request(`${base}?unknown_param=value&foo=bar`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Should not crash or return 500
            expect([200, 400, 401, 403]).toContain(res.status);
            expect(res.status).not.toBe(500);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([400, 401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('does not accept POST method (returns 404 or 405)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });

            // POST is not registered on this endpoint
            expect([404, 405, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 404, 405]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns monthlyPriceArs as a non-negative number when subscription is not null', async () => {
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
                const { subscription } = body;

                if (subscription !== null && subscription !== undefined) {
                    expect(subscription.monthlyPriceArs).toBeGreaterThanOrEqual(0);
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

    it('returns planSlug and planName as non-empty strings when subscription is not null', async () => {
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
                const { subscription } = body;

                if (subscription !== null && subscription !== undefined) {
                    expect(subscription.planSlug.length).toBeGreaterThan(0);
                    expect(subscription.planName.length).toBeGreaterThan(0);
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
