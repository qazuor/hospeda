import { describe, expect, it } from 'vitest';
import { AccommodationTypeEnum } from '../../../enums/accommodation-type.enum';
import { httpToDomainAccommodationCreateDraft } from '../accommodation.http.schema';
import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    buildPublishRequirementsReason,
    DRAFT_DESCRIPTION_PLACEHOLDER,
    isDraftDescriptionPlaceholder,
    LEGACY_DRAFT_DESCRIPTION_PLACEHOLDERS,
    parsePublishRequirementsReason,
    resolveMissingPublishRequirements
} from '../accommodation.publish-requirements';

// Written by hand on purpose: the legacy text is a data contract stored in rows
// that already exist, not a value this test can derive from the current code.
const LEGACY_PLACEHOLDER =
    'Borrador en progreso. Completá la descripción del alojamiento desde el panel de administración antes de publicarlo.';

// Also written by hand: the owner-facing copy is the AC, so asserting against
// the exported constant alone would let the constant change silently.
const OWNER_FACING_PLACEHOLDER =
    'Descripción pendiente. Contá en pocas líneas cómo es tu alojamiento y qué lo hace especial.';

const READY = {
    description: 'A genuine accommodation description with enough detail.',
    capacity: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
} as const;

const draft = (description: string | undefined) => ({
    name: 'A cabin',
    summary: 'A sufficiently long summary',
    type: AccommodationTypeEnum.CABIN,
    destinationId: '00000000-0000-4000-8000-000000000001',
    ...(description === undefined ? {} : { description })
});

describe('draft description placeholder', () => {
    it.each([
        [DRAFT_DESCRIPTION_PLACEHOLDER, true],
        [`  ${DRAFT_DESCRIPTION_PLACEHOLDER}  `, true],
        [`A real text quoting: ${DRAFT_DESCRIPTION_PLACEHOLDER}`, false],
        [LEGACY_PLACEHOLDER, true],
        [`  ${LEGACY_PLACEHOLDER}  `, true],
        [`A real text quoting: ${LEGACY_PLACEHOLDER}`, false],
        ['', false],
        ['   ', false],
        [null, false],
        [undefined, false]
    ])('recognizes only the exact trimmed placeholder (%s)', (description, expected) => {
        expect(isDraftDescriptionPlaceholder({ description })).toBe(expected);
    });

    it('treats empty values and every seeded placeholder as a missing description', () => {
        const missingDescriptions = [
            DRAFT_DESCRIPTION_PLACEHOLDER,
            LEGACY_PLACEHOLDER,
            '',
            '   ',
            null,
            undefined
        ];
        for (const description of missingDescriptions) {
            expect(
                resolveMissingPublishRequirements({ input: { ...READY, description } })
            ).toContain('description');
        }
        expect(resolveMissingPublishRequirements({ input: READY })).toEqual([]);
    });

    it('puts description first and round-trips it in the reason', () => {
        expect(ACCOMMODATION_PUBLISH_REQUIREMENTS[0]?.id).toBe('description');
        const reason = buildPublishRequirementsReason({ missing: ['description', 'mainImage'] });
        expect(parsePublishRequirementsReason({ reason })).toEqual(['description', 'mainImage']);
    });

    it('uses the exported placeholder in the real draft mapper', () => {
        expect(httpToDomainAccommodationCreateDraft(draft(undefined), 'owner').description).toBe(
            DRAFT_DESCRIPTION_PLACEHOLDER
        );
        expect(
            httpToDomainAccommodationCreateDraft(draft(READY.description), 'owner').description
        ).toBe(READY.description);
    });

    it('exposes an owner-facing placeholder within the description bounds (TEST:1767:24)', () => {
        expect(DRAFT_DESCRIPTION_PLACEHOLDER).toBe(OWNER_FACING_PLACEHOLDER);
        expect(DRAFT_DESCRIPTION_PLACEHOLDER.length).toBeGreaterThanOrEqual(30);
        expect(DRAFT_DESCRIPTION_PLACEHOLDER.length).toBeLessThanOrEqual(2000);
        expect(DRAFT_DESCRIPTION_PLACEHOLDER).not.toMatch(/administraci/i);
    });

    it('keeps every previously seeded placeholder as a legacy value (TEST:1767:25)', () => {
        expect(LEGACY_DRAFT_DESCRIPTION_PLACEHOLDERS).toContain(LEGACY_PLACEHOLDER);
    });

    it('seeds the owner-facing placeholder in the real draft mapper (TEST:1767:28)', () => {
        expect(httpToDomainAccommodationCreateDraft(draft(undefined), 'owner').description).toBe(
            OWNER_FACING_PLACEHOLDER
        );
        expect(
            httpToDomainAccommodationCreateDraft(draft(READY.description), 'owner').description
        ).toBe(READY.description);
    });
});
