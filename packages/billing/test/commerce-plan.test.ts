/**
 * Commerce-listing plan definition tests (SPEC-239 T-049).
 *
 * Asserts the commerce plan is defined with the locked shape and is
 * deliberately EXCLUDED from `ALL_PLANS` (so the accommodation plan list, the
 * grant-matrix snapshot, and config-drift checks stay accommodation-only — the
 * commerce plan is isolated via the `product_domain` column instead).
 */
import { describe, expect, it } from 'vitest';
import { ALL_PLANS, COMMERCE_LISTING_PLAN } from '../src/config/plans.config.js';

describe('COMMERCE_LISTING_PLAN (SPEC-239 T-049)', () => {
    it('is defined with a recognizable commerce slug', () => {
        expect(COMMERCE_LISTING_PLAN.slug).toBe('commerce-listing');
        expect(COMMERCE_LISTING_PLAN.name).toBe('Commerce Listing');
    });

    it('has no trial (commerce listings do not get a trial)', () => {
        expect(COMMERCE_LISTING_PLAN.hasTrial).toBe(false);
        expect(COMMERCE_LISTING_PLAN.trialDays).toBe(0);
    });

    it('has no entitlements and no limits (visibility driven by subscription status)', () => {
        expect(COMMERCE_LISTING_PLAN.entitlements).toEqual([]);
        expect(COMMERCE_LISTING_PLAN.limits).toEqual([]);
    });

    it('carries a positive monthly price placeholder and no annual price', () => {
        expect(COMMERCE_LISTING_PLAN.monthlyPriceArs).toBeGreaterThan(0);
        expect(COMMERCE_LISTING_PLAN.annualPriceArs).toBeNull();
    });

    it('is active so it can be subscribed to', () => {
        expect(COMMERCE_LISTING_PLAN.isActive).toBe(true);
    });

    it('is EXCLUDED from ALL_PLANS (isolated via product_domain, not the plan list)', () => {
        const slugs = ALL_PLANS.map((p) => p.slug);
        expect(slugs).not.toContain(COMMERCE_LISTING_PLAN.slug);
        // Sanity: ALL_PLANS still has exactly the 9 accommodation-tier plans.
        expect(ALL_PLANS).toHaveLength(9);
    });
});
