/**
 * Per-entity checkout idempotency for the commerce, partner AND accommodation
 * Path C flows (HOS-1272 added accommodation — see below).
 *
 * Reads the two rows that describe an entity's in-flight checkout — the domain
 * bridge row (`entity_subscriptions` / `partner_subscriptions`) and
 * the `billing_pending_checkouts` correlation row it points at — hands them to
 * the pure {@link decideCheckoutReuse}, and, when reuse is allowed, rebuilds the
 * ORIGINAL MercadoPago share link instead of minting a second one.
 *
 * ## HOS-867: "in flight" now means FRESH, not merely unexpired
 *
 * The 3-hour correlation TTL used to double as the reuse window, so a buyer
 * whose card was rejected at MercadoPago's hosted checkout was handed the
 * same (dead) share link for up to three hours. A rejected hosted checkout
 * leaves no MercadoPago object to query and fires no webhook, so the reuse
 * decision now lapses after
 * {@link CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS} instead — long enough that a
 * double click still receives the SAME link, short enough that a buyer back
 * from a failed attempt receives a FRESH one. See
 * `checkout-reuse-decision.ts` for the full rationale.
 *
 * ## HOS-1272: accommodation has no bridge table, so the CUSTOMER is the bridge
 *
 * Commerce and partner have a dedicated bridge table because a listing/partner
 * is a distinct row from the customer that pays for it. Accommodation has no
 * such table — by policy (`start-paid.ts`'s `ALREADY_SUBSCRIBED` guard) a
 * customer has at most one LIVE accommodation subscription — so
 * {@link loadAccommodationBridge} reads `billing_subscriptions` directly,
 * filtered on `(customerId, status = pending_provider, productDomain)`
 * instead of a separate link row. This was the one entity-driven checkout with
 * NO per-entity idempotency at all: two clicks on "pay" minted two independent,
 * both-payable MercadoPago preapprovals for the same host — a real double
 * charge, not merely two rows.
 *
 * Rebuilding is exact, not approximate: `buildPreapprovalPlanShareLink` is a
 * pure function of `mpPreapprovalPlanId` + `externalReference` (the nonce), and
 * both are persisted verbatim on the correlation row. The URL that comes back
 * out is byte-for-byte the one the buyer was given on the first click.
 *
 * Lives in the SERVICE layer on purpose. The owner self-checkout route has a 409
 * guard and the two admin routes have none; putting idempotency here covers all
 * three at once and keeps a fourth entry point from being born unguarded.
 *
 * Read-only by construction: no row is written, updated, cancelled, or expired
 * here, and MercadoPago is never called. A superseded pending subscription is
 * left to the `abandoned-pending-subs` cron.
 *
 * @module services/billing/checkout-idempotency
 */

import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingPendingCheckouts,
    billingSubscriptions,
    desc,
    entitySubscriptions,
    eq,
    getDb,
    partnerSubscriptions
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import type {
    CheckoutBridgeSnapshot,
    CheckoutReuseRefusal,
    PendingCheckoutSnapshot
} from './checkout-reuse-decision.js';
import { decideCheckoutReuse } from './checkout-reuse-decision.js';
import { buildPreapprovalPlanShareLink } from './mp-plan-provisioning.service.js';

/**
 * A checkout that is still in flight and may be handed back verbatim. Shape
 * matches the commerce/partner initiation results so a caller can return it
 * unchanged.
 */
export interface ReusableCheckout {
    /** The ORIGINAL MercadoPago hosted share link, rebuilt exactly. */
    readonly checkoutUrl: string;
    /** The `pending_provider` subscription opened by the first click. */
    readonly localSubscriptionId: string;
    /**
     * When the correlation row stops resolving (`PENDING_CHECKOUT_TTL_MS`,
     * 3h). NOT the reuse gate — since HOS-867 reuse itself lapses after
     * `CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS`; this value only states how
     * long the row can still be linked by a returning buyer or a webhook.
     */
    readonly expiresAt: string;
}

