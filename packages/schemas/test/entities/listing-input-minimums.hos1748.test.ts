import { describe, expect, it } from 'vitest';
import { resolveListingCompleteness } from '../../src/common/listing-completeness.js';
import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema
} from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { resolveMissingPublishRequirements } from '../../src/entities/accommodation/accommodation.publish-requirements.js';
import {
    ExperienceAdminCreateInputSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../../src/entities/experience/experience.crud.schema.js';
import {
    VenueAdminCreateInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../src/entities/venue/venue.crud.schema.js';
import { createValidAccommodation } from '../fixtures/accommodation.fixtures.js';
import { createMinimalGastronomy } from '../fixtures/venue.fixtures.js';

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
const gastronomyBase: Payload = {
    ...createMinimalGastronomy(),
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
    ['GastronomyOwnerCreateInputSchema', VenueOwnerCreateInputSchema, gastronomyBase],
    ['GastronomyOwnerUpdateInputSchema', VenueOwnerUpdateInputSchema, gastronomyBase],
    ['GastronomyUpdateInputSchema', VenueUpdateInputSchema, gastronomyBase],
    ['GastronomyAdminCreateInputSchema', VenueAdminCreateInputSchema, gastronomyBase],
    ['ExperienceOwnerCreateInputSchema', ExperienceOwnerCreateInputSchema, experienceBase],
    ['ExperienceOwnerUpdateInputSchema', ExperienceOwnerUpdateInputSchema, experienceBase],
    ['ExperienceUpdateInputSchema', ExperienceUpdateInputSchema, experienceBase],
    ['ExperienceAdminCreateInputSchema', ExperienceAdminCreateInputSchema, experienceBase]
].map(([name, schema, base]) => ({ name, schema, base }) as InputCase);

const issuePaths = (result: ReturnType<InputCase['schema']['safeParse']>): string[] =>
    (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.'));

describe('TEST:1748:2 input and publish minimums are untouched', () => {
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
