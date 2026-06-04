/**
 * Pure-function tests for addon-plan-change.helpers after T-026 cutover (SPEC-192 T-026)
 *
 * Verifies that:
 * - `resolvePlanBaseLimit` now accepts a `Record<string,number>` limits map
 *   (DB shape from PlanService) instead of a plan slug string.
 * - `computeDirection` now accepts pre-fetched limits maps for old and new plan
 *   instead of plan ID strings.
 * - Neither function uses `getPlanBySlug` from `@repo/billing` (no DB/config dependency).
 *
 * These are pure-function unit tests — no mocking needed.
 *
 * @module test/billing/addon-plan-change.helpers.cutover.test
 */

import { describe, expect, it } from 'vitest';
import {
    computeDirection,
    resolvePlanBaseLimit
} from '../../src/services/billing/addon/addon-plan-change.helpers';

// ─── resolvePlanBaseLimit tests ───────────────────────────────────────────────

describe('resolvePlanBaseLimit — post-T-026 pure DB-shape API (SPEC-192 T-026)', () => {
    it('should return the value for a present key in the limits map', () => {
        // Arrange
        const limits = { max_accommodations: 5, max_photos_per_accommodation: 10 };

        // Act & Assert
        expect(resolvePlanBaseLimit(limits, 'max_accommodations')).toBe(5);
        expect(resolvePlanBaseLimit(limits, 'max_photos_per_accommodation')).toBe(10);
    });

    it('should return 0 for a key not present in the limits map', () => {
        // Arrange
        const limits = { max_accommodations: 5 };

        // Act & Assert
        expect(resolvePlanBaseLimit(limits, 'unknown_key')).toBe(0);
    });

    it('should return -1 for unlimited keys', () => {
        // Arrange — -1 is the sentinel for "unlimited" in QZPay storage format
        const limits = { max_accommodations: -1 };

        // Act & Assert
        expect(resolvePlanBaseLimit(limits, 'max_accommodations')).toBe(-1);
    });

    it('should return 0 for an empty limits map', () => {
        // Act & Assert
        expect(resolvePlanBaseLimit({}, 'max_accommodations')).toBe(0);
    });

    it('should return 0 for a key with value 0', () => {
        // Arrange
        const limits = { max_accommodations: 0 };

        // Act & Assert
        expect(resolvePlanBaseLimit(limits, 'max_accommodations')).toBe(0);
    });
});

// ─── computeDirection tests ───────────────────────────────────────────────────

describe('computeDirection — post-T-026 limits-map API (SPEC-192 T-026)', () => {
    it('should return "upgrade" when new plan has higher total limits', () => {
        // Arrange
        const oldLimits = { max_accommodations: 3 };
        const newLimits = { max_accommodations: 10 };

        // Act
        const direction = computeDirection(['max_accommodations'], oldLimits, newLimits);

        // Assert
        expect(direction).toBe('upgrade');
    });

    it('should return "downgrade" when new plan has lower total limits', () => {
        // Arrange
        const oldLimits = { max_accommodations: 10 };
        const newLimits = { max_accommodations: 3 };

        // Act
        const direction = computeDirection(['max_accommodations'], oldLimits, newLimits);

        // Assert
        expect(direction).toBe('downgrade');
    });

    it('should return "lateral" when plans have equal total limits', () => {
        // Arrange
        const oldLimits = { max_accommodations: 5 };
        const newLimits = { max_accommodations: 5 };

        // Act
        const direction = computeDirection(['max_accommodations'], oldLimits, newLimits);

        // Assert
        expect(direction).toBe('lateral');
    });

    it('should return "lateral" when limit keys array is empty', () => {
        // Act — no keys → no comparison → lateral
        const direction = computeDirection(
            [],
            { max_accommodations: 10 },
            { max_accommodations: 1 }
        );

        // Assert
        expect(direction).toBe('lateral');
    });

    it('should exclude -1 (unlimited) values from the sum', () => {
        // Arrange — old has unlimited for max_accommodations (excluded from sum)
        const oldLimits = { max_accommodations: -1, max_photos_per_accommodation: 10 };
        // new has max_accommodations=5 (included) + max_photos_per_accommodation=20 (included)
        const newLimits = { max_accommodations: 5, max_photos_per_accommodation: 20 };

        // Act — oldTotal=10 (-1 excluded), newTotal=5+20=25 → upgrade
        const direction = computeDirection(
            ['max_accommodations', 'max_photos_per_accommodation'],
            oldLimits,
            newLimits
        );

        // Assert
        expect(direction).toBe('upgrade');
    });

    it('should handle multiple limit keys spanning old and new plans correctly', () => {
        // Arrange — 2 keys: old total=10+5=15, new total=10+10=20 → upgrade
        const oldLimits = { max_accommodations: 10, max_photos_per_accommodation: 5 };
        const newLimits = { max_accommodations: 10, max_photos_per_accommodation: 10 };

        // Act
        const direction = computeDirection(
            ['max_accommodations', 'max_photos_per_accommodation'],
            oldLimits,
            newLimits
        );

        // Assert
        expect(direction).toBe('upgrade');
    });

    it('should return 0 for missing keys in either plan limits map', () => {
        // Arrange — key not present in old plan, but present in new → 0 vs 5 → upgrade
        const oldLimits: Record<string, number> = {};
        const newLimits = { max_accommodations: 5 };

        // Act
        const direction = computeDirection(['max_accommodations'], oldLimits, newLimits);

        // Assert
        expect(direction).toBe('upgrade');
    });
});
