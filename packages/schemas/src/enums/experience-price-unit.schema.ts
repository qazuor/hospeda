import { z } from 'zod';
import { ExperiencePriceUnitEnum } from './experience-price-unit.enum.js';

/**
 * Zod schema for {@link ExperiencePriceUnitEnum} validation.
 * Accepts all four price-unit values: per_day, per_hour, per_person, per_group.
 */
export const ExperiencePriceUnitEnumSchema = z.nativeEnum(ExperiencePriceUnitEnum, {
    error: () => ({ message: 'zodError.enums.experiencePriceUnit.invalid' })
});

/** TypeScript type inferred from {@link ExperiencePriceUnitEnumSchema}. */
export type ExperiencePriceUnit = z.infer<typeof ExperiencePriceUnitEnumSchema>;
