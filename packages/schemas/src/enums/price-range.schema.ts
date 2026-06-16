import { z } from 'zod';
import { PriceRangeEnum } from './price-range.enum.js';

/**
 * Zod schema for {@link PriceRangeEnum} validation.
 * Accepts only the four defined price-range tiers: BUDGET, MID, HIGH, PREMIUM.
 */
export const PriceRangeEnumSchema = z.nativeEnum(PriceRangeEnum, {
    error: () => ({ message: 'zodError.enums.priceRange.invalid' })
});
export type PriceRange = z.infer<typeof PriceRangeEnumSchema>;
