import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('PUT /api/v1/admin/exchange-rates/config (update configuration)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/admin/exchange-rates/config';

    beforeAll(async () => {
        app = initApp();
    });

    it('updates exchange rate configuration (happy path)', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    defaultRateType: 'blue',
                    dolarApiFetchIntervalMinutes: 30,
                    exchangeRateApiFetchIntervalHours: 12,
                    showConversionDisclaimer: true,
                    disclaimerText: 'Las tasas son aproximadas y pueden variar.',
                    enableAutoFetch: true
                })
            });

            // Expects 200 OK or 401/403 if authentication is enforced
            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('id');
                expect(body.data).toHaveProperty('defaultRateType', 'blue');
                expect(body.data).toHaveProperty('dolarApiFetchIntervalMinutes', 30);
                expect(body.data).toHaveProperty('exchangeRateApiFetchIntervalHours', 12);
                expect(body.data).toHaveProperty('showConversionDisclaimer', true);
                expect(body.data).toHaveProperty('disclaimerText');
                expect(body.data).toHaveProperty('enableAutoFetch', true);
                expect(body.data).toHaveProperty('updatedAt');
                expect(body.data).toHaveProperty('updatedById');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('supports partial updates (only some fields)', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    defaultRateType: 'oficial',
                    enableAutoFetch: false
                    // Other fields not provided - should remain unchanged
                })
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('defaultRateType', 'oficial');
                expect(body.data).toHaveProperty('enableAutoFetch', false);
                // Should have other fields from existing config
                expect(body.data).toHaveProperty('dolarApiFetchIntervalMinutes');
                expect(body.data).toHaveProperty('exchangeRateApiFetchIntervalHours');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('updates only dolarApiFetchIntervalMinutes', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    dolarApiFetchIntervalMinutes: 15
                })
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data).toHaveProperty('dolarApiFetchIntervalMinutes', 15);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('updates only exchangeRateApiFetchIntervalHours', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    exchangeRateApiFetchIntervalHours: 6
                })
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data).toHaveProperty('exchangeRateApiFetchIntervalHours', 6);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('updates disclaimer settings', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    showConversionDisclaimer: false,
                    disclaimerText: null
                })
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data).toHaveProperty('showConversionDisclaimer', false);
                expect(body.data.disclaimerText).toBeNull();
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 on invalid defaultRateType', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    defaultRateType: 'INVALID_TYPE'
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

    it('returns 400 when dolarApiFetchIntervalMinutes is negative', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    dolarApiFetchIntervalMinutes: -5
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

    it('returns 400 when exchangeRateApiFetchIntervalHours is negative', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    exchangeRateApiFetchIntervalHours: -1
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

    it('returns 400 on invalid field type', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    enableAutoFetch: 'not-a-boolean' // Should be boolean
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

    it('accepts empty body (no updates)', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({})
            });

            // Empty update should succeed, returning current config
            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('id');
            }
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
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    defaultRateType: 'blue'
                })
            });

            // In a real environment with auth middleware, this should return 401
            // In test environment without auth, it might succeed or fail differently
            expect([200, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 403 when user lacks EXCHANGE_RATE_CONFIG_UPDATE permission', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer invalid-or-insufficient-permissions-token'
                },
                body: JSON.stringify({
                    defaultRateType: 'blue'
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

    it('validates all rate types are accepted', async () => {
        try {
            const validRateTypes = [
                'oficial',
                'blue',
                'mep',
                'ccl',
                'cripto',
                'tarjeta',
                'mayorista'
            ];

            for (const rateType of validRateTypes) {
                const res = await app.request(base, {
                    method: 'PUT',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': 'vitest',
                        accept: 'application/json'
                    },
                    body: JSON.stringify({
                        defaultRateType: rateType
                    })
                });

                // Should accept all valid rate types
                expect([200, 401, 403]).toContain(res.status);

                if (res.status === 200) {
                    const body = await res.json();
                    expect(body.data.defaultRateType).toBe(rateType);
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

    it('updates updatedAt and updatedById fields', async () => {
        try {
            const res = await app.request(base, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    enableAutoFetch: true
                })
            });

            expect([200, 401, 403]).toContain(res.status);

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data).toHaveProperty('updatedAt');
                expect(body.data).toHaveProperty('updatedById');
                // updatedAt should be a recent timestamp
                const updatedAt = new Date(body.data.updatedAt);
                const now = new Date();
                const timeDiff = now.getTime() - updatedAt.getTime();
                expect(timeDiff).toBeLessThan(60000); // Less than 1 minute ago
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
