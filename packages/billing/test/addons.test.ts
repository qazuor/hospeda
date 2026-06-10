import { describe, expect, it } from 'vitest';
import {
    AI_SUPPORT_ADDON,
    ALL_ADDONS,
    EXTRA_PHOTOS_ADDON,
    VISIBILITY_BOOST_ADDON,
    getAddonBySlug
} from '../src/config/addons.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('Add-on Configuration', () => {
    describe('ALL_ADDONS', () => {
        it('should export 6 add-ons', () => {
            expect(ALL_ADDONS).toHaveLength(6);
        });

        it('should have one-time add-ons', () => {
            const oneTimeAddons = ALL_ADDONS.filter((a) => a.billingType === 'one_time');
            expect(oneTimeAddons.length).toBeGreaterThan(0);
        });

        it('should have recurring add-ons', () => {
            const recurringAddons = ALL_ADDONS.filter((a) => a.billingType === 'recurring');
            expect(recurringAddons.length).toBeGreaterThan(0);
        });
    });

    describe('getAddonBySlug', () => {
        it('should return addon for valid slug', () => {
            const addon = getAddonBySlug('visibility-boost-7d');
            expect(addon).toBeDefined();
            expect(addon?.slug).toBe('visibility-boost-7d');
        });

        it('should return undefined for invalid slug', () => {
            const addon = getAddonBySlug('invalid-slug');
            expect(addon).toBeUndefined();
        });
    });

    describe('Visibility Boost Add-on', () => {
        it('should be one-time billing', () => {
            expect(VISIBILITY_BOOST_ADDON.billingType).toBe('one_time');
        });

        it('should have duration in days', () => {
            expect(VISIBILITY_BOOST_ADDON.durationDays).toBe(7);
        });

        it('should grant featured listing entitlement', () => {
            expect(VISIBILITY_BOOST_ADDON.grantsEntitlement).toBe('featured_listing');
        });

        it('should target owner and complex categories', () => {
            expect(VISIBILITY_BOOST_ADDON.targetCategories).toEqual(['owner', 'complex']);
        });
    });

    describe('Extra Photos Add-on', () => {
        it('should be recurring billing', () => {
            expect(EXTRA_PHOTOS_ADDON.billingType).toBe('recurring');
        });

        it('should have null duration for recurring', () => {
            expect(EXTRA_PHOTOS_ADDON.durationDays).toBeNull();
        });

        it('should affect MAX_PHOTOS_PER_ACCOMMODATION limit', () => {
            expect(EXTRA_PHOTOS_ADDON.affectsLimitKey).toBe('max_photos_per_accommodation');
        });

        it('should increase limit by 20', () => {
            expect(EXTRA_PHOTOS_ADDON.limitIncrease).toBe(20);
        });
    });

    describe('Add-on Pricing', () => {
        it('should have prices in cents', () => {
            expect(VISIBILITY_BOOST_ADDON.priceArs).toBe(500000); // ARS $5,000
            expect(EXTRA_PHOTOS_ADDON.priceArs).toBe(500000); // ARS $5,000
        });

        it('all add-ons except the deferred ai-support addon should be active', () => {
            // ai-support-monthly ships inactive: its feature route is deferred to a
            // future spec (SPEC-211 §AC-4.2), so it must not be purchasable yet.
            for (const addon of ALL_ADDONS) {
                if (addon.slug === 'ai-support-monthly') {
                    expect(addon.isActive).toBe(false);
                    continue;
                }
                expect(addon.isActive).toBe(true);
            }
        });
    });

    describe('AI Support Add-on (AC-4.1)', () => {
        it('should exist in ALL_ADDONS with slug ai-support-monthly', () => {
            const addon = ALL_ADDONS.find((a) => a.slug === 'ai-support-monthly');
            expect(addon).toBeDefined();
        });

        it('should have recurring billing type', () => {
            expect(AI_SUPPORT_ADDON.billingType).toBe('recurring');
        });

        it('should grant AI_SUPPORT entitlement', () => {
            expect(AI_SUPPORT_ADDON.grantsEntitlement).toBe(EntitlementKey.AI_SUPPORT);
        });

        it('should affect MAX_AI_SUPPORT_PER_MONTH limit key', () => {
            expect(AI_SUPPORT_ADDON.affectsLimitKey).toBe(LimitKey.MAX_AI_SUPPORT_PER_MONTH);
        });

        it('should have a finite positive limitIncrease (not -1)', () => {
            const { limitIncrease } = AI_SUPPORT_ADDON;
            expect(limitIncrease).not.toBeNull();
            expect(Number.isFinite(limitIncrease)).toBe(true);
            expect(limitIncrease as number).toBeGreaterThan(0);
            expect(limitIncrease).not.toBe(-1);
        });

        it('should have null durationDays (recurring)', () => {
            expect(AI_SUPPORT_ADDON.durationDays).toBeNull();
        });

        it('should target owner and complex categories', () => {
            expect(AI_SUPPORT_ADDON.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should be inactive until the ai_support feature ships (deferred)', () => {
            // The ai_support feature route + final pricing are deferred to a future
            // spec (SPEC-211 §AC-4.2). Shipping it active at a placeholder price
            // would let a host pay for a feature that does not exist yet.
            expect(AI_SUPPORT_ADDON.isActive).toBe(false);
        });
    });
});
