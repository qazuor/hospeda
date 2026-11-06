import { z } from 'zod';
import { FeatureCategoryEnum } from './feature-category.enum.js';

/** Zod schema for {@link FeatureCategoryEnum} (HOS-2058). */
export const FeatureCategoryEnumSchema = z.nativeEnum(FeatureCategoryEnum, {
    error: () => ({ message: 'zodError.enums.featureCategory.invalid' })
});
/** Inferred type of {@link FeatureCategoryEnumSchema}. */
export type FeatureCategorySchema = z.infer<typeof FeatureCategoryEnumSchema>;
