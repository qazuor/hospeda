/**
 * The tourist-VIP grant the three ficha-publishing verticals inherit (HOS-1323).
 *
 * ---
 * THE DECISION THIS FILE IMPLEMENTS
 *
 * Owner decision, 2026-09-10: **accommodation, gastronomy and experience
 * receive every entitlement and every limit of a tourist-VIP without
 * subscribing to one** — a gift, not a purchase. Partners are deliberately
 * OUTSIDE it: an aliado pays for brand presence, not for a product listing, so
 * {@link TOURIST_VIP_INHERITING_DOMAINS} names three domains and not four.
 *
 * The same decision fixed HOW: **by reference to the tourist-VIP plan, never by
 * copying its keys.** "If tomorrow we change a limit or add an entitlement to
 * the tourist-VIP plan, the change also applies to what we gift the other
 * verticals."
 *
 * ---
 * WHY THIS READS THE CATALOGUE AND NOT ONLY THE CONSTANT
 *
 * `plans.config.ts` already spreads `TOURIST_VIP_ENTITLEMENTS` /
 * `TOURIST_VIP_LIMITS` into every plan that carries the block — the six
 * owner/complex tiers (`:130`/`:146` for `owner-basico`, five siblings after
 * it), all six commerce tiers through one factory (`:765`/`:777`), and
 * `tourist-vip` itself (`:499`/`:500`) — so a key added to those constants
 * reaches every definition on its own. That covers a change made **in code**
 * and nothing else.
 *
 * A plan is also changed in the OTHER direction: `PUT /api/v1/admin/billing/
 * plans/{id}` (`routes/billing/admin/plans.ts:243`) accepts
 * `entitlements?: string[]` and `limits?: Record<string, number>` and writes
 * them straight onto the `billing_plans` row, with no deploy. A key added to
 * the tourist-VIP ROW that way reaches no vertical plan row at all — the
 * constant is not consulted at runtime, and nothing re-derives its neighbour
 * rows from it. Resolving the gift from the catalogue on every cache miss is
 * what makes BOTH directions propagate for the verticals served here.
 *
 * **Say the limit of that out loud**, because a docblock claiming more than the
 * code does is how this epic's bugs survive review: the runtime resolution
 * covers `gastronomy` and `experience` (see {@link RUNTIME_GIFTED_DOMAINS}).
 * `accommodation` inherits through its own plan row, so a key added to the
 * tourist-VIP ROW alone does NOT reach an owner plan — it reaches it when the
 * change is made in `plans.config.ts`, which is where a capability is supposed
 * to be changed ("config wins, the database follows"), and shipped to the rows
 * by the seed dual-write the repo already requires.
 *
 * The two halves resolve with the precedence this repo already documents for
 * them (`middlewares/commerce-entitlement.ts`'s `resolveCommerceVerticalGrants`
 * doc):
 *
 * - **entitlements are a `'capability'` field — config wins, the database
 *   follows.** The row is UNIONED onto the constant, so a row that lags behind a
 *   deploy, or that an operator emptied, can never subtract a capability the
 *   catalogue declares.
 * - **limits are a `'commercial'` field — the database wins.** So a numeric
 *   value on the row REPLACES the constant's. An operator raising a cap in the
 *   admin UI takes effect without a deploy.
 *
 * Both halves are filtered through an allowlist derived from the plan itself —
 * see {@link GIFTABLE_ENTITLEMENT_KEYS}. The row supplies VALUES for keys the
 * catalogue declares giftable; it does not get to name new ones.
 *
 * **The two halves are therefore not symmetric in what the row can achieve**,
 * and it is worth being blunt about it rather than leaving "UNIONED" to imply
 * more than it delivers: the allowlist is exactly the config floor, so on the
 * ENTITLEMENT side the row can only ever be refused or ignored — every key it is
 * allowed to contribute is already in the gift. Only the LIMIT side carries real
 * information from the database, because there the row supplies a VALUE for a
 * key that is already present. So "the database follows" is literal for
 * capabilities and load-bearing for caps.
 *
 * ---
 * THE MERGE IS A UNION OF DISJOINT AXES — owner decision, 2026-09-10
 *
 * The model, in the owner's words: **a user holds the keys of their vertical
 * UNION the keys of tourist**, where the tourist half is the VIP tier if they
 * have the gift and the free tier if they do not.
 *
 * The two halves do not compete, because **the two key sets are disjoint**
 * (measured on `origin/staging`, and now frozen by
 * `tourist-vip-axis-disjointness.test.ts`):
 *
 * | Axis | Limit keys |
 * | --- | --- |
 * | tourist | the seven of `TOURIST_VIP_LIMITS` |
 * | gastronomy / experience | `max_gastronomies` / `max_experiences`, the vertical's own AI-chat quota (which is NOT `max_ai_chat_consumer_per_month`), `max_active_private_galleries` |
 * | accommodation | `max_accommodations`, photos, promotions, its own AI quotas |
 *
 * Intersection: empty, in all three directions. A gastronomy plan declares no
 * tourist key of its own, and no shipped plan declares a tourist key at a value
 * other than the VIP tier's. Stronger than that, measured by grepping the
 * seven keys across `packages/billing/src`: **no other plan DECLARES them at
 * all**, not even at the same value. There are no values that could diverge
 * today — only future plans.
 *
 * **So the gift REPLACES on its own axis, and touches nothing else.** There is
 * no "more generous of the two" question to answer, because there are never two
 * values for the same thing coming from different products.
 *
 * ## The one real collision, and why the old merge was the wrong answer to it
 *
 * An earlier version of this file merged with a MAX, on the theory that the gift
 * is a floor. The collision that motivated it is real but it is **not** vertical
 * vs tourist — it is `tourist-free` vs `tourist-vip`: two tiers of the SAME
 * product, which of course share keys. `TOURIST_FREE_PLAN.limits`
 * (`plans.config.ts:455-459`) declares three of the seven, all tourist keys.
 *
 * On that axis the right operator is **replacement, not max**: the paid tier
 * supersedes the free one. `moreGenerousLimit` — the sentinel-aware comparison
 * this replaced, NOT a bare `Math.max`: `-1` meant unlimited and beat any finite
 * value — happens to agree today only because the VIP is the more generous of
 * the two on all three (unlimited vs 5, 200 vs 10, 200 vs 10). The day
 * a VIP key is lowered — for abuse, for cost — it would return the FREE value
 * and hand a gastronomy owner **more than a tourist who pays for VIP**. That
 * absurdity is pinned as a regression test.
 *
 * ## What this means for a key the caller does not declare
 *
 * It is set. `tourist-free` carries three of the seven, so the other four arrive
 * from the gift where the caller had nothing — and publishing a number there is
 * the point, not a side effect: an absent limit key resolves to UNLIMITED
 * through every layer under `getRemainingLimit`, which is the same argument
 * `plans.config.ts:769-776` makes for shipping `TOURIST_VIP_LIMITS` at all.
 *
 * ## The consequences that survive the redesign
 *
 * 1. **Removing an entitlement from the `tourist-vip` row does not reach the
 *    verticals** — the entitlement union starts from the config floor, so the
 *    row can only add, and (see above) it cannot even do that. Includes
 *    `VIP_SUPPORT`, which `plans.config.ts:604-606` calls out as the one
 *    inherited key with a real bill behind it.
 * 2. **The accommodation asymmetry is deliberate**: an admin edit to that row
 *    reaches gastronomy and experience, and NOT accommodation, which resolves
 *    the same block from its own plan row. See {@link RUNTIME_GIFTED_DOMAINS}.
 *
 * Both are pinned as EXPECTED in
 * `apps/api/test/middlewares/tourist-vip-vertical-inheritance.test.ts`, so
 * changing either lands as a red test somebody has to justify rather than as a
 * quiet improvement.
 *
 * @module services/billing/tourist-vip-inheritance
 */

