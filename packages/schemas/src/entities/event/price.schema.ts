import { z } from 'zod';
import { BasePriceSchema } from '../../common.schema';

/**
 * Zod schema for a event price info.
 */
export const EventPriceSchema = BasePriceSchema.extend({
    isFree: z.boolean({
        required_error: 'error:event.price.isFree.required',
        invalid_type_error: 'error:event.price.isFree.invalid_type'
    }),
    priceFrom: z.number().min(1, { message: 'error:event.price.priceFrom.min_value' }).optional(),
    priceTo: z.number().min(1, { message: 'error:event.price.priceTo.min_value' }).optional(),
    pricePerGroup: z
        .number()
        .min(1, { message: 'error:event.price.pricePerGroup.min_value' })
        .optional()
});

export type EventPriceInput = z.infer<typeof EventPriceSchema>;
