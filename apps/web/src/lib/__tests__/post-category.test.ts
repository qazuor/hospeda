/**
 * @file post-category.test.ts
 * @description Tests for post-category slug helpers.
 *
 * Verifies that every PostCategoryEnum value round-trips through its
 * canonical lowercase slug and back, that the lookup is case-insensitive,
 * and that unknown slugs return undefined.
 */

import { PostCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { POST_CATEGORY_SLUG_MAP, resolvePostCategorySlug } from '../post-category';

describe('POST_CATEGORY_SLUG_MAP', () => {
    it('contains an entry for every PostCategoryEnum value', () => {
        const enumValues = Object.values(PostCategoryEnum);
        for (const value of enumValues) {
            const slug = value.toLowerCase();
            expect(POST_CATEGORY_SLUG_MAP[slug]).toBe(value);
        }
    });

    it('has exactly as many entries as there are enum values (no extras)', () => {
        const enumValues = Object.values(PostCategoryEnum);
        expect(Object.keys(POST_CATEGORY_SLUG_MAP).length).toBe(enumValues.length);
    });
});

describe('resolvePostCategorySlug', () => {
    const enumValues = Object.values(PostCategoryEnum);

    it.each(enumValues)('resolves lowercase slug for %s', (value: PostCategoryEnum) => {
        const slug = value.toLowerCase();
        expect(resolvePostCategorySlug({ slug })).toBe(value);
    });

    it.each(enumValues)(
        'resolves UPPERCASE slug for %s (case-insensitive)',
        (value: PostCategoryEnum) => {
            // The enum value itself is already uppercase — pass it directly.
            expect(resolvePostCategorySlug({ slug: value })).toBe(value);
        }
    );

    it('returns undefined for an unknown slug', () => {
        expect(resolvePostCategorySlug({ slug: 'unknown' })).toBeUndefined();
        expect(resolvePostCategorySlug({ slug: 'UNKNOWN' })).toBeUndefined();
        expect(resolvePostCategorySlug({ slug: 'xyz' })).toBeUndefined();
    });

    it('returns undefined when slug is undefined', () => {
        expect(resolvePostCategorySlug({ slug: undefined })).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
        expect(resolvePostCategorySlug({ slug: '' })).toBeUndefined();
    });

    // Spot-check the 18 canonical enum values to ensure nothing is missing.
    it('covers all 18 PostCategoryEnum values', () => {
        const expected: PostCategoryEnum[] = [
            PostCategoryEnum.EVENTS,
            PostCategoryEnum.CULTURE,
            PostCategoryEnum.GASTRONOMY,
            PostCategoryEnum.NATURE,
            PostCategoryEnum.TOURISM,
            PostCategoryEnum.GENERAL,
            PostCategoryEnum.SPORT,
            PostCategoryEnum.CARNIVAL,
            PostCategoryEnum.NIGHTLIFE,
            PostCategoryEnum.HISTORY,
            PostCategoryEnum.TRADITIONS,
            PostCategoryEnum.WELLNESS,
            PostCategoryEnum.FAMILY,
            PostCategoryEnum.TIPS,
            PostCategoryEnum.ART,
            PostCategoryEnum.BEACH,
            PostCategoryEnum.RURAL,
            PostCategoryEnum.FESTIVALS
        ];
        for (const value of expected) {
            const slug = value.toLowerCase();
            expect(resolvePostCategorySlug({ slug })).toBe(value);
            expect(resolvePostCategorySlug({ slug: value })).toBe(value);
        }
    });
});