import {
    type EntitlementKey,
    isEntitlementKey,
    isLimitKey,
    type LimitKey,
    TOURIST_VIP_PLAN
} from '@repo/billing';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { hydrateSubscriptionProductDomains, subscriptionMatchesDomain } from '@repo/service-core';
import { apiLogger } from '../../utils/logger';
import { PlanService } from '../plan.service';
import { CONSUMER_SIDE_PRODUCT_DOMAINS } from './addon-grant-domain';

/** Shared PlanService — no mutable state, safe across requests. */
const planService = new PlanService();

/**
 * TTL of the resolved-gift memo. Matches the entitlement cache TTL and
 * `buildHostDraftDefaultsResult`'s `owner-basico` memo, for the same reason: the
 * gift is resolved on a hot path and a plan row changes at human speed.
 */
const TOURIST_VIP_GIFT_TTL_MS = 5 * 60 * 1000;

/** Memoised promise of the resolved gift, plus the timestamp it was populated. */
let touristVipGiftCache: Promise<TouristVipGift> | null = null;
let touristVipGiftCachedAt = 0;

/**
 * The domains whose owners receive the tourist-VIP gift (owner decision,
 * 2026-09-10).
 *
 * The three verticals that publish a product listing, and **not**
 * `ProductDomainEnum.PARTNER`: an aliado buys brand presence, not a ficha, and
 * the owner ruled them out of the gift explicitly. `ADDON` is not a vertical at
 * all (it tags a recurring add-on's own preapproval — HOS-847), and the retired
 * `'commerce'` value matches neither `GASTRONOMY` nor `EXPERIENCE` on purpose
 * (HOS-695): a row still carrying it goes dark rather than silently matching a
 * vertical it was never resolved to.
 *
 * `TOURIST` is absent for a different reason than partner is: a tourist-VIP
 * subscriber gets these keys from their own plan, and a tourist-FREE subscriber
 * is precisely who must NOT get them for free.
 */
