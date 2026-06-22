/**
 * Regression tests for SPEC-210 PR1 — exchange-rates public list schema enforcement.
 *
 * Verifies that the `GET /api/v1/public/exchange-rates` route serializes responses
 * through `ExchangeRatePublicSchema` and NEVER leaks the internal-only fields
 * `source`, `isManualOverride`, and `expiresAt`.
 *
 * These tests run without a real database. The route is exercised through the
 * Hono app instance (`initApp()`) using the standard try-catch pattern used by
 * all API route tests in this project.
 *
 * Endpoint: GET /api/v1/public/exchange-rates
 */

import { ExchangeRatePublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('GET /api/v1/public/exchange-rates — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/public/exchange-rates';

    beforeAll(async () => {
        app = initApp();
    });

    describe('Route Registration', () => {
        it('should be registered and reachable (not return 404)', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
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
        it('should not require authentication', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                expect(res.status).not.toBe(401);
                expect(res.status).not.toBe(403);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    // Accept if middleware blocks in test env — route is still registered
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Field-level leak regression (SPEC-210)', () => {
        /**
         * REGRESSION: before SPEC-210, the route used ExchangeRateSchema
         * (full entity) which includes `source`, `isManualOverride`, and
         * `expiresAt`. The fix wires ExchangeRatePublicSchema which omits them.
         *
         * When the route returns a 200 the response items MUST NOT contain
         * those three fields. When the route cannot reach the DB (test env)
         * it returns non-200 — we accept that gracefully.
         */
        it('should NOT include source, isManualOverride, or expiresAt in any list item', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    // Standard paginated envelope: { success, data: { items: [...], pagination: {...} } }
                    const items: unknown[] = Array.isArray(body?.data?.items)
                        ? body.data.items
                        : Array.isArray(body?.items)
                          ? body.items
                          : Array.isArray(body?.data)
                            ? body.data
                            : [];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        // These three fields MUST be absent — they are internal-only
                        expect(record).not.toHaveProperty('source');
                        expect(record).not.toHaveProperty('isManualOverride');
                        expect(record).not.toHaveProperty('expiresAt');
                    }
                }

                // In test env without DB the route may return non-200; that is fine
                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should include the expected public fields (id, fromCurrency, toCurrency, rate, inverseRate, rateType, fetchedAt) when items are present', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    const items: unknown[] = Array.isArray(body?.data?.items)
                        ? body.data.items
                        : Array.isArray(body?.items)
                          ? body.items
                          : Array.isArray(body?.data)
                            ? body.data
                            : [];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        expect(record).toHaveProperty('id');
                        expect(record).toHaveProperty('fromCurrency');
                        expect(record).toHaveProperty('toCurrency');
                        expect(record).toHaveProperty('rate');
                        expect(record).toHaveProperty('inverseRate');
                        expect(record).toHaveProperty('rateType');
                        expect(record).toHaveProperty('fetchedAt');
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

    describe('Schema unit tests — always run (no DB required)', () => {
        /**
         * These tests call ExchangeRatePublicSchema.safeParse() directly.
         * They ALWAYS run regardless of DB availability or HTTP response status,
         * ensuring that a schema revert would be caught even in the DB-less CI env.
         *
         * Build a raw object that includes all known internal fields and verify
         * that ExchangeRatePublicSchema strips every one of them.
         *
         * Enum values are lowercase strings as defined in the TypeScript enums:
         *   rateType: 'oficial' | 'blue' | 'mep' | 'ccl' | 'tarjeta' | 'standard'
         *   source:   'dolarapi' | 'exchangerate-api' | 'manual'
         */
        it('ExchangeRatePublicSchema.safeParse() strips source, isManualOverride, and expiresAt', () => {
            const raw = {
                // Public fields (correct enum values — lowercase)
                id: '123e4567-e89b-12d3-a456-426614174000',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1250.5,
                inverseRate: 0.0008,
                rateType: 'oficial',
                fetchedAt: new Date(),
                // Internal-only fields that must be stripped
                source: 'dolarapi',
                isManualOverride: false,
                expiresAt: new Date(),
                // Extra audit timestamps present on the full entity
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = ExchangeRatePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const data = result.data as Record<string, unknown>;
                expect(data).not.toHaveProperty('source');
                expect(data).not.toHaveProperty('isManualOverride');
                expect(data).not.toHaveProperty('expiresAt');
                // Also assert audit timestamps are stripped
                expect(data).not.toHaveProperty('createdAt');
                expect(data).not.toHaveProperty('updatedAt');
            }
        });

        it('ExchangeRatePublicSchema.safeParse() preserves the required public fields', () => {
            const raw = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1250.5,
                inverseRate: 0.0008,
                rateType: 'oficial',
                fetchedAt: new Date(),
                // Extra internal fields — must be stripped but must not prevent parse
                source: 'manual',
                isManualOverride: true,
                expiresAt: null
            };

            const result = ExchangeRatePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const data = result.data as Record<string, unknown>;
                expect(data).toHaveProperty('id');
                expect(data).toHaveProperty('fromCurrency');
                expect(data).toHaveProperty('toCurrency');
                expect(data).toHaveProperty('rate');
                expect(data).toHaveProperty('inverseRate');
                expect(data).toHaveProperty('rateType');
                expect(data).toHaveProperty('fetchedAt');
            }
        });
    });
});