/** Coordinates shared by every reuse lookup. */
interface ReuseContextInput {
    /** Billing customer of the CURRENT checkout attempt. */
    readonly customerId: string;
    /** Commercial plan the CURRENT attempt resolved (`billing_plans.id`). */
    readonly planId: string;
    /** MercadoPago `preapproval_plan` the CURRENT attempt resolved/provisioned. */
    readonly mpPreapprovalPlanId: string;
    /** Drizzle client override (tests / transactions). Defaults to `getDb()`. */
    readonly db?: DrizzleClient;
}

/** Input for {@link resolveReusableCommerceCheckout}. */
export interface ResolveReusableCommerceCheckoutInput extends ReuseContextInput {
    /** Commerce entity discriminator (`'gastronomy' | 'experience'`). */
    readonly entityType: string;
    /** UUID of the commerce entity. */
    readonly entityId: string;
}

/** Input for {@link resolveReusablePartnerCheckout}. */
export interface ResolveReusablePartnerCheckoutInput extends ReuseContextInput {
    /** UUID of the partner. */
    readonly partnerId: string;
}

/** Input for {@link resolveReusableAccommodationCheckout} / its own-preapproval sibling. */
export interface ResolveReusableAccommodationCheckoutInput extends ReuseContextInput {
    /**
     * The CURRENT attempt's resolved plan domain (`ProductDomainEnum.ACCOMMODATION`
     * or `.TOURIST` — both share this checkout entry point, see
     * `assertAccommodationOrTouristPlanDomain` in `subscription-checkout.service.ts`).
     * Scopes the bridge lookup so a customer's unrelated commerce/partner/addon
     * `pending_provider` row is never mistaken for this one.
     */
    readonly productDomain: string;
}

/**
 * Loads the commerce bridge row for an entity.
 *
 * Filtered on BOTH `entity_type` and `entity_id` — the table's unique index is
 * the pair, and gastronomy/experience ids are drawn from independent key
 * spaces, so an id-only filter could match the wrong vertical's row.
 */
async function loadCommerceBridge(input: {
    entityType: string;
    entityId: string;
    db?: DrizzleClient;
}): Promise<CheckoutBridgeSnapshot | null> {
    const db = input.db ?? getDb();
    const rows = await db
        .select({
            subscriptionId: entitySubscriptions.subscriptionId,
            status: entitySubscriptions.status
        })
        .from(entitySubscriptions)
        .where(
            and(
                eq(entitySubscriptions.entityType, input.entityType),
                eq(entitySubscriptions.entityId, input.entityId)
            )
        )
        .limit(1);

    const row = rows[0];
    // HOS-1084 made `subscription_id` nullable so accommodation can CACHE
    // "this owner holds no subscription" instead of re-discovering it against
    // QZPay on every public read. Such a row is not a checkout bridge — there
    // is no in-flight subscription to hand back — and commerce never writes
    // one, so this is a narrowing guard, not a reachable commerce branch.
    if (!row || row.subscriptionId === null) {
        return null;
    }
    return { subscriptionId: row.subscriptionId, status: row.status };
}

/** Loads the partner bridge row (`UNIQUE(partner_id)`). */
async function loadPartnerBridge(input: {
    partnerId: string;
    db?: DrizzleClient;
}): Promise<CheckoutBridgeSnapshot | null> {
    const db = input.db ?? getDb();
    const rows = await db
        .select({
            subscriptionId: partnerSubscriptions.subscriptionId,
            status: partnerSubscriptions.status
        })
        .from(partnerSubscriptions)
        .where(eq(partnerSubscriptions.partnerId, input.partnerId))
        .limit(1);

    return rows[0] ?? null;
}