export const TOURIST_VIP_INHERITING_DOMAINS: readonly ProductDomainValue[] = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
] as const;

/**
 * The subset of {@link TOURIST_VIP_INHERITING_DOMAINS} that needs the gift
 * resolved at RUNTIME — **derived, never a second list**.
 *
 * An inheriting domain gets the VIP block one of two ways, and the difference is
 * not a policy choice, it is which subscription the consumer loader can already
 * see:
 *
 * - **`accommodation`** is in {@link CONSUMER_SIDE_PRODUCT_DOMAINS}, so
 *   `loadEntitlements` already selects that subscription, reads its plan row,
 *   and publishes every key on it — and `plans.config.ts:130`/`:146` put the VIP
 *   block on all six owner rows by spreading the same constants
 *   `TOURIST_VIP_PLAN` is built from. It arrives, by reference, through the
 *   ordinary path. Re-adding it here would be a second delivery of the same set
 *   to the same people, on the hot path, for nothing.
 * - **`gastronomy` / `experience`** are invisible to that selector on purpose —
 *   `selectAccommodationSubscription` matches commerce never (SPEC-239
 *   isolation, kept). Their plan rows carry the identical block and no consumer
 *   request ever reads it. That is the HOS-1323 bug, and this is where it is
 *   paid.
 *
 * Derived with a filter rather than written out so a FOURTH gifted vertical
 * added above is served automatically, and so the two lists can never disagree
 * about who inherits.
 */
const RUNTIME_GIFTED_DOMAINS: readonly ProductDomainValue[] = TOURIST_VIP_INHERITING_DOMAINS.filter(
    (domain) => !CONSUMER_SIDE_PRODUCT_DOMAINS.includes(domain)
);

