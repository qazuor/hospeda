import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * Event Price Schema - using Base Field Objects
 *
 * This schema represents the price details for an event.
 * Migrated from legacy PriceSchema.extend pattern to use direct z.object.
 */
export const EventPriceSchema = z.object({
    // Basic price fields
    price: z.number().positive({
        message: 'zodError.event.price.price.positive'
    }),
    currency: PriceCurrencyEnumSchema,

    // Event-specific price fields
    isFree: z.boolean({ message: 'zodError.event.price.isFree.required' }),
    priceFrom: z.number().positive().optional(),
    priceTo: z.number().positive().optional(),
    pricePerGroup: z.number().positive().optional(),

    // Additional pricing options
    earlyBirdPrice: z.number().positive().optional(),
    earlyBirdDeadline: z.date().optional(),
    groupDiscountThreshold: z.number().int().min(2).optional(),
    groupDiscountPercent: z.number().min(0).max(100).optional()
});

/**
 * Type export
 */
export type EventPrice = z.infer<typeof EventPriceSchema>;
