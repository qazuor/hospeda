/**
 * Which add-on grants the CONSUMER-SIDE entitlement loader is allowed to merge
 * (HOS-1303).
 *
 * ---
 * WHY THIS EXISTS
 *
 * `billing_customer_entitlements` is keyed `(customer_id, entitlement_key)` and
 * carries no vertical. By construction a row written there is visible to every
 * vertical of the same customer, and `middlewares/entitlement.ts` is the one
 * resolver that reads it: it picks the customer's ACCOMMODATION-or-TOURIST
 * subscription, resolves that plan's grants, and then unions **every**
 * customer-level row on top without asking which vertical bought it.
 *
 * Measured shape of the bug: `EntitlementKey.FEATURED_LISTING` is granted by SIX
 * add-ons spanning THREE domains — `visibility-boost-7d`/`-30d`
 * (accommodation), `visibility-boost-gastronomy-7d`/`-30d` (gastronomy) and
 * `visibility-boost-experience-7d`/`-30d` (experience), all of them
 * `isActive: true` since HOS-1286. So a host who buys a boost for their
 * RESTAURANT gets `featured_listing` in the customer table, and the
 * accommodation-side resolver hands it to them on the accommodation surfaces
 * and on `GET /api/v1/protected/user/entitlements`, which is the payload the web
 * gates on. They never bought accommodation featuring.
 *
 * It only runs one way today, and that asymmetry is the tell:
 * `middlewares/commerce-entitlement.ts` REPLACES `userEntitlements` wholesale
 * from the vertical's own subscription and never merges customer-level rows at
 * all, and `middlewares/owner-entitlement.ts` does not read the table either
 * (its own docblock says so). So the commerce side already ignores the
 * accommodation add-on, while the accommodation side swallows the commerce one.
 *
 * ---
 * WHY THE DOMAIN IS DERIVED FROM THE ADD-ON AND NOT FROM THE KEY
 *
 * `packages/service-core/.../addon-plan-change.helpers.ts` (HOS-1279) solves the
 * sibling problem on `billing_customer_limits` by deriving the domain from the
 * LIMIT KEY, because 17 of the 22 `LimitKey` members belong to exactly one
 * domain — the key itself is the discriminator. That mechanism does not
 * transfer: `FEATURED_LISTING` is the single most reached entitlement key here
 * and it is declared by add-ons in three domains at once, which is precisely the
 * `TOURIST_VIP_LIMITS` shape HOS-1279 refused to give a domain column to. A
 * `Record<EntitlementKey, ProductDomainValue>` would have no correct value to
 * write for it, and inventing one for the other ~49 keys would be ~49 product
 * decisions whose failure mode is stripping an entitlement somebody paid for.
 *
 * The row does not need a classification, because it already carries its
 * provenance: `source = 'addon'` and `sourceId = billing_addon_purchases.id`.
 * The purchase names the add-on slug, and the add-on DECLARES its
 * `productDomain` — the same catalogue field
 * `scripts/check-addon-product-domain.sh` installs as the single decider for an
 * add-on's vertical, reached through the existing
 * {@link productDomainForAddonSlug}. This is that read, not a second mechanism.
 * Deriving it from `affectsLimitKey` instead is forbidden by G-3 of that guard,
 * and would answer `undefined` for every visibility boost anyway (they raise no
 * cap).
 *
 * ---
 * WHY AN UNPLACEABLE GRANT IS ADMITTED, WHERE HOS-1279 REFUSES
 *
 * HOS-1279 fails CLOSED on anything it cannot place. It can afford to: refusing
 * there means "do not recalculate this cap", i.e. leave the customer exactly as
 * they were. Refusing HERE means taking an entitlement AWAY from a paying
 * customer, on the strength of a purchase row we failed to read.
 *
 * So the posture is inverted deliberately and the rule is narrow: a grant is
 * dropped only when it is PROVABLY foreign — the row says `source = 'addon'`,
 * the purchase resolves, and the add-on declares a vertical this loader does not
 * serve. An admin's manual grant (`source = 'manual'`, customer-wide by
 * construction and by definition deliberate), a grant whose purchase row is
 * gone, and a slug outside the catalogue all keep today's behaviour exactly.
 * Every such case is logged, so the residue is visible rather than assumed
 * absent.
 *
 * @module services/billing/consumer-addon-grant-domain
 */

import { productDomainForAddonSlug } from '@repo/billing';
import { billingAddonPurchases, getDb, inArray } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { apiLogger } from '../../utils/logger';

/**
 * The two product domains the consumer-side entitlement loader resolves.
 *
 * `middlewares/entitlement.ts` selects the customer's accommodation subscription
 * and falls back to their tourist one (HOS-1233, via
 * `selectAccommodationSubscription`). Both are "the plan this person pays for
 * themselves"; the three commerce/partner verticals each have their own resolver
 * and their own subscription.
 *
 * `ProductDomainEnum.ADDON` is deliberately NOT here — it tags a recurring
 * add-on's own MercadoPago preapproval (HOS-847), never an add-on's product
 * vertical, so no `AddonDefinition.productDomain` carries it.
 */
export const CONSUMER_SIDE_PRODUCT_DOMAINS: readonly ProductDomainValue[] = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.TOURIST
] as const;