/** The resolved gift: everything a tourist-VIP holds, ready to merge. */
export type TouristVipGift = {
    readonly entitlements: ReadonlySet<EntitlementKey>;
    readonly limits: ReadonlyMap<LimitKey, number>;
};

/** A grant pair a caller has already resolved, which the gift raises to VIP. */
export type MergeableGrants = {
    entitlements: Set<EntitlementKey>;
    limits: Map<LimitKey, number>;
};

/**
 * Does this subscription need the tourist-VIP gift resolved at runtime?
 *
 * Answers for {@link RUNTIME_GIFTED_DOMAINS}, not for every inheriting domain —
 * an accommodation subscription inherits the same block through its own plan
 * row, so it answers `false` here and is not thereby un-gifted. See that
 * constant's doc.
 *
 * Reads `subscriptionMatchesDomain`, the repo's ONE domain comparison, once per
 * gifted domain — there is no union helper and deliberately is not one
 * (HOS-1081 deleted `isCommerceSubscription()` for lack of a consumer).
 *
 * **It hydrates rather than trusting the caller to have done it**, on the same
 * terms as `selectAccommodationSubscription`: `getByCustomerId()` never
 * populates `productDomain` (HOS-934/HOS-1104), and `subscriptionMatchesDomain`
 * reads asymmetrically — a missing column fails OPEN to accommodation and fails
 * CLOSED for every other domain. Over un-hydrated rows every gifted vertical
 * would therefore answer `false`, no gift would be resolved, and nothing would
 * raise: the failure would look exactly like the bug this file fixes. Hydrating
 * here costs nothing when the caller already did it —
 * `hydrateSubscriptionProductDomains` short-circuits rows whose domain is
 * already defined — and `scripts/check-subscription-domain-hydration.sh`
 * (HOS-1176) is what makes the omission a CI failure rather than a silent one.
 *
 * A hydration failure degrades to the un-hydrated rows rather than throwing, so
 * a transient DB error costs the gift for one request instead of failing the
 * whole entitlement load.
 *
 * @param subscriptions - The customer's entitlement-granting subscriptions.
 * @returns The first row belonging to a vertical whose gift must be resolved at
 *   runtime, or `undefined` when the customer holds none.
 */
export async function selectGiftBearingSubscription<
    T extends { id: string; productDomain?: string | null }
>(subscriptions: readonly T[]): Promise<T | undefined> {
    if (subscriptions.length === 0) {
        return undefined;
    }

    let resolved: readonly T[] = subscriptions;
    try {
        resolved = await hydrateSubscriptionProductDomains(subscriptions);
    } catch (error) {
        apiLogger.warn(
            {
                subscriptionIds: subscriptions.map((sub) => sub.id),
                error: error instanceof Error ? error.message : String(error)
            },
            'product-domain hydration failed — the tourist-VIP gift is not resolved for this request'
        );
        return undefined;
    }

    return resolved.find((sub) =>
        RUNTIME_GIFTED_DOMAINS.some((domain) => subscriptionMatchesDomain(sub, domain))
    );
}

