/**
 * Commerce per-vertical entitlement middleware (HOS-688 §6.8).
 *
 * ---
 * WHY A SECOND LOADER INSTEAD OF A FLAG ON `entitlementMiddleware`
 *
 * `entitlementMiddleware()` is mounted GLOBALLY (`utils/create-app.ts`) and
 * resolves the ACCOMMODATION domain: `loadEntitlements` filters subscriptions
 * through `isAccommodationSubscription`, so on a commerce route `userLimits`
 * carries the accommodation plan's keys — which never include
 * `max_gastronomies`. SPEC-239 built that isolation deliberately, and §6.8 says
 * to **parameterise the predicate by domain rather than remove it**: a commerce
 * route loads the commerce subscription's limits into the same context keys, an
 * accommodation route keeps loading accommodation's, and the two sets are never
 * merged. Running this middleware per-route AFTER the global one is exactly
 * that — it REPLACES both context keys for the remainder of the request rather
 * than adding to them, so the isolation is preserved by construction and the
 * domain becomes explicit at the call site.
 *
 * ## THE ONE INVARIANT THIS FILE EXISTS TO HOLD
 *
 * **`userLimits` always carries the vertical's key, on every code path, with no
 * exceptions.** Not "usually", not "when billing is up".
 *
 * The cap is the entire commercial substance of §6.8, and five independent
 * layers resolve "I don't know" as *unlimited* without raising anything:
 * `getRemainingLimit` returns `-1` for an absent key ("treat as unlimited");
 * several `entitlementMiddleware` paths set an EMPTY limits Map, which is
 * unlimited for every key at once; the enforcement middleware calls `next()` on
 * a count failure; and the precheck fails open by design. The symptom of a
 * mis-wired cap is therefore not an error — it is silently giving the product
 * away, and you find out by counting rows months later.
 *
 * So every branch below ends at a NUMBER. When billing is unreachable, when the
 * customer has no subscription, when the plan is missing the key — the answer is
 * the vertical's base cap read from the database, never an absent key and never
 * `-1`. The only thing an outage can cost an owner here is the extra listing
 * they bought as an add-on, and even that is preferable to handing out an
 * uncapped catalogue.
 *
 * ## The entitlement half, added by HOS-1074
 *
 * §6.8 used to say that **neither commerce vertical grants any entitlement**,
 * so the accommodation pattern — `requireEntitlement(PUBLISH_ACCOMMODATIONS)`
 * and *then* `enforceAccommodationLimit()` (SPEC-145 T-004) — had nothing to
 * put in its first half, and this middleware published an EMPTY entitlement
 * set. Owner decision (2026-09-01) reversed that: one mechanism across the
 * platform, not two. Each vertical now grants its own
 * `EDIT_<VERTICAL>_INFO` / `PUBLISH_<VERTICAL>` pair on all three tiers, and
 * the commerce routes gate on them exactly as `accommodation/protected/patch.ts`
 * gates on its own.
 *
 * ### The set has the same shape of invariant the cap does, pointing the OTHER way
 *
 * The cap fails toward a NUMBER because an absent limit key reads as
 * *unlimited* — silently giving the product away. An entitlement fails the
 * opposite way: an absent key is a REFUSAL, so the symptom of a mis-wired
 * entitlement set is not a give-away, it is every commerce owner locked out of
 * their own listing. Both directions are silent to the person who wired it and
 * loud to the customer, so both branches below end at a set that is known to be
 * right rather than at whatever a lookup happened to return.
 *
 * Concretely, the floor comes from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` —
 * from CODE, in the same binary as the gate — and the subscription's plan row
 * can only ADD to it. Three states would otherwise refuse a legitimate owner,
 * and all three are ordinary rather than exotic:
 *
 *   1. **No subscription at all.** This is the NORMAL state of a commerce owner
 *      mid-funnel: `commerce/protected/create.ts` makes the listing
 *      `PRIVATE`/`DRAFT` and the owner fills it in BEFORE paying. Gating on a
 *      live subscription would mean nobody could ever reach the checkout,
 *      which is the HOS-687 lockout shape exactly (a role you can only get by
 *      doing the thing the role gates).
 *   2. **A plan row that has not caught up.** `ensureCommercePlan` INSERTS
 *      ONLY, so every already-seeded environment carries `entitlements: []` on
 *      all six commerce plans until seed data-migration 0077 runs. A gate
 *      reading the DB alone would refuse every commerce owner on staging and
 *      production for the whole window between deploy and migration.
 *   3. **A lapsed or cancelled subscription.** Resolved to the floor for the
 *      same reason the CAP is: the vertical's catalogue terms, not nothing.
 *
 * None of that makes the gate decorative. It is a real refusal for a plan that
 * genuinely does not grant the key, it is the seam every later commerce
 * capability hangs off, and — most of all — it means the grant and the gate
 * ship as ONE artifact, so the ordering hazard HOS-1074 is written around
 * cannot occur: there is no window in which the gate exists and the grant does
 * not.
 *
 * @module middlewares/commerce-entitlement
 */

