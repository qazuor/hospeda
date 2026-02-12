import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_DEFINITIONS } from '../src/config/entitlements.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';

describe('Entitlement Configuration', () => {
    describe('ENTITLEMENT_DEFINITIONS', () => {
        it('should export all entitlements', () => {
            expect(ENTITLEMENT_DEFINITIONS.length).toBeGreaterThan(0);
        });

        it('should have all EntitlementKey values defined', () => {
            const definedKeys = ENTITLEMENT_DEFINITIONS.map((e) => e.key);
            const allKeys = Object.values(EntitlementKey);

            for (const key of allKeys) {
                expect(definedKeys).toContain(key);
            }
        });

        it('all entitlements should have name and description', () => {
            for (const entitlement of ENTITLEMENT_DEFINITIONS) {
                expect(entitlement.name).toBeTruthy();
                expect(entitlement.description).toBeTruthy();
                expect(typeof entitlement.name).toBe('string');
                expect(typeof entitlement.description).toBe('string');
            }
        });
    });

    describe('Owner Entitlements', () => {
        it('should include PUBLISH_ACCOMMODATIONS', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.PUBLISH_ACCOMMODATIONS
            );
            expect(entitlement).toBeDefined();
            expect(entitlement?.name).toBe('Publish accommodations');
        });

        it('should include VIEW_ADVANCED_STATS', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.VIEW_ADVANCED_STATS
            );
            expect(entitlement).toBeDefined();
        });
    });

    describe('Complex Entitlements', () => {
        it('should include MULTI_PROPERTY_MANAGEMENT', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.MULTI_PROPERTY_MANAGEMENT
            );
            expect(entitlement).toBeDefined();
            expect(entitlement?.name).toBe('Multi-property management');
        });

        it('should include CONSOLIDATED_ANALYTICS', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.CONSOLIDATED_ANALYTICS
            );
            expect(entitlement).toBeDefined();
        });
    });

    describe('Tourist Entitlements', () => {
        it('should include SAVE_FAVORITES', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.SAVE_FAVORITES
            );
            expect(entitlement).toBeDefined();
            expect(entitlement?.name).toBe('Save favorites');
        });

        it('should include VIP_SUPPORT', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.VIP_SUPPORT
            );
            expect(entitlement).toBeDefined();
        });
    });
});