/**
 * What the consumer-side loader may do with one customer-level grant.
 *
 * - `'served'`      — the add-on belongs to a domain this loader resolves. Merge it.
 * - `'foreign'`     — the add-on belongs to another vertical. Drop it.
 * - `'unplaceable'` — the grant has no add-on behind it, or the add-on could not
 *                     be placed. Merge it, and say so (see the module doc).
 */
export type ConsumerAddonGrantVerdict =
    | { readonly kind: 'served'; readonly domain: ProductDomainValue }
    | { readonly kind: 'foreign'; readonly domain: ProductDomainValue }
    | { readonly kind: 'unplaceable'; readonly reason: 'unknown-slug' };

/**
 * Classifies one add-on slug against the domains this loader serves.
 *
 * Uses `===` against {@link CONSUMER_SIDE_PRODUCT_DOMAINS} rather than
 * `subscriptionMatchesDomain`, for the reason HOS-1279 wrote down one table
 * over: that function is the comparator for a SUBSCRIPTION ROW, and it fails
 * OPEN for accommodation because `billing_subscriptions.product_domain`
 * post-dates most rows. An add-on has no such history — `productDomain` is a
 * REQUIRED property of `AddonDefinition`, so every catalogue entry declares one
 * and a missing answer means "not an add-on we know", not "an old accommodation
 * add-on".
 *
 * @param input.addonSlug - `billing_addon_purchases.addon_slug`.
 * @returns The verdict; only `'foreign'` may be dropped.
 *
 * @example
 * ```ts
 * classifyConsumerAddonGrant({ addonSlug: 'visibility-boost-7d' });
 * // { kind: 'served', domain: 'accommodation' }
 * classifyConsumerAddonGrant({ addonSlug: 'visibility-boost-gastronomy-7d' });
 * // { kind: 'foreign', domain: 'gastronomy' }
 * classifyConsumerAddonGrant({ addonSlug: 'operator-invented' });
 * // { kind: 'unplaceable', reason: 'unknown-slug' }
 * ```
 */
export function classifyConsumerAddonGrant(input: {
    readonly addonSlug: string;
}): ConsumerAddonGrantVerdict {
    const domain = productDomainForAddonSlug(input.addonSlug);

    if (domain === undefined) {
        return { kind: 'unplaceable', reason: 'unknown-slug' };
    }

    if (CONSUMER_SIDE_PRODUCT_DOMAINS.includes(domain)) {
        return { kind: 'served', domain };
    }

    return { kind: 'foreign', domain };
}

/**
 * Whether the consumer-side loader may merge a grant from this add-on.
 *
 * The one-line form of {@link classifyConsumerAddonGrant} for callers that
 * already hold the slug and do their own logging.
 *
 * @param input.addonSlug - `billing_addon_purchases.addon_slug`.
 * @returns `false` only for a PROVABLY foreign vertical.
 */
export function admitsConsumerAddonGrant(input: { readonly addonSlug: string }): boolean {
    return classifyConsumerAddonGrant({ addonSlug: input.addonSlug }).kind !== 'foreign';
}

/**
 * Resolves the add-on slug behind each `billing_customer_entitlements.source_id`.
 *
 * ONE batched query for the whole request, not one per row: a customer holding a
 * boost per vertical would otherwise cost three round-trips inside a middleware
 * that runs on every entitlement-cache miss. Rows the query does not return
 * (a purchase hard-deleted out from under its grant) are simply absent from the
 * map, which the caller must read as "unplaceable", never as "foreign".
 *
 * Soft-deleted purchases are deliberately NOT filtered out. The question here is
 * "which vertical did this grant come from", which a `deleted_at` does not
 * change; excluding them would turn a soft-deleted purchase into an unplaceable
 * grant and quietly re-admit exactly the row this module exists to drop.
 *
 * Never throws: a failed lookup answers an empty map, and the caller then admits
 * everything — today's behaviour.
 *
 * @param input.purchaseIds - `source_id` values of the `source = 'addon'` rows.
 * @returns `purchaseId → addonSlug` for every purchase that resolved.
 *
 * @example
 * ```ts
 * const slugs = await resolveAddonPurchaseSlugs({ purchaseIds: ['a1', 'b2'] });
 * const verdict = classifyConsumerAddonGrant({ addonSlug: slugs.get('a1') ?? '' });
 * ```
 */
export async function resolveAddonPurchaseSlugs(input: {
    readonly purchaseIds: readonly string[];
}): Promise<Map<string, string>> {
    const ids = Array.from(new Set(input.purchaseIds));

    if (ids.length === 0) {
        return new Map<string, string>();
    }

    try {
        const rows = await getDb()
            .select({
                id: billingAddonPurchases.id,
                addonSlug: billingAddonPurchases.addonSlug
            })
            .from(billingAddonPurchases)
            .where(inArray(billingAddonPurchases.id, ids));

        return new Map(rows.map((row) => [row.id, row.addonSlug]));
    } catch (error) {
        apiLogger.warn(
            {
                purchaseIds: ids,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-1303: could not resolve add-on purchases behind customer entitlement grants — every grant will be merged, as it was before this gate'
        );
        return new Map<string, string>();
    }
}