/**
 * Loads the accommodation "bridge" row — really the newest in-flight
 * `pending_provider` `billing_subscriptions` row for this customer, standing
 * in for the entity/partner bridge tables (HOS-1272; see the module docblock
 * for why accommodation has no such table).
 *
 * Filtered on `productDomain` matching the CURRENT attempt's resolved domain
 * (`ProductDomainEnum.ACCOMMODATION` or `.TOURIST`) so a dual-role customer's
 * unrelated gastronomy/experience/partner/addon `pending_provider` row is
 * never mistaken for one of these. Deliberately an EXACT match, not the
 * NULL-tolerant fail-open `subscriptionMatchesDomain()` uses for
 * accommodation elsewhere: HOS-1271 (merged minutes before this fix) already
 * stamps `productDomain` explicitly on every new row this function can ever
 * see, and a `pending_provider` row lives at most `PENDING_PROVIDER_TTL_MS`
 * (30 min) before `abandoned-pending-subs` reaps it — a NULL-domain row from
 * before HOS-1271 ages out of the window this function even queries within
 * half an hour of deploy. Widening to a NULL-tolerant match would resurrect
 * the fail-open discussion `subscriptionMatchesDomain()` already settled for
 * a DIFFERENT, longer-lived read path; this one does not need it.
 *
 * Ordered `createdAt DESC LIMIT 1`: unlike a bridge table there is no unique
 * index forcing at most one row per customer, so this picks the newest
 * attempt — matching `findReusableReplacementAttempt`'s identical choice in
 * `past-due-payment-method-replacement.service.ts`.
 */
async function loadAccommodationBridge(input: {
    customerId: string;
    productDomain: string;
    db?: DrizzleClient;
}): Promise<CheckoutBridgeSnapshot | null> {
    const db = input.db ?? getDb();
    const rows = await db
        .select({
            subscriptionId: billingSubscriptions.id,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, input.customerId),
                eq(billingSubscriptions.status, SubscriptionStatusEnum.PENDING_PROVIDER),
                eq(billingSubscriptions.productDomain, input.productDomain)
            )
        )
        .orderBy(desc(billingSubscriptions.createdAt))
        .limit(1);

    const row = rows[0];
    if (!row) {
        return null;
    }
    return { subscriptionId: row.subscriptionId, status: row.status };
}

/**
 * Loads the correlation row for a local subscription, UNFILTERED.
 *
 * Deliberately not `billingPendingCheckoutModel.findByLocalSubscriptionId`,
 * which pre-filters `status = 'pending' AND expires_at > now()` in SQL. Those
 * two conditions are load-bearing reuse rules, and a rule enforced inside a
 * query this module does not own is a rule no test of this module can prove
 * still fires. Fetching raw and letting {@link decideCheckoutReuse} judge keeps
 * every refusal reason visible, individually testable, and killable by mutation.
 */
async function loadCorrelationRow(input: {
    localSubscriptionId: string;
    db?: DrizzleClient;
}): Promise<PendingCheckoutSnapshot | null> {
    const db = input.db ?? getDb();
    const rows = await db
        .select({
            localSubscriptionId: billingPendingCheckouts.localSubscriptionId,
            customerId: billingPendingCheckouts.customerId,
            planId: billingPendingCheckouts.planId,
            mpPreapprovalPlanId: billingPendingCheckouts.mpPreapprovalPlanId,
            nonce: billingPendingCheckouts.nonce,
            status: billingPendingCheckouts.status,
            createdAt: billingPendingCheckouts.createdAt,
            expiresAt: billingPendingCheckouts.expiresAt,
            pendingDiscount: billingPendingCheckouts.pendingDiscount,
            pendingTrialExtension: billingPendingCheckouts.pendingTrialExtension
        })
        .from(billingPendingCheckouts)
        .where(eq(billingPendingCheckouts.localSubscriptionId, input.localSubscriptionId))
        .limit(1);

    const row = rows[0];
    if (!row) {
        return null;
    }
    return {
        localSubscriptionId: row.localSubscriptionId,
        customerId: row.customerId,
        planId: row.planId,
        mpPreapprovalPlanId: row.mpPreapprovalPlanId,
        nonce: row.nonce,
        status: row.status,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        hasPromoSnapshot:
            (row.pendingDiscount ?? null) !== null || (row.pendingTrialExtension ?? null) !== null
    };
}

/**
 * Shared tail: judge the two loaded rows, log the outcome, and rebuild the
 * original share link when reuse is allowed.
 */
