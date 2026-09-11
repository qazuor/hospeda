/**
 * Which add-on grants an entitlement resolver is allowed to merge (HOS-1303).
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
 * `middlewares/commerce-entitlement.ts` replaces `userEntitlements` wholesale
 * from the vertical's own subscription and never merges customer-level
 * ENTITLEMENT rows, and `middlewares/owner-entitlement.ts` does not read the
 * entitlement table at all (its own docblock says so). So the commerce side
 * already ignores the accommodation add-on, while the accommodation side
 * swallows the commerce one.
 *
 * ---
 * THE SERVED DOMAINS ARE A PARAMETER, NOT A CONSTANT IN THIS FILE
 *
 * The first version of this module hard-coded the consumer-side pair and was
 * named for it, on a docblock claim that `loadDeferredAddonGrants` had one
 * caller. It has THREE, and two of them are on the OWNER-side resolver, which
 * selects `isAccommodationSubscription` alone. A hard-coded pair therefore
 * silently widened the owner side to accept a `tourist`-domain add-on — a domain
 * this same epic created — which is the cross-vertical contamination this module
 * exists to close, entering through a door a comment said did not exist.
 *
 * So every caller states its own scope and there is deliberately NO default: a
 * default is precisely how the owner side inherited the consumer's scope without
 * anybody choosing it, and a required argument makes a new resolver decide
 * instead of inherit.
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
 * add-on's vertical, reached through the existing `productDomainForAddonSlug`.
 * This is that read, not a second mechanism. Deriving it from `affectsLimitKey`
 * instead is forbidden by G-3 of that guard, and would answer `undefined` for
 * every visibility boost anyway (they raise no cap).
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
 * the purchase resolves, and the add-on declares a vertical the caller does not
 * serve. An admin's manual grant (`source = 'manual'`, customer-wide by
 * construction and by definition deliberate), a grant whose purchase row is
 * gone, and a slug outside the catalogue all keep today's behaviour exactly.
 *
 * A fail-open needs a way to watch it fire, so the monitoring is part of the
 * design rather than an afterthought. An earlier revision claimed "every such
 * case is logged" while logging none of them, and what logging there was sat at
 * `debug` — below the `info` that `LOG_LEVEL` defaults to, so it reached neither
 * staging nor production. Now {@link reportAddonGrantDomainOutcome} reports BOTH
 * what was dropped and what was admitted-without-placing, at `info`, and
 * {@link resolveAddonPurchaseSlugs}'s own failure goes to Sentry. Without that
 * last one the gate can become a permanent no-op — every purchase unresolved,
 * every grant admitted — and look exactly like a customer who bought nothing
 * foreign.
 *
 * @module services/billing/addon-grant-domain
 */

import { productDomainForAddonSlug } from '@repo/billing';
import { billingAddonPurchases, getDb, inArray } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../../utils/logger';

/**
 * The domains the CONSUMER-SIDE entitlement loader resolves
 * (`middlewares/entitlement.ts`, and `loadDeferredAddonGrants` when called from
 * it).
 *
 * That loader selects the customer's accommodation subscription and falls back
 * to their tourist one (HOS-1233, via `selectAccommodationSubscription`). Both
 * are "the plan this person pays for themselves"; the commerce and partner
 * verticals each have their own resolver and their own subscription.
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
 * The domains the OWNER-SIDE entitlement resolver resolves
 * (`middlewares/owner-entitlement.ts`, both of its `loadDeferredAddonGrants`
 * call sites).
 *
 * Accommodation alone, and narrower than {@link CONSUMER_SIDE_PRODUCT_DOMAINS}
 * on purpose. `loadCustomerEntitlements` and the owner limits fallback both
 * select `isEntitlementGrantingStatus(sub) && isAccommodationSubscription(sub)`
 * — no tourist fallback — because the surfaces they gate are an OWNER'S
 * LISTINGS, which a tourist plan grants nothing about.
 *
 * The consequence is intended: a deferred add-on of any other vertical,
 * `tourist` included, contributes neither an entitlement nor a limit increase on
 * owner-gated surfaces. No `AddonDefinition` declares `tourist` today, so that
 * half is a closed door rather than a change; the gastronomy/experience half IS
 * a behaviour change, and HOS-1303 declares it.
 */
