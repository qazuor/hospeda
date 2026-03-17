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

    describe('Cross-validation', () => {
        it('should have a definition for every EntitlementKey enum value', () => {
            // Arrange
            const allEnumValues = Object.values(EntitlementKey);
            const definedKeys = new Set(ENTITLEMENT_DEFINITIONS.map((e) => e.key));

            // Act & Assert
            for (const enumValue of allEnumValues) {
                expect(definedKeys.has(enumValue)).toBe(true);
            }
        });

        it('should have no duplicate keys in ENTITLEMENT_DEFINITIONS', () => {
            // Arrange
            const keys = ENTITLEMENT_DEFINITIONS.map((e) => e.key);
            const uniqueKeys = new Set(keys);

            // Act & Assert
            expect(uniqueKeys.size).toBe(keys.length);
        });

        it('should have exactly the same count of definitions as enum values', () => {
            // Arrange
            const enumCount = Object.values(EntitlementKey).length;

            // Act & Assert
            expect(ENTITLEMENT_DEFINITIONS).toHaveLength(enumCount);
        });

        it('should have 12 owner entitlements', () => {
            // Arrange - owner entitlements are the first 12 in the definitions array
            const ownerKeys: readonly EntitlementKey[] = [
                EntitlementKey.PUBLISH_ACCOMMODATIONS,
                EntitlementKey.EDIT_ACCOMMODATION_INFO,
                EntitlementKey.VIEW_BASIC_STATS,
                EntitlementKey.VIEW_ADVANCED_STATS,
                EntitlementKey.RESPOND_REVIEWS,
                EntitlementKey.PRIORITY_SUPPORT,
                EntitlementKey.FEATURED_LISTING,
                EntitlementKey.CUSTOM_BRANDING,
                EntitlementKey.API_ACCESS,
                EntitlementKey.DEDICATED_MANAGER,
                EntitlementKey.CREATE_PROMOTIONS,
                EntitlementKey.SOCIAL_MEDIA_INTEGRATION
            ] as const;

            // Act & Assert
            expect(ownerKeys).toHaveLength(12);
            for (const key of ownerKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should have 7 accommodation feature entitlements', () => {
            // Arrange
            const accommodationKeys: readonly EntitlementKey[] = [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                EntitlementKey.CAN_EMBED_VIDEO,
                EntitlementKey.CAN_USE_CALENDAR,
                EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
                EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
                EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
                EntitlementKey.HAS_VERIFICATION_BADGE
            ] as const;

            // Act & Assert
            expect(accommodationKeys).toHaveLength(7);
            for (const key of accommodationKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should have 6 complex entitlements', () => {
            // Arrange
            const complexKeys: readonly EntitlementKey[] = [
                EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
                EntitlementKey.CONSOLIDATED_ANALYTICS,
                EntitlementKey.CENTRALIZED_BOOKING,
                EntitlementKey.STAFF_MANAGEMENT,
                EntitlementKey.WHITE_LABEL,
                EntitlementKey.MULTI_CHANNEL_INTEGRATION
            ] as const;

            // Act & Assert
            expect(complexKeys).toHaveLength(6);
            for (const key of complexKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should have 15 tourist entitlements', () => {
            // Arrange
            const touristKeys: readonly EntitlementKey[] = [
                EntitlementKey.SAVE_FAVORITES,
                EntitlementKey.WRITE_REVIEWS,
                EntitlementKey.READ_REVIEWS,
                EntitlementKey.AD_FREE,
                EntitlementKey.PRICE_ALERTS,
                EntitlementKey.EARLY_ACCESS_EVENTS,
                EntitlementKey.EXCLUSIVE_DEALS,
                EntitlementKey.VIP_SUPPORT,
                EntitlementKey.CONCIERGE_SERVICE,
                EntitlementKey.AIRPORT_TRANSFERS,
                EntitlementKey.VIP_PROMOTIONS_ACCESS,
                EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
                EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
                EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
                EntitlementKey.CAN_VIEW_RECOMMENDATIONS
            ] as const;

            // Act & Assert
            expect(touristKeys).toHaveLength(15);
            for (const key of touristKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should have all 4 categories totaling to the full definitions count', () => {
            // Arrange
            const ownerCount = 12;
            const accommodationCount = 7;
            const complexCount = 6;
            const touristCount = 15;

            // Act & Assert
            expect(ownerCount + accommodationCount + complexCount + touristCount).toBe(
                ENTITLEMENT_DEFINITIONS.length
            );
        });
    });
});