function finalize(input: {
    bridge: CheckoutBridgeSnapshot | null;
    pendingCheckout: PendingCheckoutSnapshot | null;
    context: ReuseContextInput;
    logContext: Record<string, unknown>;
}): ReusableCheckout | null {
    const { bridge, pendingCheckout, context, logContext } = input;

    const decision = decideCheckoutReuse({
        bridge,
        pendingCheckout,
        customerId: context.customerId,
        planId: context.planId,
        mpPreapprovalPlanId: context.mpPreapprovalPlanId
    });

    if (!decision.reuse) {
        // Only worth a line once the entity actually had something in flight —
        // "never subscribed" is the overwhelmingly common path and says nothing.
        if (bridge !== null) {
            apiLogger.info(
                { ...logContext, reason: decision.reason satisfies CheckoutReuseRefusal },
                'checkout idempotency: not reusing the in-flight checkout, minting a new one'
            );
        }
        return null;
    }

    const reused = decision.pendingCheckout;
    apiLogger.info(
        { ...logContext, localSubscriptionId: reused.localSubscriptionId },
        'checkout idempotency: returning the in-flight share link instead of opening a second checkout'
    );

    return {
        checkoutUrl: buildPreapprovalPlanShareLink({
            mpPreapprovalPlanId: reused.mpPreapprovalPlanId,
            externalReference: reused.nonce
        }),
        localSubscriptionId: reused.localSubscriptionId,
        expiresAt: reused.expiresAt.toISOString()
    };
}

/**
 * Resolve the reusable in-flight checkout for a commerce listing, if any.
 *
 * @param input - See {@link ResolveReusableCommerceCheckoutInput}.
 * @returns The original checkout to hand back, or `null` when a fresh one must
 *   be created.
 */
