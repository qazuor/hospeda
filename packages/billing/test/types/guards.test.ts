/**
 * Tests for billing key type guards — isEntitlementKey, isLimitKey.
 *
 * Verifies that each guard:
 * - Returns true for every valid enum value.
 * - Returns false for unknown strings, empty strings, non-strings.
 */

import { describe, expect, it } from 'vitest';
import { EntitlementKey } from '../../src/types/entitlement.types.js';
import { isEntitlementKey, isLimitKey } from '../../src/types/guards.js';
import { LimitKey } from '../../src/types/plan.types.js';

describe('isEntitlementKey', () => {
    const validKeys = Object.values(EntitlementKey);

    it('returns true for every valid EntitlementKey enum value', () => {
        for (const key of validKeys) {
            // Arrange & Act & Assert
            expect(isEntitlementKey(key)).toBe(true);
        }
    });

    it('returns false for an unknown string', () => {
        expect(isEntitlementKey('BOGUS_ENTITLEMENT')).toBe(false);
    });

    it('returns false for an empty string', () => {
        expect(isEntitlementKey('')).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isEntitlementKey(42)).toBe(false);
    });

    it('returns false for null', () => {
        expect(isEntitlementKey(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isEntitlementKey(undefined)).toBe(false);
    });

    it('returns false for an object', () => {
        expect(isEntitlementKey({ key: EntitlementKey.SAVE_FAVORITES })).toBe(false);
    });

    it('narrows the type so filtered arrays have EntitlementKey[]', () => {
        // Arrange
        const mixed: unknown[] = [
            EntitlementKey.SAVE_FAVORITES,
            'UNKNOWN_KEY',
            EntitlementKey.PUBLISH_ACCOMMODATIONS,
            null
        ];

        // Act
        const typed: EntitlementKey[] = mixed.filter(isEntitlementKey);

        // Assert — only the two valid keys survive the filter
        expect(typed).toHaveLength(2);
        expect(typed).toContain(EntitlementKey.SAVE_FAVORITES);
        expect(typed).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
    });
});

describe('isLimitKey', () => {
    const validKeys = Object.values(LimitKey);

    it('returns true for every valid LimitKey enum value', () => {
        for (const key of validKeys) {
            // Arrange & Act & Assert
            expect(isLimitKey(key)).toBe(true);
        }
    });

    it('returns true for the newly added MAX_ACTIVE_ALERTS', () => {
        expect(isLimitKey(LimitKey.MAX_ACTIVE_ALERTS)).toBe(true);
    });

    it('returns true for the newly added MAX_COMPARE_ITEMS', () => {
        expect(isLimitKey(LimitKey.MAX_COMPARE_ITEMS)).toBe(true);
    });

    it('returns false for an unknown string', () => {
        expect(isLimitKey('UNKNOWN_LIMIT')).toBe(false);
    });

    it('returns false for an empty string', () => {
        expect(isLimitKey('')).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isLimitKey(0)).toBe(false);
    });

    it('returns false for null', () => {
        expect(isLimitKey(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isLimitKey(undefined)).toBe(false);
    });

    it('narrows the type so Object.entries loops can use the key directly', () => {
        // Arrange — simulates a QZPay plan.limits Record<string, number>
        const rawLimits: Record<string, number> = {
            [LimitKey.MAX_ACCOMMODATIONS]: 5,
            unknown_key: 99,
            [LimitKey.MAX_FAVORITES]: 10
        };

        // Act
        const result = new Map<LimitKey, number>();
        for (const [key, value] of Object.entries(rawLimits)) {
            if (isLimitKey(key)) {
                result.set(key, value);
            }
        }

        // Assert — only the two known keys are in the map
        expect(result.size).toBe(2);
        expect(result.get(LimitKey.MAX_ACCOMMODATIONS)).toBe(5);
        expect(result.get(LimitKey.MAX_FAVORITES)).toBe(10);
        expect(result.has('unknown_key' as LimitKey)).toBe(false);
    });
});