import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type CommerceVertical,
    commerceVerticalToProductDomain,
    ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL,
    // Imported as a VALUE, not `import type`: HOS-400 reads `EntitlementKey.AI_CHAT`
    // to detect a plan row that grants the chat without capping it. An enum
    // import serves as both the type and the value, so `Set<EntitlementKey>`
    // below is unaffected.
    EntitlementKey,
    getUnlimitedEntitlements,
    isEntitlementGrantingStatus,
    isEntitlementKey,
    isLimitKey,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type LimitKey
} from '@repo/billing';
import type { ProductDomainValue } from '@repo/schemas';
import { hydrateSubscriptionProductDomains, subscriptionMatchesDomain } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import {
    CommercePlanNotConfiguredError,
    resolveCommercePlanSlug
} from '../services/commerce-plan-resolver';
import { PlanService } from '../services/plan.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { isStaffBypassRole } from '../utils/staff-roles';
import { getQZPayBilling } from './billing';

/**
 * Last-resort cap used when the vertical's plan cannot be read from the
 * database at all (not seeded, DB down).
 *
 * One listing, matching every tier in the shipped catalogue. It exists so the
 * "I don't know" branch still produces a NUMBER — see the invariant in the
 * module docblock. It is NOT the source of truth for the cap: the database is,
 * and {@link loadVerticalBaseLimit} reads it on every cache miss.
 */
const FALLBACK_VERTICAL_CAP = 1;

/**
 * AI-chat quota for a commerce owner whose plan row does not supply one (HOS-400).
 *
 * ZERO, not the "unknown" of {@link FALLBACK_VERTICAL_CAP}. The listing cap and
 * the chat cap fail in opposite directions on purpose:
 *
 * - A listing cap that cannot be read must still let an owner keep the listing
 *   they already paid for, so it falls back to a permissive one.
 * - A chat quota that cannot be read must not authorise spend. There is no
 *   "already bought" chat to protect, and every layer beneath this one resolves
 *   an unresolved cap as UNLIMITED — so "I don't know" has to be answered here,
 *   with a number, or it becomes an uncapped bill.
 *
 * This is not the gate. `AI_CHAT` is absent from the code floor, so an owner
 * without a granting plan row is refused by the entitlement check before the
 * quota is read at all. The zero covers what the gate cannot see: a plan row
 * that grants the chat and forgets to cap it.
 */
const AI_CHAT_CAP_WITHOUT_PLAN = 0;

/** TTL of the per-vertical base-cap memo. Matches the entitlement cache TTL. */
const BASE_LIMIT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Shared PlanService — no mutable state, safe across requests. */
const planService = new PlanService();

/** Memoised base cap per vertical, with its population timestamp. */
const baseLimitCache = new Map<CommerceVertical, { value: number; cachedAt: number }>();

/**
 * The product domain of a commerce vertical.
 *
 * Thin wrapper around the shared, exhaustive
 * {@link commerceVerticalToProductDomain} (`@repo/billing`) — replaced a
 * local ternary comparing `vertical` against the gastronomy literal
 * (HOS-1079), which type-checked here only because `vertical` was already
 * narrowed to {@link CommerceVertical}, and carried no defense of its own if
 * that ever changed.
 *
 * @param vertical - The commerce vertical.
 * @returns Its `billing_subscriptions.product_domain` value.
 */
function domainOf(vertical: CommerceVertical): ProductDomainValue {
    return commerceVerticalToProductDomain(vertical);
}

