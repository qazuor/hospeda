import {
    OWNER_CTA_LABELS,
    OWNER_CTA_SUFFIX,
    OWNER_FALLBACK_PLANS,
    TOURIST_CTA_LABELS,
    TOURIST_FALLBACK_PLANS
} from '@/lib/pricing-fallbacks';
/**
 * Tests for pricing-fallbacks.ts - Hardcoded fallback pricing data.
 */
import { describe, expect, it } from 'vitest';

const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

describe('TOURIST_FALLBACK_PLANS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(TOURIST_FALLBACK_PLANS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have exactly 3 tourist plans for locale %s', (locale) => {
        expect(TOURIST_FALLBACK_PLANS[locale].length).toBe(3);
    });

    it.each(SUPPORTED_LOCALES)('should have a free plan (price=0) for locale %s', (locale) => {
        const plans = TOURIST_FALLBACK_PLANS[locale];
        const freePlan = plans.find((p) => p.price === 0);
        expect(freePlan).toBeDefined();
    });

    it.each(SUPPORTED_LOCALES)(
        'should have all required fields on each plan for locale %s',
        (locale) => {
            const plans = TOURIST_FALLBACK_PLANS[locale];
            for (const plan of plans) {
                expect(typeof plan.name).toBe('string');
                expect(plan.name.length).toBeGreaterThan(0);
                expect(typeof plan.price).toBe('number');
                expect(plan.price).toBeGreaterThanOrEqual(0);
                expect(typeof plan.currency).toBe('string');
                expect(plan.currency.length).toBeGreaterThan(0);
                expect(typeof plan.period).toBe('string');
                expect(plan.period.length).toBeGreaterThan(0);
                expect(Array.isArray(plan.features)).toBe(true);
                expect(plan.features.length).toBeGreaterThan(0);
                expect(typeof plan.cta.label).toBe('string');
                expect(typeof plan.cta.href).toBe('string');
                expect(plan.cta.href).toMatch(/^\//);
            }
        }
    );

    it.each(SUPPORTED_LOCALES)(
        'should have exactly one highlighted plan for locale %s',
        (locale) => {
            const plans = TOURIST_FALLBACK_PLANS[locale];
            const highlighted = plans.filter((p) => p.highlighted === true);
            expect(highlighted.length).toBe(1);
        }
    );

    it('should use ARS currency for es locale', () => {
        const plans = TOURIST_FALLBACK_PLANS.es;
        for (const plan of plans) {
            expect(plan.currency).toBe('ARS');
        }
    });

    it('should use USD currency for en locale', () => {
        const plans = TOURIST_FALLBACK_PLANS.en;
        for (const plan of plans) {
            expect(plan.currency).toBe('USD');
        }
    });
});

describe('OWNER_FALLBACK_PLANS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_FALLBACK_PLANS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have exactly 3 owner plans for locale %s', (locale) => {
        expect(OWNER_FALLBACK_PLANS[locale].length).toBe(3);
    });

    it.each(SUPPORTED_LOCALES)(
        'should have all required fields on each plan for locale %s',
        (locale) => {
            const plans = OWNER_FALLBACK_PLANS[locale];
            for (const plan of plans) {
                expect(typeof plan.name).toBe('string');
                expect(plan.name.length).toBeGreaterThan(0);
                expect(typeof plan.price).toBe('number');
                expect(plan.price).toBeGreaterThan(0);
                expect(typeof plan.currency).toBe('string');
                expect(Array.isArray(plan.features)).toBe(true);
                expect(plan.features.length).toBeGreaterThan(0);
                expect(plan.cta.href).toMatch(/propietario/);
            }
        }
    );

    it.each(SUPPORTED_LOCALES)(
        'should have exactly one highlighted plan for locale %s',
        (locale) => {
            const plans = OWNER_FALLBACK_PLANS[locale];
            const highlighted = plans.filter((p) => p.highlighted === true);
            expect(highlighted.length).toBe(1);
        }
    );
});

describe('TOURIST_CTA_LABELS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(TOURIST_CTA_LABELS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)(
        'should have labels for tourist-free, tourist-plus, tourist-vip for locale %s',
        (locale) => {
            const labels = TOURIST_CTA_LABELS[locale];
            expect(typeof labels['tourist-free']).toBe('string');
            expect(typeof labels['tourist-plus']).toBe('string');
            expect(typeof labels['tourist-vip']).toBe('string');
        }
    );
});

describe('OWNER_CTA_LABELS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_CTA_LABELS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)(
        'should have labels for owner-basico, owner-pro, owner-premium for locale %s',
        (locale) => {
            const labels = OWNER_CTA_LABELS[locale];
            expect(typeof labels['owner-basico']).toBe('string');
            expect(typeof labels['owner-pro']).toBe('string');
            expect(typeof labels['owner-premium']).toBe('string');
        }
    );
});

describe('OWNER_CTA_SUFFIX', () => {
    it('should map owner-basico to basico', () => {
        expect(OWNER_CTA_SUFFIX['owner-basico']).toBe('basico');
    });

    it('should map owner-pro to profesional', () => {
        expect(OWNER_CTA_SUFFIX['owner-pro']).toBe('profesional');
    });

    it('should map owner-premium to premium', () => {
        expect(OWNER_CTA_SUFFIX['owner-premium']).toBe('premium');
    });
});
