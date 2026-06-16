import { z } from 'zod';
import { GastronomyTypeEnum } from './gastronomy-type.enum.js';

/**
 * Zod schema for {@link GastronomyTypeEnum} validation.
 * Accepts all nine gastronomy sub-type values.
 */
export const GastronomyTypeEnumSchema = z.nativeEnum(GastronomyTypeEnum, {
    error: () => ({ message: 'zodError.enums.gastronomyType.invalid' })
});
export type GastronomyType = z.infer<typeof GastronomyTypeEnumSchema>;