export const OWNER_SIDE_PRODUCT_DOMAINS: readonly ProductDomainValue[] = [
    ProductDomainEnum.ACCOMMODATION
] as const;

/**
 * What a resolver may do with one customer-level grant.
 *
 * - `'served'`      — the add-on belongs to a domain the caller resolves. Merge it.
 * - `'foreign'`     — the add-on belongs to another vertical. Drop it.
 * - `'unplaceable'` — the grant has no add-on behind it, or the add-on could not
 *                     be placed. Merge it, and say so (see the module doc).
 */
export type AddonGrantDomainVerdict =
    | { readonly kind: 'served'; readonly domain: ProductDomainValue }
    | { readonly kind: 'foreign'; readonly domain: ProductDomainValue }
    | { readonly kind: 'unplaceable'; readonly reason: 'unknown-slug' };

/**
 * Classifies one add-on slug against the domains a caller serves.
 *
 * Uses `===` against the caller's `servedDomains` rather than
 * `subscriptionMatchesDomain`, for the reason HOS-1279 wrote down one table
 * over: that function is the comparator for a SUBSCRIPTION ROW, and it fails
 * OPEN for accommodation because `billing_subscriptions.product_domain`
 * post-dates most rows. An add-on has no such history — `productDomain` is a
 * required KEY on `AddonDefinition` (its VALUE is nullable only so
 * `mapRowToAddonDefinition` can build the same shape from a `billing_addons` row
 * an operator created off-catalogue), so every static entry declares one and a
 * missing answer means "not an add-on we know", not "an old accommodation
 * add-on".
 *
 * @param input.addonSlug - `billing_addon_purchases.addon_slug`.
 * @param input.servedDomains - The verticals the CALLING resolver answers for —
 *   {@link CONSUMER_SIDE_PRODUCT_DOMAINS} or {@link OWNER_SIDE_PRODUCT_DOMAINS}.
 *   Required on purpose; see the module doc.
 * @returns The verdict; only `'foreign'` may be dropped.
 *
 * @example
 * ```ts
 * classifyAddonGrantDomain({
 *     addonSlug: 'visibility-boost-7d',
 *     servedDomains: CONSUMER_SIDE_PRODUCT_DOMAINS
 * }); // { kind: 'served', domain: 'accommodation' }
 * classifyAddonGrantDomain({
 *     addonSlug: 'visibility-boost-gastronomy-7d',
 *     servedDomains: CONSUMER_SIDE_PRODUCT_DOMAINS
 * }); // { kind: 'foreign', domain: 'gastronomy' }
 * classifyAddonGrantDomain({
 *     addonSlug: 'operator-invented',
 *     servedDomains: OWNER_SIDE_PRODUCT_DOMAINS
 * }); // { kind: 'unplaceable', reason: 'unknown-slug' }
 * ```
 */
export function classifyAddonGrantDomain(input: {
    readonly addonSlug: string;
    readonly servedDomains: readonly ProductDomainValue[];
}): AddonGrantDomainVerdict {
    const domain = productDomainForAddonSlug(input.addonSlug);

    if (domain === undefined) {
        return { kind: 'unplaceable', reason: 'unknown-slug' };
    }

    if (input.servedDomains.includes(domain)) {
        return { kind: 'served', domain };
    }

    return { kind: 'foreign', domain };
}

/**
 * Whether a resolver serving `servedDomains` may merge a grant from this add-on.
 *
 * The boolean form of {@link classifyAddonGrantDomain} for callers that do their
 * own reporting.
 *
 * @param input.addonSlug - `billing_addon_purchases.addon_slug`.
 * @param input.servedDomains - The verticals the CALLING resolver answers for.
 * @returns `false` only for a PROVABLY foreign vertical.
 */
