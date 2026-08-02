/**
 * Product Domain Query Schema
 *
 * Routing-specific Zod schema for endpoints that must resolve ONE of a billing
 * customer's subscriptions when that customer may hold several.
 *
 * A dual-role owner (an accommodation host who is ALSO a commerce-listing
 * owner) can have two subscriptions under the same `billing_customers` row.
 * Any route that picks "the" subscription with a `.find()` over
 * `subscriptions.getByCustomerId()` must scope that search by product domain,
 * or it silently returns whichever row the storage layer happened to order
 * first (HOS-259).
 *
 * Defaults to `'accommodation'` so every pre-existing caller keeps its
 * previous behaviour unchanged.
 *
 * @module schemas/product-domain-query
 */

import { z } from 'zod';

/**
 * Query parameter selecting which product domain's subscription to resolve.
 *
 * Pair it with the `isAccommodationSubscription` / `isCommerceSubscription`
 * predicates from `@repo/service-core` — they encode the null/legacy-row
 * handling each domain requires (accommodation fails open, commerce fails
 * closed).
 */
export const ProductDomainQuerySchema = z.object({
    productDomain: z.enum(['accommodation', 'commerce']).optional().default('accommodation')
});

/** TypeScript type inferred from {@link ProductDomainQuerySchema} */
export type ProductDomainQuery = z.infer<typeof ProductDomainQuerySchema>;

/** The product domains a subscription-resolving route can be scoped to. */
export type ProductDomainScope = ProductDomainQuery['productDomain'];
