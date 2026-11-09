import { z } from 'zod';

/** One saleable addon product with its current policy and the owner's free grant verticals. */
export const AddonOfferSchema = z.strictObject({
    productId: z.uuid(),
    addonVersionId: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
    price: z.int().positive(),
    currency: z.literal('ARS'),
    compatibleVerticals: z.array(z.string()),
    scopeType: z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL']),
    validity: z.enum(['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE']),
    validityDays: z.int().positive().nullable(),
    freeUnderGrantVerticals: z.array(z.string())
});

/** Protected owner's saleable addon offers. */
export const AddonOffersResponseSchema = z.strictObject({ items: z.array(AddonOfferSchema) });
/** Parsed response for the addon purchase screen. */
export type AddonOffersResponse = z.infer<typeof AddonOffersResponseSchema>;