export function admitsAddonGrant(input: {
    readonly addonSlug: string;
    readonly servedDomains: readonly ProductDomainValue[];
}): boolean {
    return classifyAddonGrantDomain(input).kind !== 'foreign';
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
 * everything — today's behaviour. That degradation is invisible from the
 * caller's side (an empty map is indistinguishable from a customer holding no
 * add-on grants), which is why it goes to SENTRY and not only to a log line: an
 * empty map on every request makes the whole gate a permanent no-op that looks
 * exactly like a clean customer.
 *
 * @param input.purchaseIds - `source_id` values of the `source = 'addon'` rows.
 * @returns `purchaseId → addonSlug` for every purchase that resolved.
 *
 * @example
 * ```ts
 * const slugs = await resolveAddonPurchaseSlugs({ purchaseIds: ['a1', 'b2'] });
 * const verdict = classifyAddonGrantDomain({
 *     addonSlug: slugs.get('a1') ?? '',
 *     servedDomains: CONSUMER_SIDE_PRODUCT_DOMAINS
 * });
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
        // Mirrors the customer-override failure in `loadEntitlements`: a degraded
        // read that silently disables a gate has to be visible somewhere other
        // than a log nobody is tailing.
        Sentry.captureException(error, {
            tags: {
                subsystem: 'billing-entitlements',
                action: 'resolve-addon-grant-domain'
            },
            extra: { purchaseIds: ids }
        });
        return new Map<string, string>();
    }
}

/**
 * One grant a resolver did not place in a served vertical.
 *
 * Reported together at `info` so the fail-open has a trace in production, where
 * `LOG_LEVEL` is `info` and the per-grant `debug` lines this replaced were never
 * emitted at all.
 */
export interface AddonGrantDomainResidue {
    /** What the grant was for, when the caller knows it. */
    readonly entitlementKey?: string;
    /** `billing_addon_purchases.id` from the grant's `source_id`. */
    readonly purchaseId?: string;
    /** The add-on slug, when the purchase resolved. */
    readonly addonSlug?: string;
    /** The add-on's declared vertical, when it could be placed. */
    readonly addonDomain?: ProductDomainValue;
}

/** Which resolver a {@link reportAddonGrantDomainOutcome} line came from. */
export type AddonGrantDomainReporter =
    | 'consumer-entitlements'
    | 'owner-entitlements'
    | 'deferred-addon-grants';

/**
 * Emits one `info` line per request summarising what the domain gate did.
 *
 * Silent when there is nothing to say, which is the overwhelming majority of
 * requests — a customer with no add-on grants at all produces no line. It fires
 * for BOTH outcomes that are not a plain "served":
 *
 * - `dropped` — provably foreign, and the thing to look at first when an owner
 *   reports a capability disappearing after a deploy;
 * - `admittedUnplaceable` — the fail-open firing. A steady stream of these is
 *   the signature of the gate having become a no-op (a `source_id` that is not a
 *   purchase id, a slug written outside the catalogue).
 *
 * @param input.resolver - Which resolver is reporting, so the three can be told
 *   apart in one log stream.
 * @param input.customerId - QZPay customer the grants belong to.
 * @param input.servedDomains - The verticals that resolver answers for.
 * @param input.dropped - Grants refused as foreign.
 * @param input.admittedUnplaceable - Grants admitted without being placed.
 */
export function reportAddonGrantDomainOutcome(input: {
    readonly resolver: AddonGrantDomainReporter;
    readonly customerId: string;
    readonly servedDomains: readonly ProductDomainValue[];
    readonly dropped: readonly AddonGrantDomainResidue[];
    readonly admittedUnplaceable: readonly AddonGrantDomainResidue[];
}): void {
    if (input.dropped.length === 0 && input.admittedUnplaceable.length === 0) {
        return;
    }

    apiLogger.info(
        {
            resolver: input.resolver,
            customerId: input.customerId,
            servedDomains: input.servedDomains,
            dropped: input.dropped,
            admittedUnplaceable: input.admittedUnplaceable
        },
        'HOS-1303: add-on grant domain gate — `dropped` grants belong to another vertical; `admittedUnplaceable` ones could not be placed and were merged anyway'
    );
}
