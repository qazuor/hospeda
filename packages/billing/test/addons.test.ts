import { describe, expect, it } from 'vitest';
import {
    ALL_ADDONS,
    EXTRA_PHOTOS_ADDON,
    VISIBILITY_BOOST_ADDON,
    getAddonBySlug
} from '../src/config/addons.config.js';

describe('Add-on Configuration', () => {
    describe('ALL_ADDONS', () => {
        it('should export 5 add-ons', () => {
            expect(ALL_ADDONS).toHaveLength(5);
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

        it('all add-ons should be active', () => {
            for (const addon of ALL_ADDONS) {
                expect(addon.isActive).toBe(true);
            }
        });
    });
});
