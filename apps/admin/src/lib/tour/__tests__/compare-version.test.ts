/**
 * Unit tests for `shouldOfferTour` (compare-version).
 *
 * Covers the full truth table described in SPEC-174 §7.3, §10, D9:
 * - seenVersion null / undefined / 0 → always offer.
 * - configVersion === seenVersion → do not offer.
 * - configVersion < seenVersion → do not offer (user saw newer version).
 * - configVersion > seenVersion → re-offer (version bump).
 *
 * Pure function — no React, no DOM.
 *
 * @see apps/admin/src/lib/tour/compare-version.ts
 * @see SPEC-174 §7.3, §10, D9
 */

import { describe, expect, it } from 'vitest';
import { shouldOfferTour } from '../compare-version';

describe('shouldOfferTour', () => {
    // -------------------------------------------------------------------------
    // Null / undefined / zero seenVersion → always offer
    // -------------------------------------------------------------------------

    it('returns true when seenVersion is null (never seen)', () => {
        // Arrange
        // Act + Assert
        expect(shouldOfferTour({ configVersion: 1, seenVersion: null })).toBe(true);
    });

    it('returns true when seenVersion is undefined (never seen)', () => {
        // Arrange
        // Act + Assert
        expect(shouldOfferTour({ configVersion: 1, seenVersion: undefined })).toBe(true);
    });

    it('returns true when seenVersion is 0 (treated as never seen)', () => {
        // Arrange — a new user whose settings have no adminTours entry
        // Act + Assert
        expect(shouldOfferTour({ configVersion: 1, seenVersion: 0 })).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Equal versions → do not offer
    // -------------------------------------------------------------------------

    it('returns false when configVersion equals seenVersion (version 1)', () => {
        expect(shouldOfferTour({ configVersion: 1, seenVersion: 1 })).toBe(false);
    });

    it('returns false when configVersion equals seenVersion (version 3)', () => {
        expect(shouldOfferTour({ configVersion: 3, seenVersion: 3 })).toBe(false);
    });

    // -------------------------------------------------------------------------
    // seenVersion > configVersion → do not re-offer (user saw newer)
    // -------------------------------------------------------------------------

    it('returns false when seenVersion is higher than configVersion', () => {
        // e.g. user was on a future branch and saw v2, config is currently at v1
        expect(shouldOfferTour({ configVersion: 1, seenVersion: 2 })).toBe(false);
    });

    it('returns false when seenVersion is much higher than configVersion', () => {
        expect(shouldOfferTour({ configVersion: 1, seenVersion: 5 })).toBe(false);
    });

    // -------------------------------------------------------------------------
    // configVersion > seenVersion → re-offer (version bump)
    // -------------------------------------------------------------------------

    it('returns true when configVersion is higher than seenVersion by 1', () => {
        expect(shouldOfferTour({ configVersion: 2, seenVersion: 1 })).toBe(true);
    });

    it('returns true when configVersion is much higher than seenVersion', () => {
        expect(shouldOfferTour({ configVersion: 5, seenVersion: 1 })).toBe(true);
    });

    it('returns true when configVersion is 3 and seenVersion is 2', () => {
        expect(shouldOfferTour({ configVersion: 3, seenVersion: 2 })).toBe(true);
    });
});