/**
 * Merges the gift into an already-resolved grant pair, IN PLACE.
 *
 * **The gift owns the tourist axis and REPLACES on it.** Entitlements union;
 * limits are set outright. There is no comparison with what the caller already
 * resolved, and that is the whole point of the redesign — see the module
 * docblock's "union of disjoint axes":
 *
 * - A key on the caller's OWN axis is never in `gift.limits` at all (the two
 *   sets are disjoint, frozen by `tourist-vip-axis-disjointness.test.ts`), so
 *   replacement cannot reach a vertical's own cap.
 * - A key on the TOURIST axis that the caller already holds is there because
 *   they resolved a tourist tier — `tourist-free` for a commerce-only owner, or
 *   the inherited block on an owner plan. Both are the same axis at a lower or
 *   equal tier, and the paid tier supersedes it.
 *
 * **The second bullet is true of the CATALOGUE and not of the row, and the
 * difference matters.** The caller's value is read from `billing_plans`, which
 * `PUT /admin/billing/plans/{id}` edits with no deploy — the same fact this file
 * states surgically for the GIFT's row and omitted here until HOS-1323's review.
 * So an operator who raises `max_ai_search_per_month` to 500 on the
 * `owner-premium` row, an edit this codebase advertises as legitimate, gives a
 * pure `owner-premium` host 500 and a host who ALSO runs a restaurant 200,
 * because the gift replaced it. No log, no error. It is the model working as
 * designed — the tourist axis is not `owner-premium`'s to set — but it is a
 * split outcome between two hosts on the same plan, and nobody should discover
 * it by reading a bug report.
 *
 * **`-1` gets no special treatment here, and that is a deliberate loss.** The
 * function this replaced was sentinel-aware on purpose (`-1` is unlimited, not
 * "less than 5"), so a caller holding an uncapped tourist key kept it. Under
 * replacement a gift value of `5` overwrites a caller's `-1`. No catalogue plan
 * can produce that — the guard above forbids a plan declaring a tourist key at a
 * non-tier value — so the only route is the row edit described above. Pinned, in
 * both directions, in `tourist-vip-vertical-inheritance.test.ts`.
 *
 * The `moreGenerousLimit` this replaced would, the day a VIP key is lowered,
 * return the FREE value on those three shared keys and hand a gastronomy owner
 * more than a tourist paying for VIP. Pinned as a regression test.
 *
 * @param input.grants - The caller's resolved entitlements and limits, mutated.
 * @param input.gift - The resolved tourist-VIP gift.
 * @returns The same `grants` object, for call-site convenience.
 */
export function mergeTouristVipGift(input: {
    grants: MergeableGrants;
    gift: TouristVipGift;
}): MergeableGrants {
    const { grants, gift } = input;

    for (const key of gift.entitlements) {
        grants.entitlements.add(key);
    }
    for (const [key, value] of gift.limits) {
        grants.limits.set(key, value);
    }

    return grants;
}

/** The gift as the CODE catalogue declares it — the baseline, never skipped. */
function giftFromConfig(): { entitlements: Set<EntitlementKey>; limits: Map<LimitKey, number> } {
    return {
        entitlements: new Set<EntitlementKey>(TOURIST_VIP_PLAN.entitlements),
        limits: new Map<LimitKey, number>(TOURIST_VIP_PLAN.limits.map((l) => [l.key, l.value]))
    };
}

