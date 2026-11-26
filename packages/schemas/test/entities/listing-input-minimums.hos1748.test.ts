import { describe, expect, it } from 'vitest';
import { resolveListingCompleteness } from '../../src/common/listing-completeness.js';
import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema
} from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { resolveMissingPublishRequirements } from '../../src/entities/accommodation/accommodation.publish-requirements.js';
import {
    ExperienceAdminCreateInputCheckedSchema,
    ExperienceAdminCreateInputSchema,
    ExperienceDraftCreateInputSchema,
    ExperienceOwnerCreateInputCheckedSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../../src/entities/experience/experience.crud.schema.js';
import {
    VenueAdminCreateInputSchema,
    VenueDraftCreateInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../src/entities/venue/venue.crud.schema.js';
import { createValidAccommodation } from '../fixtures/accommodation.fixtures.js';
import { createMinimalVenue } from '../fixtures/venue.fixtures.js';

/**
 * HOS-1748 lock: relaxing the READ schemas must not relax the INPUT or the
 * PUBLISH paths. This file is green before and after the fix on purpose.
 *
 * Every case starts from a payload its schema ACCEPTS (asserted first), then
 * changes ONLY `summary` or ONLY `description`, so the sole issue left is the
 * minimum under test.
 */

const VALID_SUMMARY = 'A summary that is long enough';
const VALID_DESCRIPTION =
    'A description that is comfortably longer than the strictest minimum here.';
const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

type Payload = Record<string, unknown>;

interface InputCase {
    readonly name: string;
    readonly schema: {
        readonly safeParse: (input: unknown) => {
            readonly success: boolean;
            readonly error?: { readonly issues: ReadonlyArray<{ readonly path: PropertyKey[] }> };
        };
    };
    readonly base: Payload;
}

const accommodationBase: Payload = {
    ...createValidAccommodation(),
    summary: VALID_SUMMARY,
    description: VALID_DESCRIPTION
};
const venueBase: Payload = {
    ...createMinimalVenue(),
    summary: VALID_SUMMARY,
    description: VALID_DESCRIPTION
};
const experienceBase: Payload = {
    name: 'Tour',
    slug: 'tour',
    summary: VALID_SUMMARY,
    description: VALID_DESCRIPTION,
    type: 'EXCURSION',
    priceFrom: 1000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    destinationId: UUID,
    ownerId: UUID
};

const inputCases: readonly InputCase[] = [
    ['AccommodationCreateInputSchema', AccommodationCreateInputSchema, accommodationBase],
    ['AccommodationUpdateInputSchema', AccommodationUpdateInputSchema, accommodationBase],
    ['VenueOwnerCreateInputSchema', VenueOwnerCreateInputSchema, venueBase],
    ['VenueOwnerUpdateInputSchema', VenueOwnerUpdateInputSchema, venueBase],
    ['VenueUpdateInputSchema', VenueUpdateInputSchema, venueBase],
    ['VenueAdminCreateInputSchema', VenueAdminCreateInputSchema, venueBase],
    ['ExperienceOwnerCreateInputSchema', ExperienceOwnerCreateInputSchema, experienceBase],
    ['ExperienceOwnerUpdateInputSchema', ExperienceOwnerUpdateInputSchema, experienceBase],
    ['ExperienceUpdateInputSchema', ExperienceUpdateInputSchema, experienceBase],
    ['ExperienceAdminCreateInputSchema', ExperienceAdminCreateInputSchema, experienceBase]
].map(([name, schema, base]) => ({ name, schema, base }) as InputCase);

const issuePaths = (result: ReturnType<InputCase['schema']['safeParse']>): string[] =>
    (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.'));

describe('Listing translation metadata is server-managed (HOS-2658)', () => {
    it.each([
        ['Accommodation create', AccommodationCreateInputSchema, accommodationBase],
        ['Accommodation update', AccommodationUpdateInputSchema, { name: 'Casa del Sol' }],
        ['Venue create', VenueAdminCreateInputSchema, venueBase],
        ['Venue update', VenueUpdateInputSchema, { name: 'Parrilla del Puerto' }],
        ['Experience create', ExperienceAdminCreateInputSchema, experienceBase],
        ['Experience update', ExperienceUpdateInputSchema, { name: 'Tour' }]
    ] as const)('%s strips client-supplied translation metadata', (_name, schema, base) => {
        const expected = schema.parse(base);
        const body = {
            ...base,
            translationMeta: {
                name: { en: { autoTranslated: false, translatedAt: '2026-11-26T09:00:00.000Z' } }
            }
        };

        const parsed = schema.parse(body);

        expect(parsed).not.toHaveProperty('translationMeta');
        expect(parsed).toEqual(expected);
    });
});

describe('TEST:1748:2 supplied content and publish minimums remain strict', () => {
    const minimum = {
        name: 'Tour',
        summary: VALID_SUMMARY,
        type: 'EXCURSION',
        destinationId: UUID
    };

    it.each([
        ['venue', VenueOwnerCreateInputSchema, VenueDraftCreateInputSchema, 'BAR'],
        [
            'experience',
            ExperienceOwnerCreateInputCheckedSchema,
            ExperienceDraftCreateInputSchema,
            'EXCURSION'
        ]
    ] as const)('%s accepts four-field owner create and empty-description persistence', (_vertical, owner, draft, type) => {
        expect(owner.safeParse({ ...minimum, type }).success).toBe(true);
        expect(draft.safeParse({ ...minimum, type, ownerId: UUID, description: '' }).success).toBe(
            true
        );
        expect(
            draft.safeParse({ ...minimum, type, ownerId: UUID, description: 'x'.repeat(2001) })
                .success
        ).toBe(false);
        expect(draft.safeParse({ ...minimum, type, description: '' }).success).toBe(false);
        expect(
            draft.safeParse({
                ...minimum,
                type,
                destinationId: undefined,
                ownerId: UUID,
                description: ''
            }).success
        ).toBe(false);
    });

    it('defaults unfinished experience pricing to NULL/NULL/false at persistence', () => {
        const draft = ExperienceDraftCreateInputSchema.parse({
            ...minimum,
            ownerId: UUID,
            description: ''
        });
        expect(draft).toMatchObject({ priceFrom: null, priceUnit: null, isPriceOnRequest: false });
    });

    it.each([
        undefined,
        null,
        0,
        1000
    ])('requires a unit only when an owner draft supplies a price (%s)', (priceFrom) => {
        const input = { ...minimum, priceFrom };
        const result = ExperienceOwnerCreateInputCheckedSchema.safeParse(input);
        expect(result.success).toBe(priceFrom == null);
        if (!result.success) {
            expect(result.error.issues).toEqual([
                expect.objectContaining({
                    path: ['priceUnit'],
                    message: 'zodError.experience.priceUnit.requiredUnlessOnRequest'
                })
            ]);
        }
        expect(
            ExperienceOwnerCreateInputCheckedSchema.safeParse({ ...input, priceUnit: 'per_person' })
                .success
        ).toBe(true);
        expect(
            ExperienceOwnerCreateInputCheckedSchema.safeParse({ ...input, isPriceOnRequest: true })
                .success
        ).toBe(true);
        expect(
            ExperienceDraftCreateInputSchema.safeParse({ ...input, ownerId: UUID, description: '' })
                .success
        ).toBe(priceFrom == null);
    });

    it.each([
        [VenueAdminCreateInputSchema, venueBase],
        [ExperienceAdminCreateInputCheckedSchema, experienceBase]
    ] as const)('admin create still requires description', (schema, base) => {
        const result = schema.safeParse({ ...base, description: undefined });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('description');
    });

    it('admin experience create still requires pricing', () => {
        expect(
            ExperienceAdminCreateInputCheckedSchema.safeParse({
                ...experienceBase,
                priceFrom: null,
                priceUnit: null
            }).success
        ).toBe(false);
    });

    it.each(inputCases)('$name rejects a short supplied description', (c) => {
        expect(c.schema.safeParse({ ...c.base, description: 'Short' }).success).toBe(false);
    });
    it.each(inputCases)('$name accepts its base payload', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse(c.base);

        // Assert
        expect(issuePaths(result)).toEqual([]);
        expect(result.success).toBe(true);
    });

    it.each(inputCases)('$name rejects a blank summary and nothing else', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse({ ...c.base, summary: '' });

        // Assert
        expect(result.success).toBe(false);
        expect(issuePaths(result)).toEqual(['summary']);
    });

    it.each(inputCases)('$name rejects a blank description and nothing else', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse({ ...c.base, description: '' });

        // Assert
        expect(result.success).toBe(false);
        expect(issuePaths(result)).toEqual(['description']);
    });

    it.each([
        'venue',
        'experience'
    ] as const)('resolveListingCompleteness flags a blank summary and description for %s', (entityType) => {
        // Arrange / Act
        const { complete, missing } = resolveListingCompleteness({
            entityType,
            listing: { name: 'Name', summary: '', description: '' }
        });

        // Assert
        expect(complete).toBe(false);
        expect(missing).toEqual(expect.arrayContaining(['summary', 'description']));
    });

    it('resolveMissingPublishRequirements flags a blank accommodation description', () => {
        // Arrange / Act
        const missing = resolveMissingPublishRequirements({
            input: { description: '', hasMainImage: true }
        });

        // Assert
        expect(missing).toContain('description');
    });
});
