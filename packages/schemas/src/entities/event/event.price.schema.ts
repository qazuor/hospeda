import { z } from 'zod';
import { PriceSchema } from '../../common/index.js';

/**
 * Event Price schema definition using Zod for validation.
 * Represents the price details for an event.
 */
export const EventPriceSchema = PriceSchema.extend({
    isFree: z.boolean({ required_error: 'zodError.event.price.isFree.required' }),
    priceFrom: z.number().optional(),
    priceTo: z.number().optional(),
    pricePerGroup: z.number().optional()
});
