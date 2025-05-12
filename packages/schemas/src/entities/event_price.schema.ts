import type { EventPriceType } from '@repo/types';
import { z } from 'zod';

import { BasePriceSchema } from '../common.schema';

/**
 * Zod schema for event pricing configuration.
 */
export const EventPriceSchema: z.ZodType<EventPriceType> = BasePriceSchema.extend({
    isFree: z.boolean({
        required_error: 'error:event.price.isFreeRequired'
    }),
    priceFrom: z
        .number()
        .min(0, {
            message: 'error:event.price.priceFromMin'
        })
        .optional(),
    priceTo: z
        .number()
        .min(0, {
            message: 'error:event.price.priceToMin'
        })
        .optional(),
    pricePerGroup: z
        .number()
        .min(0, {
            message: 'error:event.price.pricePerGroupMin'
        })
        .optional()
});