export async function resolveReusableCommerceCheckout(
    input: ResolveReusableCommerceCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadCommerceBridge({
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.db ? { db: input.db } : {})
    });
    const pendingCheckout = bridge
        ? await loadCorrelationRow({
              localSubscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    return finalize({
        bridge,
        pendingCheckout,
        context: input,
        logContext: { entityType: input.entityType, entityId: input.entityId }
    });
}

/**
 * Resolve the reusable in-flight checkout for a partner, if any.
 *
 * @param input - See {@link ResolveReusablePartnerCheckoutInput}.
 * @returns The original checkout to hand back, or `null` when a fresh one must
 *   be created.
 */
export async function resolveReusablePartnerCheckout(
    input: ResolveReusablePartnerCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadPartnerBridge({
        partnerId: input.partnerId,
        ...(input.db ? { db: input.db } : {})
    });
    const pendingCheckout = bridge
        ? await loadCorrelationRow({
              localSubscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    return finalize({
        bridge,
        pendingCheckout,
        context: input,
        logContext: { partnerId: input.partnerId }
    });
}

/**
 * Resolve the reusable in-flight checkout for an accommodation (or tourist)
 * customer, if any (HOS-1272 — see the module docblock for why the CUSTOMER
 * is the bridge here instead of a dedicated link table).
 *
 * @param input - See {@link ResolveReusableAccommodationCheckoutInput}.
 * @returns The original checkout to hand back, or `null` when a fresh one must
 *   be created.
 */
export async function resolveReusableAccommodationCheckout(
    input: ResolveReusableAccommodationCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadAccommodationBridge({
        customerId: input.customerId,
        productDomain: input.productDomain,
        ...(input.db ? { db: input.db } : {})
    });
    const pendingCheckout = bridge
        ? await loadCorrelationRow({
              localSubscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    return finalize({
        bridge,
        pendingCheckout,
        context: input,
        logContext: { customerId: input.customerId, productDomain: input.productDomain }
    });
}

/**
 * HOS-937 step 4 (spec §6.6-B): the own-preapproval reuse window. Same
 * rationale as `PENDING_CHECKOUT_TTL_MS` in
 * `pending-provider-subscription-create.ts` (a slow card-first checkout —
 * 3DS/OTP, bank app hand-offs, walking away and coming back), reused verbatim
 * rather than re-derived: a `pending_provider` row born through
 * `createOwnPreapprovalSubscription` ALWAYS carries a real `mp_subscription_id`
 * from creation, so there is no correlation-row TTL to defer to any more —
 * this constant IS the reuse window.
 *
 * EXPORTED (HOS-1272) so `addon.checkout.recurring-idempotency.ts` and
 * `past-due-payment-method-replacement.service.ts` reference this ONE value
 * instead of each re-declaring `3 * 60 * 60 * 1000` under their own name — the
 * three separate declarations were flagged as a symptom of the SAME shape
 * having been reimplemented rather than shared. Each module still exports its
 * OWN named constant (existing importers depend on those specific names), but
 * the number now has exactly one source.
 */
export const OWN_PREAPPROVAL_REUSE_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Reads back the `checkoutUrl` / `mpPreapprovalPlanId` HOS-937 step 4 stamps
 * onto a `billing_subscriptions` row's `metadata` at creation
 * (`own-preapproval-subscription-create.ts`) — qzpay-core never persists
 * `providerInitPoint` to storage, so this is the ONLY place that URL survives
 * between the create call and a later reuse check.
 */
function readOwnPreapprovalMetadata(metadata: unknown): {
    readonly checkoutUrl: string | undefined;
    readonly mpPreapprovalPlanId: string | undefined;
} {
    const record = (metadata ?? {}) as Record<string, unknown>;
    return {
        checkoutUrl: typeof record.checkoutUrl === 'string' ? record.checkoutUrl : undefined,
        mpPreapprovalPlanId:
            typeof record.mpPreapprovalPlanId === 'string' ? record.mpPreapprovalPlanId : undefined
    };
}

/**
 * Judges whether a `billing_subscriptions` row (found through the commerce
 * or partner bridge row) is a genuinely reusable own-preapproval checkout for
 * the CURRENT attempt's coordinates.
 *
 * Mirrors `decideCheckoutReuse`'s identity + freshness conditions, adapted to
 * this flow's own invariant: since a `pending_provider` row from
 * `createOwnPreapprovalSubscription` ALWAYS has `mp_subscription_id` set,
 * "in flight" is answered by reading `billing_subscriptions` directly instead
 * of a separate `billing_pending_checkouts` correlation row — the object
 * handed back is the SAME preapproval's `init_point`, not a rebuilt URL
 * (spec §6.6-B).
 */
function decideOwnPreapprovalReuse(input: {
    readonly row: {
        readonly id: string;
        readonly customerId: string;
        readonly planId: string;
        readonly status: string;
        readonly mpSubscriptionId: string | null;
        readonly metadata: unknown;
        readonly createdAt: Date;
    } | null;
    readonly context: ReuseContextInput;
}): ReusableCheckout | null {
    const { row, context } = input;
    if (!row) {
        return null;
    }

    const { checkoutUrl, mpPreapprovalPlanId } = readOwnPreapprovalMetadata(row.metadata);
    const ageMs = Date.now() - row.createdAt.getTime();

    if (
        row.customerId !== context.customerId ||
        row.planId !== context.planId ||
        row.status !== SubscriptionStatusEnum.PENDING_PROVIDER ||
        !row.mpSubscriptionId ||
        !checkoutUrl ||
        // HOS-1221: BOTH sides must be present, not merely equal. The stored
        // side is `metadata.mpPreapprovalPlanId` and the context side is what
        // the current attempt just resolved; if a future change ever stopped
        // producing one of them, a bare `!==` would compare `undefined` against
        // `undefined`, MATCH, and hand back an in-flight checkout priced at the
        // old amount. The drift guard has to fail closed, so an absent key is a
        // refusal, never a match.
        !mpPreapprovalPlanId ||
        !context.mpPreapprovalPlanId ||
        mpPreapprovalPlanId !== context.mpPreapprovalPlanId ||
        ageMs >= OWN_PREAPPROVAL_REUSE_WINDOW_MS
    ) {
        return null;
    }

    return {
        checkoutUrl,
        localSubscriptionId: row.id,
        expiresAt: new Date(row.createdAt.getTime() + OWN_PREAPPROVAL_REUSE_WINDOW_MS).toISOString()
    };
}

/** Loads the `billing_subscriptions` row a bridge row points at, unfiltered. */
async function loadOwnPreapprovalSubscriptionRow(input: {
    readonly subscriptionId: string;
    readonly db?: DrizzleClient;
}) {
    const db = input.db ?? getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            status: billingSubscriptions.status,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            metadata: billingSubscriptions.metadata,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, input.subscriptionId))
        .limit(1);

    return rows[0] ?? null;
}

/**
 * Resolve the reusable in-flight own-preapproval checkout for a commerce
 * listing, if any (HOS-937 step 4, flag-gated replacement for
 * {@link resolveReusableCommerceCheckout}).
 *
 * @param input - See {@link ResolveReusableCommerceCheckoutInput}.
 * @returns The SAME `init_point` already in flight, or `null` when a fresh
 *   checkout must be created.
 */
export async function resolveReusableCommerceOwnPreapprovalCheckout(
    input: ResolveReusableCommerceCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadCommerceBridge({
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.db ? { db: input.db } : {})
    });
    const row = bridge
        ? await loadOwnPreapprovalSubscriptionRow({
              subscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    const reused = decideOwnPreapprovalReuse({ row, context: input });
    if (reused) {
        apiLogger.info(
            {
                entityType: input.entityType,
                entityId: input.entityId,
                localSubscriptionId: reused.localSubscriptionId
            },
            'HOS-937: returning the in-flight own-preapproval checkout instead of opening a second one'
        );
    }
    return reused;
}

/**
 * Resolve the reusable in-flight own-preapproval checkout for a partner, if
 * any (HOS-937 step 4, flag-gated replacement for
 * {@link resolveReusablePartnerCheckout}).
 *
 * @param input - See {@link ResolveReusablePartnerCheckoutInput}.
 * @returns The SAME `init_point` already in flight, or `null` when a fresh
 *   checkout must be created.
 */
export async function resolveReusablePartnerOwnPreapprovalCheckout(
    input: ResolveReusablePartnerCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadPartnerBridge({
        partnerId: input.partnerId,
        ...(input.db ? { db: input.db } : {})
    });
    const row = bridge
        ? await loadOwnPreapprovalSubscriptionRow({
              subscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    const reused = decideOwnPreapprovalReuse({ row, context: input });
    if (reused) {
        apiLogger.info(
            { partnerId: input.partnerId, localSubscriptionId: reused.localSubscriptionId },
            'HOS-937: returning the in-flight own-preapproval checkout instead of opening a second one'
        );
    }
    return reused;
}

/**
 * Resolve the reusable in-flight own-preapproval checkout for an
 * accommodation (or tourist) customer, if any (HOS-1272, mirroring the
 * HOS-937 step 4 commerce/partner siblings above — see the module docblock
 * for why the CUSTOMER is the bridge here).
 *
 * @param input - See {@link ResolveReusableAccommodationCheckoutInput}.
 * @returns The SAME `init_point` already in flight, or `null` when a fresh
 *   checkout must be created.
 */
export async function resolveReusableAccommodationOwnPreapprovalCheckout(
    input: ResolveReusableAccommodationCheckoutInput
): Promise<ReusableCheckout | null> {
    const bridge = await loadAccommodationBridge({
        customerId: input.customerId,
        productDomain: input.productDomain,
        ...(input.db ? { db: input.db } : {})
    });
    const row = bridge
        ? await loadOwnPreapprovalSubscriptionRow({
              subscriptionId: bridge.subscriptionId,
              ...(input.db ? { db: input.db } : {})
          })
        : null;

    const reused = decideOwnPreapprovalReuse({ row, context: input });
    if (reused) {
        apiLogger.info(
            {
                customerId: input.customerId,
                productDomain: input.productDomain,
                localSubscriptionId: reused.localSubscriptionId
            },
            'HOS-1272: returning the in-flight accommodation own-preapproval checkout instead of opening a second one'
        );
    }
    return reused;
}