/**
 * Reads the vertical's base listing cap off its plan in `billing_plans`.
 *
 * The plan slug comes from {@link resolveCommercePlanSlug} — the single place a
 * vertical is turned into a plan slug (AC-35). The VALUE comes from the
 * database rather than from `plans.config.ts`, because the cap is a
 * `'commercial'` field: an operator raising it through the admin UI must take
 * effect without a deploy.
 *
 * Memoised for {@link BASE_LIMIT_CACHE_TTL_MS} so this stays off the hot path,
 * mirroring `buildHostDraftDefaultsResult`'s owner-basico memo. A miss is NOT
 * memoised, so a plan seeded after boot is picked up without a restart.
 *
 * @param vertical - The commerce vertical whose cap is wanted.
 * @returns The cap, falling back to {@link FALLBACK_VERTICAL_CAP} when the plan
 *   cannot be read or does not declare the key.
 */
async function loadVerticalBaseLimit(vertical: CommerceVertical): Promise<number> {
    const now = Date.now();
    const cached = baseLimitCache.get(vertical);
    if (cached && now - cached.cachedAt < BASE_LIMIT_CACHE_TTL_MS) {
        return cached.value;
    }

    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    let planSlug: string;
    try {
        planSlug = resolveCommercePlanSlug({ entityType: vertical });
    } catch (error) {
        // Unreachable in a booted container: the configuration is validated at
        // startup (AC-35), so an unset/unknown mapping stops the container
        // rather than reaching a request. Kept as a floor, not as a code path.
        if (!(error instanceof CommercePlanNotConfiguredError)) {
            throw error;
        }
        apiLogger.error(
            { vertical },
            'commerce plan mapping unresolvable at request time — falling back to the base cap'
        );
        return FALLBACK_VERTICAL_CAP;
    }

    try {
        const result = await planService.getBySlug(planSlug);
        if (!result.success) {
            apiLogger.warn(
                { vertical, planSlug, errorCode: result.error.code },
                'commerce vertical plan not found in DB — falling back to the base cap'
            );
            return FALLBACK_VERTICAL_CAP;
        }

        const value = result.data.limits[limitKey];
        if (typeof value !== 'number') {
            apiLogger.warn(
                { vertical, planSlug, limitKey },
                'commerce vertical plan does not declare its own cap — falling back to the base cap'
            );
            return FALLBACK_VERTICAL_CAP;
        }

        baseLimitCache.set(vertical, { value, cachedAt: now });
        return value;
    } catch (error) {
        apiLogger.warn(
            { vertical, planSlug, error: error instanceof Error ? error.message : String(error) },
            'commerce vertical plan lookup threw — falling back to the base cap'
        );
        return FALLBACK_VERTICAL_CAP;
    }
}

/** Clears the memoised base caps. Exported for tests. */
export function _resetCommerceBaseLimitCache(): void {
    baseLimitCache.clear();
}

/**
 * Resolves the cap the caller is actually subject to for one vertical.
 *
 * Order of precedence, highest first:
 *   1. a customer-level limit override — this is how a purchased
 *      `extra-gastronomies-1` / `extra-experiences-1` add-on raises the cap
 *      (AC-15), and it is keyed by limit key so it can only ever move the
 *      vertical it names;
 *   2. the owner's live subscription for THIS vertical, read through the
 *      canonical `subscriptionMatchesDomain` predicate;
 *   3. the vertical's base cap from the plan catalogue.
 *
 * Step 3 is what makes AC-31 true: an owner with **no accommodation
 * subscription** — the normal case for a commerce-only owner, and the case the
 * accommodation loader fails open on — is still capped, because "no
 * subscription" resolves to a number instead of to an absent key.
 *
 * Exported because the checkout route needs the SAME number the create route
 * was gated on: it decides whether a second listing joins the owner's existing
 * subscription or is refused. Two independent readings of "the cap" would let
 * the two disagree, and the disagreement would look like a working checkout.
 *
 * @param input.customerId - The caller's billing customer id, when they have one.
 * @param input.vertical - The commerce vertical being gated.
 * @returns The cap to publish into `userLimits`.
 */
export async function resolveCommerceVerticalCap(input: {
    customerId: string | null | undefined;
    vertical: CommerceVertical;
}): Promise<number> {
    return (await resolveCommerceVerticalGrants(input)).cap;
}

