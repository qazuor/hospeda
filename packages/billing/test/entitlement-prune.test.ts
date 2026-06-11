/**
 * Absence tests for the 8 entitlements removed in SPEC-216.
 *
 * These keys were present in the billing config prior to SPEC-216 and must no
 * longer appear in the enum, in ENTITLEMENT_DEFINITIONS, or in any plan grant.
 */
import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_DEFINITIONS } from '../src/config/entitlements.config.js';
import { ALL_PLANS } from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';

/** String values of the 8 removed entitlements (SPEC-216). */
const REMOVED_VALUES = [
    'api_access',
    'dedicated_manager',
    'social_media_integration',
    'white_label',
    'multi_channel_integration',
    'early_access_events',
    'concierge_service',
    'airport_transfers'
] as const;

describe('SPEC-216 — removed entitlement absence', () => {
    describe('EntitlementKey enum', () => {
        it('should not contain any of the 8 removed values', () => {
            // Arrange
            const enumValues = new Set<string>(Object.values(EntitlementKey));

            // Act & Assert
            for (const removed of REMOVED_VALUES) {
                expect(enumValues.has(removed)).toBe(false);
            }
        });
    });

    describe('ENTITLEMENT_DEFINITIONS', () => {
        it('should have no definition entry for any of the 8 removed values', () => {
            // Arrange
            const definedValues = new Set(ENTITLEMENT_DEFINITIONS.map((e) => e.key as string));

            // Act & Assert
            for (const removed of REMOVED_VALUES) {
                expect(definedValues.has(removed)).toBe(false);
            }
        });
    });

    describe('Plan grants', () => {
        it('should grant none of the 8 removed values in any plan', () => {
            // Arrange
            const removedSet = new Set<string>(REMOVED_VALUES);

            // Act & Assert
            for (const plan of ALL_PLANS) {
                for (const granted of plan.entitlements) {
                    expect(removedSet.has(granted as string)).toBe(false);
                }
            }
        });
    });
});