/**
 * The keys the gift may ever carry — **derived from {@link TOURIST_VIP_PLAN},
 * not written out**, so adding a key to `TOURIST_VIP_ENTITLEMENTS` or
 * `TOURIST_VIP_LIMITS` widens the allowlist in the same edit that adds the key.
 * A second hand-maintained list is another thing that drifts, and this epic
 * exists because those drift.
 *
 * ## Why the row is filtered at all
 *
 * **This is what makes "the gift is the tourist axis" true at RUNTIME rather
 * than by convention.** The disjointness the model rests on is a property of the
 * CATALOGUE — the constants in `plans.config.ts`, frozen by
 * `tourist-vip-axis-disjointness.test.ts`. The `tourist-vip` ROW is not covered
 * by that test and never can be: it is editable through
 * `PUT /admin/billing/plans/{id}` with no deploy and no review. Without this
 * filter, one such edit puts a foreign key into the gift, and the merge — which
 * REPLACES on every key it carries — applies it to the vertical's own axis.
 *
 * Two measured consequences, both silent:
 *
 * - `max_gastronomies: 50` on that row — a copy-paste, or a tourist promo —
 *   reaches `resolveCommerceVerticalGrants`, whose merge runs BEFORE
 *   `resolveCommerceVerticalCap` reads `limits.get('max_gastronomies')`. Every
 *   `gastronomy-basico` owner, paying for ONE listing, would publish fifty.
 * - `publish_accommodations` on that row would land in the GLOBAL entitlement
 *   set of a gastronomy owner who has no accommodation subscription at all.
 *
 * Neither is hypothetical about the plumbing: it is exactly the union and
 * replace below, unfiltered. And the blast radius is what this file changed —
 * before it, editing the `tourist-vip` row moved tourist-VIP subscribers and
 * nobody else; after it, that row is read on behalf of three populations. A
 * gift that can hand out another vertical's cap is not a gift, it is a hole.
 *
 * **The 2026-09-10 redesign did not retire this, it promoted it.** Under the
 * earlier `moreGenerousLimit` merge the filter was a defensive extra; under replacement
 * it is the invariant's enforcement, because a foreign key that reaches the gift
 * no longer merely competes with the vertical's own cap — it overwrites it.
 *
 * ## What it costs, stated plainly
 *
 * It fails CLOSED, and that has a price worth naming rather than burying: a key
 * added to the tourist-VIP **ROW alone** is dropped, so the "add an entitlement"
 * half of the owner's rule propagates through `plans.config.ts` (where a
 * `'capability'` is supposed to change — config wins, the database follows) and
 * not through the admin UI. The "change a limit" half — the owner's own first
 * example, and the `'commercial'` field where the database IS authoritative —
 * propagates from the row unchanged, because the KEY is already allowlisted and
 * only its VALUE moves.
 *
 * Failing closed rather than denying a list of known-foreign keys is deliberate:
 * a denylist admits every key nobody has classified yet, which is how the next
 * vertical's cap would leak the day it is added.
 */
const GIFTABLE_ENTITLEMENT_KEYS: ReadonlySet<EntitlementKey> = new Set<EntitlementKey>(
    TOURIST_VIP_PLAN.entitlements
);
const GIFTABLE_LIMIT_KEYS: ReadonlySet<LimitKey> = new Set<LimitKey>(
    TOURIST_VIP_PLAN.limits.map((l) => l.key)
);

/**
 * Resolves the tourist-VIP gift: the constant, raised by the `tourist-vip` row.
 *
 * Never rejects and never returns an empty gift — a database that cannot be
 * read degrades to {@link giftFromConfig}, which is the same set the plan rows
 * were seeded from. A miss or a throw is NOT memoised, so a row fixed (or
 * seeded) after boot is picked up without a restart — the same guarantee
 * `buildHostDraftDefaultsResult` and `loadVerticalBaseLimits` give.
 *
 * @returns The entitlements and limits every gifted vertical inherits.
 */
