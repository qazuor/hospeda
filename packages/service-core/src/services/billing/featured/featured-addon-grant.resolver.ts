/**
 * Entity-generic reads of `featured_listing_addon_grants` (HOS-1286).
 *
 * SPEC-309 built this table for accommodations only, and its foreign key to
 * `accommodations.id` was what kept every read honest: an id that was not an
 * accommodation's could not be in the table at all. HOS-1286 made the link
 * polymorphic over the three verticals, which BUYS the capability the owner
 * asked for and SELLS that guarantee.
 *
 * ## This module is where the sold guarantee is bought back
 *
 * Every query below filters on `entity_type` AND `entity_id`, never on the id
 * alone. That is not defensive style — it is the dropped FK's invariant,
 * relocated. UUIDs are unique in practice but nothing in the schema forbids a
 * row claiming `'gastronomy'` over an accommodation's id, and a read that
 * matched on the id alone would feature a listing in a vertical nobody paid
 * for. Keeping all of those reads in ONE module is what makes "did every read
 * carry the filter?" a question with one answer instead of five.
 *
 * The accommodation-facing helpers in
 * `services/accommodation/featured-entitlement.resolver.ts` delegate here
 * rather than issuing their own queries, so the accommodation path and the two
 * commerce paths cannot drift apart.
 *
 * ## A grant is live when its PURCHASE is live
 *
 * There are no denormalized `status`/`expiresAt` columns on the grant row; each
 * query joins `billing_addon_purchases` for
 * `status = 'active' AND (expires_at IS NULL OR expires_at > now())`. That is the
 * SPEC-309 decision, unchanged: purchase lifecycle state has exactly one source
 * of truth.
 *
 * @module services/billing/featured/featured-addon-grant.resolver
 */

import {
    and,
    billingAddonPurchases,
    eq,
    featuredListingAddonGrants,
    getDb,
    gt,
    inArray,
    isNull,
    or
} from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';

/**
 * The three verticals a visibility boost can feature, in the spelling
 * `featured_listing_addon_grants.entity_type` stores.
 *
 * Deliberately the three `ProductDomainEnum` members rather than a new
 * vocabulary. `CommerceEntityTypeEnum` was the other candidate and does not fit:
 * it holds only `gastronomy` and `experience`, and accommodation is the vertical
 * with the most grants. Reusing the domain values also makes
 * {@link resolveFeaturableEntityType} an identity restricted to three members
 * instead of a mapping table that can drift — the same reasoning
 * `product-domain.enum.ts` gives for `entity_subscriptions.entity_type`
 * colliding with the domain strings on purpose.
 *
 * `PARTNER`, `TOURIST` and `ADDON` are absent because none of them owns a
 * listing that can be featured. That absence is load-bearing: see
 * {@link resolveFeaturableEntityType}.
 */
export const FEATURABLE_ENTITY_TYPES = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
] as const;

/** One of {@link FEATURABLE_ENTITY_TYPES}. */
export type FeaturableEntityType = (typeof FEATURABLE_ENTITY_TYPES)[number];

/**
 * Resolves which listing table a visibility-boost add-on targets, from the
 * add-on's own declared product domain.
 *
 * **Fails CLOSED, and that is the whole contract.** `AddonDefinition.productDomain`
 * is typed `ProductDomainValue | undefined` on purpose (HOS-1060/HOS-1078): an
 * add-on an operator created through the admin UI carries a slug the catalogue
 * does not know, and the honest answer for it is "no domain". Answering
 * `'accommodation'` for that case is the exact `??` default HOS-1078 removed one
 * layer down, and here it would write a grant pointing at the wrong table.
 * `undefined` in, `undefined` out; caller does not write a grant.
 *
 * `partner`, `tourist` and `addon` also answer `undefined` — they are domains
 * with no featurable listing, so a boost claiming one of them is a
 * misconfiguration to refuse, not a case to guess at.
 *
 * @param input.productDomain - The add-on's declared domain, possibly absent.
 * @returns The entity type to stamp on the grant, or `undefined` when the
 *   add-on names no vertical that owns featurable listings.
 */
export function resolveFeaturableEntityType(input: {
    readonly productDomain: ProductDomainValue | undefined;
}): FeaturableEntityType | undefined {
    const domain = input.productDomain;
    return FEATURABLE_ENTITY_TYPES.find((candidate) => candidate === domain);
}

/**
 * The `billing_addon_purchases` conditions that make a grant LIVE.
 *
 * Extracted so the four queries below cannot disagree about what "active"
 * means — the duplication SPEC-309 H-1 called out at eight call sites for the
 * plan check, avoided here before it starts.
 */
const livePurchaseConditions = () => [
    eq(billingAddonPurchases.status, 'active'),
    or(isNull(billingAddonPurchases.expiresAt), gt(billingAddonPurchases.expiresAt, new Date()))
];

/**
 * Input for {@link resolveEntityHasActiveFeaturedAddon}.
 */
export interface ResolveEntityHasActiveFeaturedAddonInput {
    /** Which vertical {@link entityId} belongs to. */
    readonly entityType: FeaturableEntityType;
    /** The listing's id, within that vertical's table. */
    readonly entityId: string;
}

/**
 * Whether ONE listing currently holds a live featured-listing add-on grant.
 *
 * @param input - The listing's vertical and id. Both are required: a grant for
 *   another vertical carrying the same id must NOT match, which is the
 *   guarantee the dropped foreign key used to give for free.
 * @returns `true` when a live grant exists for exactly that `(type, id)` pair.
 */
