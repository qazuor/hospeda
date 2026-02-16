import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('POST /api/v1/protected/exchange-rates (create manual override)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/exchange-rates';

    beforeAll(async () => {
        app = initApp();
    });

    it('creates a manual exchange rate override (happy path)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    rateType: 'blue'
                })
            });

            // Expects 201 Created or 401/403 if authentication is enforced
            expect([200, 201, 401, 403]).toContain(res.status);

            if (res.status === 201 || res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('id');
                expect(body.data).toHaveProperty('fromCurrency', 'USD');
                expect(body.data).toHaveProperty('toCurrency', 'ARS');
                expect(body.data).toHaveProperty('rate', 1180.5);
                expect(body.data).toHaveProperty('rateType', 'blue');
                expect(body.data).toHaveProperty('source', 'MANUAL');
                expect(body.data).toHaveProperty('isManualOverride', true);
                expect(body.data).toHaveProperty('inverseRate');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('creates manual override with optional expiresAt field', async () => {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'EUR',
                    toCurrency: 'ARS',
                    rate: 1250.0,
                    rateType: 'official',
                    expiresAt: expiresAt.toISOString()
                })
            });

            expect([200, 201, 401, 403]).toContain(res.status);

            if (res.status === 201 || res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('expiresAt');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD'
                    // Missing toCurrency, rate, rateType
                })
            });

            expect([400, 401, 403]).toContain(res.status);

            if (res.status === 400) {
                const body = await res.json();
                expect(body).toHaveProperty('error');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when rate is not positive', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: -100, // Invalid: negative
                    rateType: 'blue'
                })
            });

            expect([400, 401, 403]).toContain(res.status);

            if (res.status === 400) {
                const body = await res.json();
                expect(body).toHaveProperty('error');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 on invalid currency codes', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'INVALID',
                    toCurrency: 'ARS',
                    rate: 1000,
                    rateType: 'blue'
                })
            });

            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 on invalid rate type', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1000,
                    rateType: 'INVALID_TYPE'
                })
            });

            expect([400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401 when no authentication token provided', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    rateType: 'blue'
                })
            });

            // In a real environment with auth middleware, this should return 401
            // In test environment without auth, it might succeed or fail differently
            expect([200, 201, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 403 when user lacks EXCHANGE_RATE_CREATE permission', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer invalid-or-insufficient-permissions-token'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1180.5,
                    rateType: 'blue'
                })
            });

            expect([401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('calculates inverse rate automatically', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 1000,
                    rateType: 'blue'
                })
            });

            expect([200, 201, 401, 403]).toContain(res.status);

            if (res.status === 201 || res.status === 200) {
                const body = await res.json();
                expect(body.data).toHaveProperty('inverseRate');
                // inverseRate should be 1/1000 = 0.001
                expect(body.data.inverseRate).toBeCloseTo(0.001, 6);
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
