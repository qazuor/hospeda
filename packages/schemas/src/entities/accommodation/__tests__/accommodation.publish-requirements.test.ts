/**
 * @file accommodation.publish-requirements.test.ts
 * @description Regression tests for the single publish-requirement list
 * (H-101 / H-94).
 *
 * The bug this list exists to kill: the publish gate on the server
 * (`capacity`/`minNights`/`bedrooms`/`bathrooms`) and the editor hub's warnings
 * (photos, contact, description, coordinates) were written separately and did
 * not intersect at all. The editor warned about what did not block and stayed
 * silent about what did.
 *
 * These tests assert the properties that make a SHARED list meaningful — that
 * every requirement names the editor section that can fix it, that the missing
 * set is reported per-field rather than collapsed, and that the machine-readable
 * `reason` round-trips. A list that lost any of those would still typecheck
 * while re-opening the bug.
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    buildPublishRequirementsReason,
    isAccommodationPublishRequirementId,
    PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX,
    parsePublishRequirementsReason,
    resolveMissingPublishRequirements
} from '../accommodation.publish-requirements';

/** A listing that satisfies every publish requirement. */
const COMPLETE = {
    capacity: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
} as const;

describe('ACCOMMODATION_PUBLISH_REQUIREMENTS', () => {
    it('should route every requirement to an editor section that can fix it', () => {
        // Arrange / Act
        const withoutSection = ACCOMMODATION_PUBLISH_REQUIREMENTS.filter(
            (requirement) => !requirement.editorSectionId
        );

        // Assert — a requirement the editor cannot point at is exactly the
        // invisible `minNights` case that produced H-94.
        expect(withoutSection).toEqual([]);
    });

    it('should give every requirement its own label key', () => {
        // Arrange / Act
        const labelKeys = ACCOMMODATION_PUBLISH_REQUIREMENTS.map((r) => r.labelKey);

        // Assert — one shared key would collapse back into the single
        // "faltan datos de capacidad" message that named the wrong fields.
        expect(new Set(labelKeys).size).toBe(labelKeys.length);
    });

    it('should require the main image (owner decision, 14/08)', () => {
        // Arrange / Act
        const ids = ACCOMMODATION_PUBLISH_REQUIREMENTS.map((r) => r.id);

        // Assert — H-101 mitad A: the hub warned "Sin fotos" and publish
        // succeeded anyway, leaving a public page with a broken <img>.
        expect(ids).toContain('mainImage');
    });
});

describe('resolveMissingPublishRequirements', () => {
    it('should return an empty list when every requirement is satisfied', () => {
        // Arrange / Act
        const missing = resolveMissingPublishRequirements({ input: COMPLETE });

        // Assert
        expect(missing).toEqual([]);
    });

    it('should name the ONLY field that is actually missing', () => {
        // Arrange — the exact production shape from H-94: bedrooms and capacity
        // present, bathrooms absent. The old message claimed all three.
        const input = { ...COMPLETE, bathrooms: undefined };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert
        expect(missing).toEqual(['bathrooms']);
    });

    it('should report minNights, which the editor never mentioned', () => {
        // Arrange
        const input = { ...COMPLETE, minNights: undefined };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert — H-94: a listing missing only `minNights` was rejected with a
        // message about guests, bedrooms and bathrooms, all three of them fine.
        expect(missing).toEqual(['minNights']);
    });

    it('should report a missing main image on its own', () => {
        // Arrange
        const input = { ...COMPLETE, hasMainImage: false };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert
        expect(missing).toEqual(['mainImage']);
    });

    it('should report every missing field, not just the first', () => {
        // Arrange
        const input = {
            capacity: undefined,
            minNights: undefined,
            bedrooms: undefined,
            bathrooms: undefined,
            hasMainImage: false
        };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert — collapsing to one field would recreate the "tells you one
        // thing, then rejects for the next" loop.
        expect(missing).toEqual(['capacity', 'minNights', 'bedrooms', 'bathrooms', 'mainImage']);
    });

    it('should treat null the same as undefined', () => {
        // Arrange — the editor sends `null` for a cleared numeric field while a
        // never-set one arrives `undefined`. A guard that only checked
        // `undefined` would let a cleared field through.
        const input = { ...COMPLETE, bathrooms: null };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert
        expect(missing).toEqual(['bathrooms']);
    });

    it('should accept zero as a real answer for bathrooms and minNights', () => {
        // Arrange — 0 is falsy but a legitimately supplied value; a truthiness
        // check would reject a studio with a shared bathroom.
        const input = { ...COMPLETE, bathrooms: 0, minNights: 0 };

        // Act
        const missing = resolveMissingPublishRequirements({ input });

        // Assert
        expect(missing).toEqual([]);
    });
});

describe('publish-requirement reason round-trip', () => {
    it('should build a reason that carries every missing field', () => {
        // Arrange / Act
        const reason = buildPublishRequirementsReason({ missing: ['bathrooms', 'mainImage'] });

        // Assert — `reason` is the ONLY channel that survives production:
        // `details` is stripped whenever HOSPEDA_API_DEBUG_ERRORS is false.
        expect(reason).toBe(`${PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX}bathrooms,mainImage`);
    });

    it('should parse its own reason back into the same field list', () => {
        // Arrange
        const reason = buildPublishRequirementsReason({
            missing: ['capacity', 'minNights', 'bedrooms', 'bathrooms', 'mainImage']
        });

        // Act
        const parsed = parsePublishRequirementsReason({ reason });

        // Assert
        expect(parsed).toEqual(['capacity', 'minNights', 'bedrooms', 'bathrooms', 'mainImage']);
    });

    it('should return an empty list for an unrelated reason', () => {
        // Arrange / Act
        const parsed = parsePublishRequirementsReason({ reason: 'subscription_required' });

        // Assert — the button must not read a subscription rejection as a
        // missing-field one, which is the H-99 confusion in reverse.
        expect(parsed).toEqual([]);
    });

    it('should return an empty list for a null or undefined reason', () => {
        // Arrange / Act / Assert
        expect(parsePublishRequirementsReason({ reason: null })).toEqual([]);
        expect(parsePublishRequirementsReason({ reason: undefined })).toEqual([]);
    });

    it('should drop unknown field names instead of trusting the wire', () => {
        // Arrange — a stale client or a tampered payload must not inject an
        // arbitrary id the UI would then try to look up.
        const reason = `${PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX}bathrooms,notAField`;

        // Act
        const parsed = parsePublishRequirementsReason({ reason });

        // Assert
        expect(parsed).toEqual(['bathrooms']);
    });
});

describe('isAccommodationPublishRequirementId', () => {
    it('should accept every declared requirement id', () => {
        // Arrange / Act / Assert
        for (const requirement of ACCOMMODATION_PUBLISH_REQUIREMENTS) {
            expect(isAccommodationPublishRequirementId(requirement.id)).toBe(true);
        }
    });

    it('should reject an unknown id', () => {
        // Arrange / Act / Assert
        expect(isAccommodationPublishRequirementId('beds')).toBe(false);
        expect(isAccommodationPublishRequirementId('')).toBe(false);
    });
});