export async function resolveEntityHasActiveFeaturedAddon(
    input: ResolveEntityHasActiveFeaturedAddonInput
): Promise<boolean> {
    const db = getDb();

    const [grant] = await db
        .select({ id: featuredListingAddonGrants.id })
        .from(featuredListingAddonGrants)
        .innerJoin(
            billingAddonPurchases,
            eq(featuredListingAddonGrants.purchaseId, billingAddonPurchases.id)
        )
        .where(
            and(
                eq(featuredListingAddonGrants.entityType, input.entityType),
                eq(featuredListingAddonGrants.entityId, input.entityId),
                ...livePurchaseConditions()
            )
        )
        .limit(1);

    return Boolean(grant);
}

/**
 * Input for {@link getEntityIdsWithActiveFeaturedAddon}.
 */
export interface GetEntityIdsWithActiveFeaturedAddonInput {
    /** Which vertical the candidate ids belong to. */
    readonly entityType: FeaturableEntityType;
    /** The candidate listing ids to test. */
    readonly entityIds: readonly string[];
}

/**
 * Narrows a candidate set of listing ids down to those holding a live grant.
 *
 * Used by the revoke paths, which must not clear featuring on a listing an
 * add-on is still paying for (SPEC-309 H-1 consequence b).
 *
 * @param input - The vertical and the candidate ids.
 * @returns The subset that holds a live grant. Empty when `entityIds` is empty —
 *   returned WITHOUT querying, because `inArray(col, [])` is a SQL syntax error
 *   in Drizzle rather than an empty match.
 */
export async function getEntityIdsWithActiveFeaturedAddon(
    input: GetEntityIdsWithActiveFeaturedAddonInput
): Promise<string[]> {
    if (input.entityIds.length === 0) return [];

    const db = getDb();

    const rows = await db
        .select({ entityId: featuredListingAddonGrants.entityId })
        .from(featuredListingAddonGrants)
        .innerJoin(
            billingAddonPurchases,
            eq(featuredListingAddonGrants.purchaseId, billingAddonPurchases.id)
        )
        .where(
            and(
                eq(featuredListingAddonGrants.entityType, input.entityType),
                inArray(featuredListingAddonGrants.entityId, [...input.entityIds]),
                ...livePurchaseConditions()
            )
        );

    return rows.map((row) => row.entityId);
}

/**
 * Input for {@link getActiveFeaturedGrantEntityIds}.
 */
export interface GetActiveFeaturedGrantEntityIdsInput {
    /** The vertical to sweep. */
    readonly entityType: FeaturableEntityType;
}

/**
 * Every listing of ONE vertical that currently holds a live grant.
 *
 * This is the commerce reconcile cron's whole input. Accommodation cannot use
 * it — its featuring also comes from the owner's PLAN, so its cron has to walk
 * owners — but no commerce plan grants FEATURED_LISTING, so for gastronomy and
 * experience the live grants ARE the complete set of listings that should carry
 * `featuredByEntitlement = true`.
 *
 * @param input - The vertical to sweep.
 * @returns Listing ids holding a live grant, without duplicates.
 */
export async function getActiveFeaturedGrantEntityIds(
    input: GetActiveFeaturedGrantEntityIdsInput
): Promise<string[]> {
    const db = getDb();

    const rows = await db
        .selectDistinct({ entityId: featuredListingAddonGrants.entityId })
        .from(featuredListingAddonGrants)
        .innerJoin(
            billingAddonPurchases,
            eq(featuredListingAddonGrants.purchaseId, billingAddonPurchases.id)
        )
        .where(
            and(
                eq(featuredListingAddonGrants.entityType, input.entityType),
                ...livePurchaseConditions()
            )
        );

    return rows.map((row) => row.entityId);
}

/**
 * Input for {@link getFeaturedAddonGrantTarget}.
 */
export interface GetFeaturedAddonGrantTargetInput {
    /** `billing_addon_purchases.id` whose grant target is wanted. */
    readonly purchaseId: string;
}

/**
 * The listing one purchase's grant points at, vertical included.
 *
 * Read by the entitlement-grant and expiry paths, which know a purchase and
 * need to flip exactly one listing. They must NOT assume the vertical from
 * context: the purchase's own grant row is the only place that records which
 * table the id belongs to.
 *
 * Unfiltered by purchase status on purpose — the callers are the paths that
 * ACTIVATE or EXPIRE the purchase, and asking "is it live" here would make the
 * expiry path unable to find the listing it is expiring.
 *
 * @param input - The purchase id.
 * @returns The grant's `(entityType, entityId)`, or `undefined` when the
 *   purchase has no grant row (a non-targeted add-on, or the HOS-675 gap).
 */
export async function getFeaturedAddonGrantTarget(
    input: GetFeaturedAddonGrantTargetInput
): Promise<{ entityType: string; entityId: string } | undefined> {
    const db = getDb();

    const [grant] = await db
        .select({
            entityType: featuredListingAddonGrants.entityType,
            entityId: featuredListingAddonGrants.entityId
        })
        .from(featuredListingAddonGrants)
        .where(eq(featuredListingAddonGrants.purchaseId, input.purchaseId))
        .limit(1);

    return grant;
}
