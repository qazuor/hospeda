/**
 * HOS-2058 release N+1: `features.category` is NOT NULL, so the admin feature
 * create form must not be able to submit without a category.
 *
 * Two layers carry that: the field config marks the select as required (label
 * asterisk + native `required`), and the create page validates the submit with
 * `FeatureCreateInputSchema`, which rejects a missing or null category.
 */
import { FeatureCategoryEnum, FeatureCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createBasicInfoConsolidatedSection } from '../../src/features/features/config/sections/basic-info.consolidated';

describe('admin feature form category (HOS-2058 N+1)', () => {
    it('marks the category select as required in create mode', () => {
        // Arrange
        const section = createBasicInfoConsolidatedSection();

        // Act
        const field = section.fields.find(({ id }) => id === 'category');

        // Assert
        expect(field).toBeDefined();
        expect(field?.required).toBe(true);
        expect(field?.modes).toContain('create');
    });

    it('the create schema the form submits through rejects a missing or null category', () => {
        // Arrange
        const base = { applicableVerticals: ['accommodation'] };

        // Act + Assert
        expect(FeatureCreateInputSchema.safeParse(base).success).toBe(false);
        expect(FeatureCreateInputSchema.safeParse({ ...base, category: null }).success).toBe(false);
        expect(
            FeatureCreateInputSchema.safeParse({ ...base, category: FeatureCategoryEnum.VIEW })
                .success
        ).toBe(true);
    });
});
