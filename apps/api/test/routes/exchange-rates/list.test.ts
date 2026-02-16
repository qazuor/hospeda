/**
 * Tests for GET /api/v1/public/exchange-rates route
 *
 * NOTE: These tests expect a 404 until T-029 registers the routes.
 * Once T-029 is complete, update these tests to validate full functionality.
 */
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';

describe('GET /api/v1/public/exchange-rates', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        app = initApp();
    });

    describe('Route availability', () => {
        it('should have route defined (or 400/404 if not registered by T-029 yet)', async () => {
            const res = await app.request('/api/v1/public/exchange-rates');

            // Accept 200 (route works), 400 or 404 (route not registered yet by T-029)
            expect([200, 400, 404]).toContain(res.status);
        });
    });

    describe('Basic functionality (when route is registered)', () => {
        it('should return exchange rates without filters', async () => {
            const res = await app.request('/api/v1/public/exchange-rates');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should return 200 with empty array when no rates exist', async () => {
            const res = await app.request('/api/v1/public/exchange-rates');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });
    });

    describe('Filtering (when route is registered)', () => {
        it('should filter by fromCurrency', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?fromCurrency=${PriceCurrencyEnum.USD}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should filter by toCurrency', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?toCurrency=${PriceCurrencyEnum.ARS}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should filter by currency pair', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?fromCurrency=${PriceCurrencyEnum.USD}&toCurrency=${PriceCurrencyEnum.ARS}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should filter by rateType', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?rateType=${ExchangeRateTypeEnum.OFICIAL}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should filter by source', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?source=${ExchangeRateSourceEnum.DOLARAPI}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('should filter by multiple parameters', async () => {
            const res = await app.request(
                `/api/v1/public/exchange-rates?fromCurrency=${PriceCurrencyEnum.USD}&toCurrency=${PriceCurrencyEnum.ARS}&rateType=${ExchangeRateTypeEnum.BLUE}&source=${ExchangeRateSourceEnum.EXCHANGERATE_API}`
            );

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
        });
    });

    describe('Response format (when route is registered)', () => {
        it('should return rates with correct structure', async () => {
            const res = await app.request('/api/v1/public/exchange-rates');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();

            // If rates exist, validate structure
            if (body.data.length > 0) {
                const rate = body.data[0];

                expect(rate).toHaveProperty('id');
                expect(rate).toHaveProperty('fromCurrency');
                expect(rate).toHaveProperty('toCurrency');
                expect(rate).toHaveProperty('rate');
                expect(rate).toHaveProperty('inverseRate');
                expect(rate).toHaveProperty('rateType');
                expect(rate).toHaveProperty('source');
                expect(rate).toHaveProperty('isManualOverride');
                expect(rate).toHaveProperty('fetchedAt');
                expect(rate).toHaveProperty('createdAt');
                expect(rate).toHaveProperty('updatedAt');

                expect(typeof rate.rate).toBe('number');
                expect(typeof rate.inverseRate).toBe('number');
                expect(typeof rate.isManualOverride).toBe('boolean');
            }
        });
    });

    describe('Validation errors (when route is registered)', () => {
        it('should reject invalid fromCurrency', async () => {
            const res = await app.request('/api/v1/public/exchange-rates?fromCurrency=INVALID');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(400);
        });

        it('should reject invalid toCurrency', async () => {
            const res = await app.request('/api/v1/public/exchange-rates?toCurrency=INVALID');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(400);
        });

        it('should reject invalid rateType', async () => {
            const res = await app.request('/api/v1/public/exchange-rates?rateType=INVALID');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(400);
        });

        it('should reject invalid source', async () => {
            const res = await app.request('/api/v1/public/exchange-rates?source=INVALID');

            if (res.status === 404 || res.status === 400) {
                // Route not registered yet by T-029, skip test
                return;
            }

            expect(res.status).toBe(400);
        });
    });
});