/**
 * Resolves BOTH halves of what a caller may do in one commerce vertical: the
 * listing cap they are subject to, and the entitlements they hold (HOS-1074).
 *
 * The two are resolved together because they read the SAME subscription and the
 * SAME plan row — splitting them would double every billing round-trip on the
 * request path, and would let the two disagree about which subscription was
 * live.
 *
 * The precedence rules differ by half, and deliberately so:
 *
 * - **cap** — customer-level override > subscription plan > vertical base cap
 *   read from the DATABASE. The cap is a `'commercial'` field: an operator
 *   raising it in the admin UI must take effect without a deploy.
 * - **entitlements** — the vertical's CONFIG floor, UNIONED with whatever the
 *   subscription's plan row declares. An entitlement set is a `'capability'`
 *   field: config wins and the database follows. Union, not replacement, is
 *   what makes the set monotonic — a lagging or empty plan row can never
 *   subtract from the catalogue's own terms. See the module docblock for the
 *   three ordinary states this protects.
 *
 * @param input.customerId - The caller's billing customer id, when they have one.
 * @param input.vertical - The commerce vertical being resolved.
 * @returns The cap to publish into `userLimits` and the entitlements to publish
 *   into `userEntitlements`.
 */
export async function resolveCommerceVerticalGrants(input: {
    customerId: string | null | undefined;
    vertical: CommerceVertical;
}): Promise<{ cap: number; aiChatCap: number; entitlements: Set<EntitlementKey> }> {
    const { customerId, vertical } = input;
    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];
    const aiChatLimitKey = AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];
    const baseCap = await loadVerticalBaseLimit(vertical);

    // The floor, from code. Never narrowed below this point — only added to.
    const entitlements = new Set<EntitlementKey>(ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL[vertical]);

    if (!customerId) {
        return { cap: baseCap, aiChatCap: AI_CHAT_CAP_WITHOUT_PLAN, entitlements };
    }

    const billing = getQZPayBilling();
    if (!billing) {
        return { cap: baseCap, aiChatCap: AI_CHAT_CAP_WITHOUT_PLAN, entitlements };
    }

    let cap = baseCap;
    let aiChatCap = AI_CHAT_CAP_WITHOUT_PLAN;

    try {
        const rawSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        // HOS-934: hydrate `productDomain` before matching — `getByCustomerId()`
        // never populates it (see hydrateSubscriptionProductDomains's doc), so
        // without this every subscription would fail open to accommodation
        // regardless of its real vertical.
        const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions ?? []);
        const activeSubscription = subscriptions.find(
            (sub: { status: string }) =>
                isEntitlementGrantingStatus(sub.status) &&
                subscriptionMatchesDomain(sub, domainOf(vertical))
        );

        if (activeSubscription) {
            const plan = await billing.plans.get(activeSubscription.planId);
            const planCap = plan?.limits?.[limitKey];
            if (typeof planCap === 'number') {
                cap = planCap;
            } else {
                apiLogger.warn(
                    {
                        vertical,
                        subscriptionId: activeSubscription.id,
                        planId: activeSubscription.planId
                    },
                    'commerce subscription plan does not declare the vertical cap — keeping the base cap'
                );
            }

            // HOS-400 — the vertical's AI-chat quota, off the SAME plan row.
            // Unlike the listing cap there is no DB "base" to fall back to, and
            // the fallback direction is the opposite one: a row that does not
            // declare the key leaves the quota at zero, never unlimited.
            //
            // That is consistent rather than merely cautious. `AI_CHAT` is NOT
            // in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, so it reaches an owner
            // ONLY from this same plan row — a lagging row therefore fails the
            // entitlement gate first and the quota is never consulted. The zero
            // is what covers the one incoherent state left: a row that grants
            // the chat but declares no cap, which would otherwise resolve to
            // unlimited through the layers beneath.
            const planAiChatCap = plan?.limits?.[aiChatLimitKey];
            if (typeof planAiChatCap === 'number') {
                aiChatCap = planAiChatCap;
            } else if (plan?.entitlements?.includes(EntitlementKey.AI_CHAT)) {
                apiLogger.warn(
                    {
                        vertical,
                        subscriptionId: activeSubscription.id,
                        planId: activeSubscription.planId,
                        aiChatLimitKey
                    },
                    'commerce plan grants AI_CHAT but declares no chat quota — refusing the chat rather than leaving it uncapped'
                );
            }

            // ADD ONLY (HOS-1074). A plan row is free to grant more than the
            // catalogue floor — that is how a future premium tier earns its
            // name — but an empty or lagging row must never take the floor
            // away. Unknown strings are dropped rather than cast: the column is
            // `string[]`, and a stale key from a retired grant is not an
            // entitlement just because it is spelled like one.
            for (const key of plan?.entitlements ?? []) {
                if (isEntitlementKey(key)) {
                    entitlements.add(key);
                }
            }
        }
    } catch (error) {
        apiLogger.warn(
            { vertical, customerId, error: error instanceof Error ? error.message : String(error) },
            'failed to resolve the commerce subscription — keeping the base cap'
        );
    }

    try {
        const customerLimits = await billing.limits.getByCustomerId(customerId);
        for (const cl of customerLimits) {
            if (isLimitKey(cl.limitKey) && cl.limitKey === limitKey) {
                cap = cl.maxValue;
            }
        }
    } catch (error) {
        // A customer-level read failure costs the owner the add-on they bought,
        // which is the safe direction to fail: it never grants more than the
        // plan does.
        apiLogger.warn(
            { vertical, customerId, error: error instanceof Error ? error.message : String(error) },
            'failed to read customer-level commerce limits — add-on increases not applied'
        );
    }

    return { cap, aiChatCap, entitlements };
}

