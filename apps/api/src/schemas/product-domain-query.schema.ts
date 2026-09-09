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
 * `ADDON` is left out for the same reason: it tags a recurring add-on's own
 * MercadoPago preapproval (HOS-847), never a customer's real plan subscription
 * — there is nothing for a caller to legitimately scope a read to there.
 *
 * `GASTRONOMY` / `EXPERIENCE` scope to one commerce vertical each. The
 * transitional `COMMERCE` umbrella is retired (HOS-695) — there is no longer
 * a way to scope a read to "any commerce vertical" here. See
 * `subscriptionMatchesDomain`.
 *
 * `TOURIST` widened in (HOS-1282). Left out at HOS-1233 on purpose, to avoid
 * broadening a schema shared by two routes without understanding the second
 * consumer (`routes/billing/usage.ts`) — `?productDomain=tourist` answered 400
 * until this fix. It belongs here now for reasons already true of the rest of
 * the system, not new ones this change invents:
 * `BUSINESS_VERTICAL_PRODUCT_DOMAINS` (`packages/schemas/.../product-domain.enum.ts`)
 * already counts `TOURIST` as a full vertical (HOS-1233), the same tourist
 * fallback already runs unconditionally inside `routes/user/protected/subscription.ts`
 * (`matchInDomain(ProductDomainEnum.TOURIST)` when no domain is named), and
 * `subscriptionMatchesDomain` already resolves it correctly (fail-closed, like
 * every non-accommodation domain). This schema was the one place still
 * rejecting the query param a caller would need to reach either of those
 * paths explicitly instead of only through the unqualified-caller fallback.
 */
const SUBSCRIPTION_SCOPE_DOMAINS = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE,
    ProductDomainEnum.TOURIST
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
/**
 * The bare, undefaulted enum behind {@link ProductDomainQuerySchema}.
 *
 * Exists for a caller that needs "was a domain named at all" to survive as a
 * real question — `GET /billing/trial/status` (HOS-1282) is domain-BLIND by
 * default (it backs the global trial paywall's own domain-blind resolution;
 * see `TrialService.getTrialStatus`), so an omitted `?productDomain=` there
 * must stay `undefined`, never silently become `'accommodation'`. Validate an
 * EXPLICIT value against this schema directly rather than reading
 * `ProductDomainQuerySchema`'s `.default(...)`, which exists precisely to
 * remove that distinction for the two routes that want it removed.
 */
export const ProductDomainScopeEnumSchema = z.enum(SUBSCRIPTION_SCOPE_DOMAINS);

export const ProductDomainQuerySchema = z.object({
    productDomain: ProductDomainScopeEnumSchema.optional().default(ProductDomainEnum.ACCOMMODATION)
});

/** TypeScript type inferred from {@link ProductDomainQuerySchema} */
export type ProductDomainQuery = z.infer<typeof ProductDomainQuerySchema>;

/**
 * The product domains a subscription-resolving route can be scoped to.
 *
 * Derived from the string-literal form rather than from the schema's own
 * inference: `z.enum` over enum members infers the *enum* type, and every
 * caller in this repo passes a plain literal (`productDomain: 'accommodation'`),
 * which TypeScript rejects against an enum. Kept in sync with
 * {@link SUBSCRIPTION_SCOPE_DOMAINS} by excluding exactly what that tuple omits.
 *
 * CORRECTED (HOS-1282): this used to exclude only `'partner'`, which left it
 * wider than the runtime tuple — it already accepted `'tourist'` AND `'addon'`
 * at the type level while `SUBSCRIPTION_SCOPE_DOMAINS` (and therefore the Zod
 * schema above) rejected both with a 400. Widening the runtime tuple to admit
 * `'tourist'` closed half that gap; excluding `'addon'` here too closes the
 * other half, so the type and the value now describe the exact same set.
 */
export type ProductDomainScope = Exclude<ProductDomainValue, 'partner' | 'addon'>;
