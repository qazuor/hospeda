import { describe, expect, it } from 'vitest';
import { ALL_COMMERCE_ENTITLEMENT_KEYS } from '../src/config/commerce-entitlements.config.js';
import { ENTITLEMENT_DEFINITIONS } from '../src/config/entitlements.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';

describe('EntitlementKey enum', () => {
    it('should include CAN_USE_COLLECTIONS with the expected string value (SPEC-287 T-001)', () => {
        expect(EntitlementKey.CAN_USE_COLLECTIONS).toBe('can_use_collections');
    });
});

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

        it('should include CAN_USE_COLLECTIONS (SPEC-287 T-002)', () => {
            const entitlement = ENTITLEMENT_DEFINITIONS.find(
                (e) => e.key === EntitlementKey.CAN_USE_COLLECTIONS
            );
            expect(entitlement).toBeDefined();
            expect(entitlement?.name).toBeTruthy();
            expect(entitlement?.description).toBeTruthy();
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

        it('should have 9 owner entitlements', () => {
            // Arrange - owner entitlements (API_ACCESS, DEDICATED_MANAGER, SOCIAL_MEDIA_INTEGRATION removed in SPEC-216)
            const ownerKeys: readonly EntitlementKey[] = [
                EntitlementKey.PUBLISH_ACCOMMODATIONS,
                EntitlementKey.EDIT_ACCOMMODATION_INFO,
                EntitlementKey.VIEW_BASIC_STATS,
                EntitlementKey.VIEW_ADVANCED_STATS,
                EntitlementKey.RESPOND_REVIEWS,
                EntitlementKey.PRIORITY_SUPPORT,
                EntitlementKey.FEATURED_LISTING,
                EntitlementKey.CUSTOM_BRANDING,
                EntitlementKey.CREATE_PROMOTIONS
            ] as const;

            // Act & Assert
            expect(ownerKeys).toHaveLength(9);
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

        it('should have 4 complex entitlements', () => {
            // Arrange (WHITE_LABEL, MULTI_CHANNEL_INTEGRATION removed in SPEC-216)
            const complexKeys: readonly EntitlementKey[] = [
                EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
                EntitlementKey.CONSOLIDATED_ANALYTICS,
                EntitlementKey.CENTRALIZED_BOOKING,
                EntitlementKey.STAFF_MANAGEMENT
            ] as const;

            // Act & Assert
            expect(complexKeys).toHaveLength(4);
            for (const key of complexKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should have 13 tourist entitlements', () => {
            // Arrange (EARLY_ACCESS_EVENTS, CONCIERGE_SERVICE, AIRPORT_TRANSFERS removed in SPEC-216;
            // AD_FREE removed in HOS-16, obsolete — no ad system exists;
            // VIP_PROMOTIONS_ACCESS added in HOS-21 T-003)
            const touristKeys: readonly EntitlementKey[] = [
                EntitlementKey.SAVE_FAVORITES,
                EntitlementKey.WRITE_REVIEWS,
                EntitlementKey.READ_REVIEWS,
                EntitlementKey.PRICE_ALERTS,
                EntitlementKey.EXCLUSIVE_DEALS,
                EntitlementKey.VIP_SUPPORT,
                EntitlementKey.VIP_VISIBILITY_ACCESS,
                EntitlementKey.VIP_PROMOTIONS_ACCESS,
                EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
                EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
                EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
                EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
                EntitlementKey.CAN_USE_COLLECTIONS
            ] as const;

            // Act & Assert
            expect(touristKeys).toHaveLength(13);
            for (const key of touristKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('should not include the obsolete AD_FREE entitlement (HOS-16)', () => {
            // Arrange & Act
            const allKeys = Object.values(EntitlementKey);

            // Assert
            expect(allKeys).not.toContain('ad_free');
            expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === 'ad_free')).toBeUndefined();
        });

        it('should have 6 vertical-wide commerce entitlements (HOS-1074, HOS-734)', () => {
            // Arrange — one EDIT/PUBLISH pair per vertical, plus VIEW_BASIC_STATS
            // on BOTH verticals (HOS-734: it is accommodation's tier-basic key, so
            // it belongs in the floor every commerce tier gets too — not counted
            // once, since `ALL_COMMERCE_ENTITLEMENT_KEYS` flattens per-vertical
            // arrays without deduping). Cross-checked against the vertical→keys
            // map that `plans.config.ts` actually grants from, so this list
            // cannot drift from the catalogue.
            const commerceKeys: readonly EntitlementKey[] = [
                EntitlementKey.EDIT_GASTRONOMY_INFO,
                EntitlementKey.PUBLISH_GASTRONOMY,
                EntitlementKey.VIEW_BASIC_STATS,
                EntitlementKey.EDIT_EXPERIENCE_INFO,
                EntitlementKey.PUBLISH_EXPERIENCE,
                EntitlementKey.VIEW_BASIC_STATS
            ] as const;

            // Act & Assert
            expect(commerceKeys).toHaveLength(6);
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS].sort()).toEqual([...commerceKeys].sort());
            for (const key of commerceKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });

        it('keeps the premium-only brochure key OUT of the vertical-wide map (HOS-1058)', () => {
            // `ALL_COMMERCE_ENTITLEMENT_KEYS` is derived from the map the GATE
            // reads as its floor for EVERY tier of a vertical. A tier
            // differentiator listed there would be handed to básico as well,
            // which is the whole failure this key is defined to avoid — so its
            // absence from that map is the assertion, and its presence in the
            // definitions is what makes it a real, labelled key.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.DOWNLOAD_LISTING_PDF
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find((e) => e.key === EntitlementKey.DOWNLOAD_LISTING_PDF)
            ).toBeDefined();
        });

        it('keeps the pro-only structured-carta key OUT of the vertical-wide map (HOS-895)', () => {
            // Same shape of key, same reason, one tier lower: `-pro` and above
            // grant the carta, so listing it in the floor map would hand it to
            // `-basico` — the exact give-away the tier exists to prevent.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MANAGE_GASTRONOMY_MENU
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find((e) => e.key === EntitlementKey.MANAGE_GASTRONOMY_MENU)
            ).toBeDefined();
        });

        it('keeps the pro-only experience-certificate key OUT of the vertical-wide map (HOS-1057)', () => {
            // Third key of this shape, same reason as the two above and one
            // vertical over: `experience-pro` and upwards grant the certificate,
            // so listing it in the floor map would hand it to
            // `experience-basico` — which is the sellable experience tier today,
            // i.e. the give-away would reach every paying experience owner
            // there is.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find(
                    (e) => e.key === EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
                )
            ).toBeDefined();
        });

        it('keeps the premium-only photo-per-dish key OUT of the vertical-wide map (HOS-1045)', () => {
            // The NARROWEST of this family: `gastronomy-premium` alone, one
            // tier above the carta key two blocks up. Listing it in the floor
            // map would hand it to `-basico` AND to `-pro`, i.e. it would erase
            // the only capability that currently makes premium a step rather
            // than a name — while the gate went on looking like it worked.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MENU_ITEM_PHOTOS
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find((e) => e.key === EntitlementKey.MENU_ITEM_PHOTOS)
            ).toBeDefined();
        });

        it('keeps the pro-only experience-directions key OUT of the vertical-wide map (HOS-1049)', () => {
            // Third key of this shape, same reason: `experience-pro` and above
            // grant the how-to-get-there half, so listing it in the floor map
            // would hand it to `experience-basico` — which today is the ONLY
            // sellable experience tier, so the give-away would be total rather
            // than partial.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find(
                    (e) => e.key === EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS
                )
            ).toBeDefined();
        });

        it('keeps the pro-only menú-del-día key OUT of the vertical-wide map (HOS-1041)', () => {
            // Third key of this shape, same reason as the two above: the floor
            // map is what EVERY tier of a vertical receives, so a paid
            // capability listed there reaches `-basico` and the tier stops
            // meaning anything.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find(
                    (e) => e.key === EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL
                )
            ).toBeDefined();
        });

        it('keeps the pro-only venue-events key OUT of the vertical-wide map (HOS-1042)', () => {
            // Third key of this shape, same reason as the two above: the floor
            // map is what EVERY tier of the vertical receives, so a `-pro`
            // capability listed there would be handed to `-basico`.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MANAGE_GASTRONOMY_EVENTS
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find(
                    (e) => e.key === EntitlementKey.MANAGE_GASTRONOMY_EVENTS
                )
            ).toBeDefined();
        });

        it('keeps the premium-only multi-language-menu key OUT of the vertical-wide map (HOS-1043)', () => {
            // Same shape and same tier as `MENU_ITEM_PHOTOS`: `gastronomy-premium`
            // alone. Listing it in the floor map would hand it to `-basico` AND
            // `-pro`, erasing another capability that makes premium a step
            // rather than a name.
            expect([...ALL_COMMERCE_ENTITLEMENT_KEYS]).not.toContain(
                EntitlementKey.MULTILINGUAL_GASTRONOMY_MENU
            );
            expect(
                ENTITLEMENT_DEFINITIONS.find(
                    (e) => e.key === EntitlementKey.MULTILINGUAL_GASTRONOMY_MENU
                )
            ).toBeDefined();
        });

        it('should have all 7 categories totaling to the full definitions count', () => {
            // Arrange (SPEC-216: owner 12→9, complex 6→4, tourist 15→12; SPEC-287: tourist 12→13;
            // HOS-16: tourist 13→12 (AD_FREE removed); HOS-21 T-003: tourist 12→13 (VIP_PROMOTIONS_ACCESS added);
            // HOS-1074: commerce category added at 4; HOS-1058: commerce 4→5;
            // HOS-895: commerce 5→6; HOS-1049: commerce 6→7;
            // HOS-1057: commerce 7→8; HOS-1041: commerce 8→9;
            // HOS-1045: commerce 9→10; HOS-1042: commerce 10→11;
            // HOS-1043: commerce 11→12; HOS-1044: commerce 12→13)
            const ownerCount = 9;
            const accommodationCount = 7;
            const complexCount = 4;
            const touristCount = 13;
            const aiCount = 6; // AI feature entitlements (SPEC-173 + SPEC-212 AI_TRANSLATE + SPEC-222 AI_ACCOMMODATION_IMPORT)
            // HOS-1074 — one EDIT/PUBLISH pair per commerce vertical (4);
            // HOS-1058 — plus the premium-only printable ficha (1);
            // HOS-895 — plus the pro-and-above structured carta (1);
            // HOS-1049 — plus the pro-and-above meeting-point directions (1);
            // HOS-1057 — plus the pro-and-above experience certificate (1);
            // HOS-1041 — plus the pro-and-above menú del día (1);
            // HOS-1045 — plus the premium-only photo per dish (1);
            // HOS-1042 — plus the pro-and-above venue events agenda (1);
            // HOS-1043 — plus the premium-only multi-language menu (1);
            // HOS-1044 — plus the premium-only menu QR scan analytics (1).
            const commerceCount = 13;

            // Act & Assert
            expect(
                ownerCount +
                    accommodationCount +
                    complexCount +
                    touristCount +
                    aiCount +
                    commerceCount
            ).toBe(ENTITLEMENT_DEFINITIONS.length);
        });

        it('should have 6 AI feature entitlements (SPEC-173 + SPEC-212 + SPEC-222)', () => {
            // Arrange
            const aiKeys: readonly EntitlementKey[] = [
                EntitlementKey.AI_TEXT_IMPROVE,
                EntitlementKey.AI_CHAT,
                EntitlementKey.AI_SEARCH,
                EntitlementKey.AI_SUPPORT,
                EntitlementKey.AI_TRANSLATE,
                EntitlementKey.AI_ACCOMMODATION_IMPORT
            ] as const;

            // Act & Assert
            expect(aiKeys).toHaveLength(6);
            for (const key of aiKeys) {
                expect(ENTITLEMENT_DEFINITIONS.find((e) => e.key === key)).toBeDefined();
            }
        });
    });
});