/**
 * Loads the caller's entitlements and limits for ONE commerce vertical into the
 * request context.
 *
 * Mount it per-route, after the global `entitlementMiddleware()` and before
 * anything that reads either context key — `requireEntitlement(...)` for this
 * vertical's pair (HOS-1074) and/or the matching `enforceGastronomyLimit()` /
 * `enforceExperienceLimit()`. It replaces `userEntitlements` and `userLimits`
 * wholesale rather than merging into them — see the module docblock on why the
 * two domains are never mixed.
 *
 * **The order is load-bearing in both directions.** Mounted after the gate, the
 * gate reads the ACCOMMODATION set, which never carries a commerce key, and
 * refuses everyone. Omitted entirely, same outcome. There is no arrangement in
 * which a commerce gate works without this middleware ahead of it.
 *
 * @param vertical - The commerce vertical this route belongs to.
 * @returns A Hono middleware.
 *
 * @example
 * ```ts
 * options: {
 *   middlewares: [
 *     commerceVerticalEntitlementMiddleware('gastronomy'),
 *     requireEntitlement(EntitlementKey.PUBLISH_GASTRONOMY),
 *     enforceGastronomyLimit()
 *   ]
 * }
 * ```
 */
export function commerceVerticalEntitlementMiddleware(
    vertical: CommerceVertical
): MiddlewareHandler<AppBindings> {
    const limitKey: LimitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    return async (c, next) => {
        // Platform staff bypass (SPEC-171), identical in spirit to
        // `entitlementMiddleware`'s: staff operate without a billing customer
        // and must not be capped by one.
        const actor = c.get('actor');
        if (isStaffBypassRole(actor?.roles)) {
            const unlimited = getUnlimitedEntitlements();
            c.set('userEntitlements', new Set<EntitlementKey>(unlimited.entitlements));
            c.set(
                'userLimits',
                new Map<LimitKey, number>(unlimited.limits.map((l) => [l.key, l.value]))
            );
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        const { cap, entitlements } = await resolveCommerceVerticalGrants({
            customerId: c.get('billingCustomerId'),
            vertical
        });

        // REPLACE, never merge. The accommodation set arrives here from the
        // global `entitlementMiddleware`, and leaving any of it in place is
        // what would let an owner who happens to also host an accommodation
        // pass a commerce gate for the wrong reason — the exact confusion the
        // four separate keys exist to prevent (HOS-1074). This vertical's set
        // is the whole answer for the rest of the request.
        c.set('userEntitlements', entitlements);
        c.set('userLimits', new Map<LimitKey, number>([[limitKey, cap]]));
        c.set('billingLoadFailed', false);

        await next();
    };
}
