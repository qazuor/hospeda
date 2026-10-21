import { describe, expect, it } from 'vitest';
import { httpToDomainAccommodationCreateDraft } from '../accommodation.http.schema';
import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    buildPublishRequirementsReason,
    DRAFT_DESCRIPTION_PLACEHOLDER,
    isDraftDescriptionPlaceholder,
    parsePublishRequirementsReason,
    resolveMissingPublishRequirements
} from '../accommodation.publish-requirements';

const READY = {
    description: 'A genuine accommodation description with enough detail.',
    capacity: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
} as const;

const draft = (description: string | null | undefined) => ({
    name: 'A cabin',
    summary: 'A sufficiently long summary',
    type: 'CABIN' as const,
    destinationId: '00000000-0000-4000-8000-000000000001',
    ...(description === undefined ? {} : { description })
});

describe('draft description placeholder', () => {
    it.each([
        [DRAFT_DESCRIPTION_PLACEHOLDER, true],
        [`  ${DRAFT_DESCRIPTION_PLACEHOLDER}  `, true],
        [`A real text quoting: ${DRAFT_DESCRIPTION_PLACEHOLDER}`, false],
        ['', false],
        ['   ', false],
        [null, false],
        [undefined, false]
    ])('recognizes only the exact trimmed placeholder (%s)', (description, expected) => {
        expect(isDraftDescriptionPlaceholder({ description })).toBe(expected);
    });

    it('treats empty values and the placeholder as a missing description', () => {
        for (const description of [DRAFT_DESCRIPTION_PLACEHOLDER, '', '   ', null, undefined]) {
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
});
