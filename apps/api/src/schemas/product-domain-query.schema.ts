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

import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { z } from 'zod';

/**
 * The domains a user's subscription-resolving route may be scoped to.
 *
 * Built from {@link ProductDomainEnum} members rather than restated string
 * literals, so the vocabulary lives in exactly one place. `PARTNER` is left out
 * on purpose: these routes answer for the authenticated user's own listing
 * subscriptions, and a partner directory subscription is not one of them.
 * Admitting it would turn today's 400 into a 200 carrying a different row.
 *
 * `GASTRONOMY` / `EXPERIENCE` scope to one commerce vertical each. The
 * transitional `COMMERCE` umbrella is retired (HOS-695) — there is no longer
 * a way to scope a read to "any commerce vertical" here. See
 * `subscriptionMatchesDomain`.
 */
const SUBSCRIPTION_SCOPE_DOMAINS = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
] as const;

/**
 * Query parameter selecting which product domain's subscription to resolve.
 *
 * Resolve the match with `subscriptionMatchesDomain(sub, domain)` from
 * `@repo/service-core` — it encodes the null/legacy-row handling each domain
 * requires (accommodation fails open, every other domain fails closed). Do not
 * re-derive that dispatch at the call site: a hardcoded `=== 'commerce'` branch
 * fails `scripts/check-product-domain-vocabulary.sh` in CI.
 */
export const ProductDomainQuerySchema = z.object({
    productDomain: z
        .enum(SUBSCRIPTION_SCOPE_DOMAINS)
        .optional()
        .default(ProductDomainEnum.ACCOMMODATION)
});

/** TypeScript type inferred from {@link ProductDomainQuerySchema} */
export type ProductDomainQuery = z.infer<typeof ProductDomainQuerySchema>;

/**
 * The product domains a subscription-resolving route can be scoped to.
 *
 * Derived from the string-literal form rather than from the schema's own
 * inference: `z.enum` over enum members infers the *enum* type, and every
 * caller in this repo passes a plain literal (`productDomain: 'commerce'`),
 * which TypeScript rejects against an enum. Kept in sync with
 * {@link SUBSCRIPTION_SCOPE_DOMAINS} by excluding exactly what that tuple omits.
 */
export type ProductDomainScope = Exclude<ProductDomainValue, 'partner'>;
