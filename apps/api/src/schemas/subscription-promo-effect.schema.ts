/**
 * Subscription Promo Effect Request Schemas
 *
 * Routing-specific Zod schemas for the subscription promo-effect admin API endpoint.
 * Response schemas are imported from @repo/schemas (canonical source of truth).
 *
 * @module schemas/subscription-promo-effect
 */

import { z } from 'zod';

/**
 * Path parameter for the subscription promo-effect route.
 * Requires a valid UUID subscription ID.
 */
export const SubscriptionPromoEffectParamSchema = z.object({
    /** Subscription UUID */
    id: z.string().uuid()
});

/** TypeScript type inferred from {@link SubscriptionPromoEffectParamSchema} */
export type SubscriptionPromoEffectParam = z.infer<typeof SubscriptionPromoEffectParamSchema>;
