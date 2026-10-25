import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema
} from '../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationListItemSchema } from '../../src/entities/accommodation/accommodation.query.schema.js';
import {
    ExperienceAdminListItemSchema,
    ExperienceAdminSchema,
    ExperienceProtectedSchema
} from '../../src/entities/experience/experience.access.schema.js';
import {
    GastronomyAdminListItemSchema,
    GastronomyAdminSchema,
    GastronomyProtectedSchema
} from '../../src/entities/venue/venue.access.schema.js';
import { ExperiencePriceUnitEnum } from '../../src/enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../src/enums/experience-type.enum.js';
import { createValidAccommodation } from '../fixtures/accommodation.fixtures.js';
import { createMinimalGastronomy } from '../fixtures/venue.fixtures.js';

/**
 * HOS-1748: a PURGED listing keeps its row with `summary = ''` and
 * `description = ''` (listing-purge.model.ts BLANK_CONTENT). The READ schemas
 * must accept it; the minimums live on the input and publish paths.
 */

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const validExperience = {
    id: UUID,
    name: 'Tour',
    slug: 'tour',
    summary: 'A valid experience summary',
    description: 'A valid experience description long enough for the write schema.',
    type: ExperienceTypeEnum.EXCURSION,
    priceFrom: 1000,
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    destinationId: UUID,
    ownerId: UUID,
    publicationStatus: 'DRAFT',
    averageRating: 0,
    reviewsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null
};

/** What BLANK_CONTENT writes besides the blank texts, per vertical. */
const COMMON_BLANKED = {
    summary: '',
    description: '',
    richDescription: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    richDescriptionI18n: null,
    contactInfo: null,
    socialNetworks: null,
    videos: null,
    seo: null,
    publicationStatus: 'PURGED'
};

const purgedAccommodation = {
    ...createValidAccommodation(),
    ...COMMON_BLANKED,
    translationMeta: null,
    price: null,
    location: null,
    extraInfo: null
};

const purgedGastronomy = {
    ...createMinimalGastronomy(),
    ...COMMON_BLANKED,
    menuUrl: null,
    menuFileUrl: null,
    menuFilePublicId: null,
    menuFileKind: null,
    openingHours: null,
    priceRange: null
};

const purgedExperience = {
    ...validExperience,
    ...COMMON_BLANKED,
    priceFrom: 0,
    priceUnit: null,
    isPriceOnRequest: true,
    meetingPoint: null,
    meetingPointLat: null,
    meetingPointLong: null,
    meetingPointDirections: [],
    durationMinutes: null,
    whatToBring: [],
    requirements: [],
    cancellationPolicy: null,
    acceptsPrivateGroups: false,
    openingHours: null
};

const draftOf = <T extends object>(source: T) => ({
    ...source,
    summary: 'corto',
    description: ''
});

interface ReadCase {
    readonly name: string;
    readonly schema: {
        readonly safeParse: (input: unknown) => {
            readonly success: boolean;
            readonly data?: unknown;
        };
    };
    readonly purged: object;
    readonly valid: object;
    readonly capped: boolean;
}

const accommodation = createValidAccommodation();
const gastronomy = createMinimalGastronomy();

const cases: readonly ReadCase[] = [
    ['AccommodationListItemSchema', AccommodationListItemSchema],
    ['AccommodationAdminSchema', AccommodationAdminSchema],
    ['AccommodationProtectedSchema', AccommodationProtectedSchema]
]
    .map(
        ([name, schema]) =>
            ({
                name,
                schema,
                purged: purgedAccommodation,
                valid: accommodation,
                capped: false
            }) as ReadCase
    )
    .concat(
        [
            ['GastronomyAdminSchema', GastronomyAdminSchema],
            ['GastronomyAdminListItemSchema', GastronomyAdminListItemSchema],
            ['GastronomyProtectedSchema', GastronomyProtectedSchema]
        ].map(
            ([name, schema]) =>
                ({
                    name,
                    schema,
                    purged: purgedGastronomy,
                    valid: gastronomy,
                    capped: true
                }) as ReadCase
        ),
        [
            ['ExperienceAdminSchema', ExperienceAdminSchema],
            ['ExperienceAdminListItemSchema', ExperienceAdminListItemSchema],
            ['ExperienceProtectedSchema', ExperienceProtectedSchema]
        ].map(
            ([name, schema]) =>
                ({
                    name,
                    schema,
                    purged: purgedExperience,
                    valid: validExperience,
                    capped: true
                }) as ReadCase
        )
    );

const cappedCases = cases.filter((c) => c.capped);

describe('TEST:1748:1 listing read schemas accept purged and incomplete content', () => {
    it.each(cases)('$name accepts a PURGED row and keeps its blank texts', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse(c.purged);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ summary: '', description: '' });
    });

    it.each(cases)('$name accepts a draft with a short summary and no description', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse(draftOf(c.valid));

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ summary: 'corto', description: '' });
    });

    it.each(
        cases.filter((c) => c.name.endsWith('AdminSchema') || c.name.endsWith('Protected'))
    )('$name keeps publicationStatus PURGED on the parsed row', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse(c.purged);

        // Assert
        expect(result.data).toMatchObject({ publicationStatus: 'PURGED' });
    });

    it.each(cappedCases)('$name still rejects a summary over 300 characters', (c) => {
        // Arrange / Act
        const result = c.schema.safeParse({ ...c.valid, summary: 'x'.repeat(301) });

        // Assert
        expect(result.success).toBe(false);
    });
});
