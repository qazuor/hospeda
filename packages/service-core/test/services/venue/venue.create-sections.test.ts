/**
 * Create-time section-presence rule — unit tests (HOS-2052, TEST:2052:2).
 *
 * Pure helper only: no DB, no service instance. The business line that offers
 * the `nightInfo` section is read from the catalog
 * (`resolveSectionBusinessLines`), never written as a literal (G-FAC-03).
 */

import { resolveSectionBusinessLines, ServiceErrorCode, VenueEntryKindEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assertVenueCreateSectionsPresent,
    SECTION_ABSENT_REASON
} from '../../../src/services/venue/venue.create-sections';
import { ServiceError } from '../../../src/types';

const NIGHT_INFO_FIELDS = ['entryKind', 'entryNoteI18n', 'entryPriceFrom'] as const;

/** The business line values the catalog says offer `nightInfo`. */
const offeringLines = resolveSectionBusinessLines({
    vertical: 'venue',
    sectionId: 'nightInfo'
}).map((line) => line.value);

function captureError(run: () => void): ServiceError {
    try {
        run();
    } catch (error) {
        if (error instanceof ServiceError) return error;
        throw error;
    }
    throw new Error('expected the rule to throw');
}

describe('assertVenueCreateSectionsPresent', () => {
    it('returns without throwing for an empty body', () => {
        expect(() =>
            assertVenueCreateSectionsPresent({ body: {}, businessLines: [] })
        ).not.toThrow();
    });

    it('returns without throwing when the body is undefined', () => {
        expect(() =>
            assertVenueCreateSectionsPresent({ body: undefined, businessLines: [] })
        ).not.toThrow();
    });

    it('allows a touched common section even with no business lines', () => {
        expect(() =>
            assertVenueCreateSectionsPresent({ body: { faqs: [] }, businessLines: [] })
        ).not.toThrow();
    });

    it('rejects a touched nightInfo section without the business line that offers it', () => {
        const error = captureError(() =>
            assertVenueCreateSectionsPresent({
                body: { entryKind: VenueEntryKindEnum.FREE },
                businessLines: []
            })
        );

        expect(error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(error.message).toBe('Section is not offered by the listing business lines');
        expect(error.reason).toBe(SECTION_ABSENT_REASON);
        expect(error.details).toEqual({ reason: 'SECTION_ABSENT', section: 'nightInfo' });
    });

    it('accepts the same touch when the offering business line is present', () => {
        expect(() =>
            assertVenueCreateSectionsPresent({
                body: { minAge: 18 },
                businessLines: offeringLines
            })
        ).not.toThrow();
    });

    it('does not treat all-null section fields as a touch', () => {
        const body = Object.fromEntries(NIGHT_INFO_FIELDS.map((field) => [field, null]));
        expect(() => assertVenueCreateSectionsPresent({ body, businessLines: [] })).not.toThrow();
    });
});
