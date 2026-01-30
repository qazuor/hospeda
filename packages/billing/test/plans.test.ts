import { describe, expect, it } from 'vitest';
import {
    ALL_PLANS,
    COMPLEX_BASICO_PLAN,
    OWNER_BASICO_PLAN,
    PLANS_BY_CATEGORY,
    TOURIST_FREE_PLAN,
    getDefaultPlan,
    getPlanBySlug
} from '../src/config/plans.config.js';

describe('Plan Configuration', () => {
    describe('ALL_PLANS', () => {
        it('should export 9 plans', () => {
            expect(ALL_PLANS).toHaveLength(9);
        });

        it('should have 3 owner plans', () => {
            const ownerPlans = ALL_PLANS.filter((p) => p.category === 'owner');
            expect(ownerPlans).toHaveLength(3);
        });

        it('should have 3 complex plans', () => {
            const complexPlans = ALL_PLANS.filter((p) => p.category === 'complex');
            expect(complexPlans).toHaveLength(3);
        });

        it('should have 3 tourist plans', () => {
            const touristPlans = ALL_PLANS.filter((p) => p.category === 'tourist');
            expect(touristPlans).toHaveLength(3);
        });
    });

    describe('PLANS_BY_CATEGORY', () => {
        it('should group plans correctly', () => {
            expect(PLANS_BY_CATEGORY.owner).toHaveLength(3);
            expect(PLANS_BY_CATEGORY.complex).toHaveLength(3);
            expect(PLANS_BY_CATEGORY.tourist).toHaveLength(3);
        });
    });

    describe('getPlanBySlug', () => {
        it('should return plan for valid slug', () => {
            const plan = getPlanBySlug('owner-basico');
            expect(plan).toBeDefined();
            expect(plan?.slug).toBe('owner-basico');
        });

        it('should return undefined for invalid slug', () => {
            const plan = getPlanBySlug('invalid-slug');
            expect(plan).toBeUndefined();
        });
    });

    describe('getDefaultPlan', () => {
        it('should return owner-basico as default for owner category', () => {
            const plan = getDefaultPlan('owner');
            expect(plan.slug).toBe('owner-basico');
            expect(plan.isDefault).toBe(true);
        });

        it('should return complex-basico as default for complex category', () => {
            const plan = getDefaultPlan('complex');
            expect(plan.slug).toBe('complex-basico');
            expect(plan.isDefault).toBe(true);
        });

        it('should return tourist-free as default for tourist category', () => {
            const plan = getDefaultPlan('tourist');
            expect(plan.slug).toBe('tourist-free');
            expect(plan.isDefault).toBe(true);
        });
    });

    describe('Plan Structure', () => {
        it('should have required fields in owner-basico plan', () => {
            expect(OWNER_BASICO_PLAN).toMatchObject({
                slug: 'owner-basico',
                name: 'Basico',
                category: 'owner',
                isActive: true,
                isDefault: true
            });
        });

        it('should have pricing in cents', () => {
            expect(OWNER_BASICO_PLAN.monthlyPriceArs).toBe(1500000); // ARS $15,000
        });

        it('should have entitlements array', () => {
            expect(Array.isArray(OWNER_BASICO_PLAN.entitlements)).toBe(true);
            expect(OWNER_BASICO_PLAN.entitlements.length).toBeGreaterThan(0);
        });

        it('should have limits array', () => {
            expect(Array.isArray(OWNER_BASICO_PLAN.limits)).toBe(true);
            expect(OWNER_BASICO_PLAN.limits.length).toBeGreaterThan(0);
        });
    });

    describe('Free Plans', () => {
        it('should have zero price for tourist-free plan', () => {
            expect(TOURIST_FREE_PLAN.monthlyPriceArs).toBe(0);
            expect(TOURIST_FREE_PLAN.annualPriceArs).toBeNull();
        });

        it('should not have trial for free plans', () => {
            expect(TOURIST_FREE_PLAN.hasTrial).toBe(false);
            expect(TOURIST_FREE_PLAN.trialDays).toBe(0);
        });
    });

    describe('Complex Plans', () => {
        it('should have multi-property management entitlement', () => {
            expect(COMPLEX_BASICO_PLAN.entitlements).toContain('multi_property_management');
        });

        it('should have MAX_PROPERTIES limit', () => {
            const propertiesLimit = COMPLEX_BASICO_PLAN.limits.find(
                (l) => l.key === 'max_properties'
            );
            expect(propertiesLimit).toBeDefined();
            expect(propertiesLimit?.value).toBeGreaterThan(0);
        });
    });
});
