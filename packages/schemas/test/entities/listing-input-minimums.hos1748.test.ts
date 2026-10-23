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
    GastronomyAdminCreateInputSchema,
    GastronomyOwnerCreateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../src/entities/gastronomy/gastronomy.crud.schema.js';

/**
 * HOS-1748 lock: relaxing the READ schemas must not relax the INPUT or the
 * PUBLISH paths. This file is green before and after the fix on purpose.
 *
 * The inputs are partial on purpose: every schema reports the issue at the
 * path of the field it validates, so a blank `summary` or `description` is
 * enough to observe the minimum without building a fully valid payload.
 */

interface InputCase {
    readonly name: string;
    readonly schema: {
        readonly safeParse: (input: unknown) => {
            readonly success: boolean;
            readonly error?: { readonly issues: ReadonlyArray<{ readonly path: PropertyKey[] }> };
        };
    };
    readonly summaryValue: string;
    readonly descriptionValue: string;
}

const VALID_SUMMARY = 'A summary that is long enough';
const VALID_DESCRIPTION =
    'A description that is comfortably longer than the strictest minimum here.';

const inputCases: readonly InputCase[] = [
    ['AccommodationCreateInputSchema', AccommodationCreateInputSchema],
    ['AccommodationUpdateInputSchema', AccommodationUpdateInputSchema],
    ['GastronomyOwnerCreateInputSchema', GastronomyOwnerCreateInputSchema],
    ['GastronomyOwnerUpdateInputSchema', GastronomyOwnerUpdateInputSchema],
    ['GastronomyUpdateInputSchema', GastronomyUpdateInputSchema],
    ['GastronomyAdminCreateInputSchema', GastronomyAdminCreateInputSchema],
    ['ExperienceOwnerCreateInputSchema', ExperienceOwnerCreateInputSchema],
    ['ExperienceOwnerUpdateInputSchema', ExperienceOwnerUpdateInputSchema],
    ['ExperienceUpdateInputSchema', ExperienceUpdateInputSchema],
    ['ExperienceAdminCreateInputSchema', ExperienceAdminCreateInputSchema]
].map(
    ([name, schema]) =>
        ({
            name,
            schema,
            summaryValue: VALID_SUMMARY,
            descriptionValue: VALID_DESCRIPTION
        }) as InputCase
);

const issuePaths = (result: ReturnType<InputCase['schema']['safeParse']>): string[] =>
    (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.'));

describe('TEST:1748:2 input and publish minimums are untouched', () => {
    it.each(inputCases)('$name rejects a blank summary', (c) => {
        // Arrange / Act
        const blank = issuePaths(c.schema.safeParse({ summary: '' }));
        const valid = issuePaths(c.schema.safeParse({ summary: c.summaryValue }));

        // Assert
        expect(blank).toContain('summary');
        expect(valid).not.toContain('summary');
    });

    it.each(inputCases)('$name rejects a blank description', (c) => {
        // Arrange / Act
        const blank = issuePaths(c.schema.safeParse({ description: '' }));
        const valid = issuePaths(c.schema.safeParse({ description: c.descriptionValue }));

        // Assert
        expect(blank).toContain('description');
        expect(valid).not.toContain('description');
    });

    it.each([
        'gastronomy',
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