export async function resolveTouristVipGift(): Promise<TouristVipGift> {
    const now = Date.now();

    if (touristVipGiftCache !== null && now - touristVipGiftCachedAt < TOURIST_VIP_GIFT_TTL_MS) {
        return touristVipGiftCache;
    }

    const fetchPromise = planService
        .getBySlug(TOURIST_VIP_PLAN.slug)
        .then((result): TouristVipGift => {
            const gift = giftFromConfig();

            if (!result.success) {
                // NOT_FOUND or INTERNAL_ERROR — do NOT memoise; next request retries.
                touristVipGiftCache = null;
                touristVipGiftCachedAt = 0;
                apiLogger.warn(
                    { slug: TOURIST_VIP_PLAN.slug, errorCode: result.error.code },
                    'tourist-vip plan not found in DB — gifting the config-declared VIP grant to the vertical owners'
                );
                return gift;
            }

            const refused: string[] = [];

            // Capability half: UNION, restricted to the allowlist.
            //
            // **Since the allowlist landed, this loop cannot ADD anything, and
            // saying otherwise would be the third false docblock in this file.**
            // `gift.entitlements` starts as `TOURIST_VIP_PLAN.entitlements` and
            // `GIFTABLE_ENTITLEMENT_KEYS` is that same set, so every key that
            // survives the filter is already present and `.add` is a no-op by
            // construction. What the loop still does is REFUSE — the branch
            // below feeds `refused`, and that branch is live, reachable from one
            // admin edit, and covered.
            //
            // It is kept as a union rather than collapsed into a refusal scan
            // because the two sets are derived from the same plan TODAY and
            // nothing enforces that they stay that way: if a future change gives
            // the gift a floor that is narrower than the allowlist, this is the
            // line that would carry the difference, and it would carry it in the
            // safe direction (config wins, the database follows).
            for (const key of result.data.entitlements) {
                if (!isEntitlementKey(key)) {
                    continue;
                }
                if (!GIFTABLE_ENTITLEMENT_KEYS.has(key)) {
                    refused.push(key);
                    continue;
                }
                gift.entitlements.add(key);
            }

            // Commercial half: the row REPLACES the catalogue's VALUE for a key
            // the catalogue already declares. An operator moving a VIP cap in
            // the admin UI takes effect without a deploy, **in either
            // direction** — since the merge became a replacement on the tourist
            // axis, a LOWERED value reaches the gifted verticals too, which is
            // the point: they hold the VIP tier, so lowering the tier lowers
            // what they hold. `moreGenerousLimit` used to swallow that and is gone.
            for (const [key, value] of Object.entries(result.data.limits)) {
                if (!isLimitKey(key) || typeof value !== 'number') {
                    continue;
                }
                if (!GIFTABLE_LIMIT_KEYS.has(key)) {
                    refused.push(key);
                    continue;
                }
                gift.limits.set(key, value);
            }

            // One line, only when the gate actually refused something.
            //
            // **This does NOT distinguish a holding allowlist from a no-op one**,
            // and an earlier version of this comment claimed it did. It only
            // separates "there was something to refuse" from "there was not". In
            // the ordinary steady state — a seeded row equal to the constant —
            // there is nothing to refuse and the log is silent whether the gate
            // works or has been widened to everything.
            //
            // What catches a no-op is the suite, asymmetrically:
            // `GIFTABLE_LIMIT_KEYS` is pinned in both directions (a foreign cap
            // is refused; an allowlisted cap raised on the row still arrives),
            // while `GIFTABLE_ENTITLEMENT_KEYS` is pinned only against widening
            // — narrowing it is unobservable for the same reason the union above
            // cannot add: the config floor already carries every key it would
            // have let through.
            //
            // The line earns its place as OPERATIONAL evidence rather than as a
            // guard: it is how an operator learns that an edit they just made to
            // the `tourist-vip` row went nowhere.
            if (refused.length > 0) {
                apiLogger.warn(
                    { slug: TOURIST_VIP_PLAN.slug, refused },
                    'the tourist-vip row declares keys the catalogue does not gift — refused rather than inherited'
                );
            }

            return gift;
        });

    // Guard against promise REJECTION (the DB threw, as opposed to a resolved
    // failure Result): without this the rejected promise stays memoised for the
    // full TTL and every gifted owner loses the gift for up to 5 minutes after a
    // single transient error.
    const guardedPromise = fetchPromise.catch((error: unknown): TouristVipGift => {
        touristVipGiftCache = null;
        touristVipGiftCachedAt = 0;
        apiLogger.warn(
            {
                slug: TOURIST_VIP_PLAN.slug,
                error: error instanceof Error ? error.message : String(error)
            },
            'tourist-vip plan lookup threw — gifting the config-declared VIP grant to the vertical owners'
        );
        return giftFromConfig();
    });

    touristVipGiftCache = guardedPromise;
    touristVipGiftCachedAt = now;

    return guardedPromise;
}

/** Clears the memoised gift. Exported for tests. */
export function clearTouristVipGiftCache(): void {
    touristVipGiftCache = null;
    touristVipGiftCachedAt = 0;
}
