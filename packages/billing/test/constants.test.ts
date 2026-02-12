import { describe, expect, it } from 'vitest';
import {
    COMPLEX_TRIAL_DAYS,
    DEFAULT_CURRENCY,
    ENTITLEMENT_CACHE_TTL_MS,
    MAX_PAYMENT_RETRY_ATTEMPTS,
    MERCADO_PAGO_DEFAULT_TIMEOUT_MS,
    OWNER_TRIAL_DAYS,
    PAYMENT_GRACE_PERIOD_DAYS,
    PLAN_CACHE_TTL_MS,
    REFERENCE_CURRENCY
} from '../src/constants/billing.constants.js';

describe('Billing Constants', () => {
    describe('Trial periods', () => {
        it('should define owner trial days as a positive integer', () => {
            expect(OWNER_TRIAL_DAYS).toBeGreaterThan(0);
            expect(Number.isInteger(OWNER_TRIAL_DAYS)).toBe(true);
        });

        it('should define complex trial days as a positive integer', () => {
            expect(COMPLEX_TRIAL_DAYS).toBeGreaterThan(0);
            expect(Number.isInteger(COMPLEX_TRIAL_DAYS)).toBe(true);
        });

        it('should have trial days within a reasonable range (1-90)', () => {
            expect(OWNER_TRIAL_DAYS).toBeGreaterThanOrEqual(1);
            expect(OWNER_TRIAL_DAYS).toBeLessThanOrEqual(90);
            expect(COMPLEX_TRIAL_DAYS).toBeGreaterThanOrEqual(1);
            expect(COMPLEX_TRIAL_DAYS).toBeLessThanOrEqual(90);
        });
    });

    describe('Payment configuration', () => {
        it('should define grace period as a positive integer', () => {
            expect(PAYMENT_GRACE_PERIOD_DAYS).toBeGreaterThan(0);
            expect(Number.isInteger(PAYMENT_GRACE_PERIOD_DAYS)).toBe(true);
        });

        it('should have grace period within a reasonable range (1-30)', () => {
            expect(PAYMENT_GRACE_PERIOD_DAYS).toBeGreaterThanOrEqual(1);
            expect(PAYMENT_GRACE_PERIOD_DAYS).toBeLessThanOrEqual(30);
        });

        it('should define max retry attempts as a positive integer', () => {
            expect(MAX_PAYMENT_RETRY_ATTEMPTS).toBeGreaterThan(0);
            expect(Number.isInteger(MAX_PAYMENT_RETRY_ATTEMPTS)).toBe(true);
        });

        it('should have retry attempts within a reasonable range (1-10)', () => {
            expect(MAX_PAYMENT_RETRY_ATTEMPTS).toBeGreaterThanOrEqual(1);
            expect(MAX_PAYMENT_RETRY_ATTEMPTS).toBeLessThanOrEqual(10);
        });
    });

    describe('Cache TTLs', () => {
        it('should define entitlement cache TTL as a positive number (milliseconds)', () => {
            expect(ENTITLEMENT_CACHE_TTL_MS).toBeGreaterThan(0);
        });

        it('should define plan cache TTL as a positive number (milliseconds)', () => {
            expect(PLAN_CACHE_TTL_MS).toBeGreaterThan(0);
        });

        it('should have plan cache TTL greater than or equal to entitlement cache TTL', () => {
            expect(PLAN_CACHE_TTL_MS).toBeGreaterThanOrEqual(ENTITLEMENT_CACHE_TTL_MS);
        });

        it('should have cache TTLs within reasonable ranges', () => {
            // Entitlement cache: between 1 minute and 1 hour
            expect(ENTITLEMENT_CACHE_TTL_MS).toBeGreaterThanOrEqual(60 * 1000);
            expect(ENTITLEMENT_CACHE_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);

            // Plan cache: between 5 minutes and 24 hours
            expect(PLAN_CACHE_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
            expect(PLAN_CACHE_TTL_MS).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
        });
    });

    describe('Currency configuration', () => {
        it('should define default currency as a valid 3-letter ISO code', () => {
            expect(DEFAULT_CURRENCY).toMatch(/^[A-Z]{3}$/);
        });

        it('should define reference currency as a valid 3-letter ISO code', () => {
            expect(REFERENCE_CURRENCY).toMatch(/^[A-Z]{3}$/);
        });

        it('should use ARS as default currency', () => {
            expect(DEFAULT_CURRENCY).toBe('ARS');
        });

        it('should use USD as reference currency', () => {
            expect(REFERENCE_CURRENCY).toBe('USD');
        });
    });

    describe('External service timeouts', () => {
        it('should define MercadoPago timeout as a positive number (milliseconds)', () => {
            expect(MERCADO_PAGO_DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
        });

        it('should have MercadoPago timeout within a reasonable range (1s-30s)', () => {
            expect(MERCADO_PAGO_DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
            expect(MERCADO_PAGO_DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(30000);
        });
    });
});
