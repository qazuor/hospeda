import { z } from 'zod';
import { ExperienceTypeEnum } from './experience-type.enum.js';

/**
 * Zod schema for {@link ExperienceTypeEnum} validation.
 * Accepts all 14 experience sub-type values.
 */
export const ExperienceTypeEnumSchema = z.nativeEnum(ExperienceTypeEnum, {
    error: () => ({ message: 'zodError.enums.experienceType.invalid' })
});

/** TypeScript type inferred from {@link ExperienceTypeEnumSchema}. */
export type ExperienceType = z.infer<typeof ExperienceTypeEnumSchema>;
