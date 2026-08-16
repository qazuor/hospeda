/**
 * Per-entity checkout idempotency for the commerce and partner Path C flows.
 *
 * Reads the two rows that describe an entity's in-flight checkout — the domain
 * bridge row (`commerce_listing_subscriptions` / `partner_subscriptions`) and
 * the `billing_pending_checkouts` correlation row it points at — hands them to
 * the pure {@link decideCheckoutReuse}, and, when reuse is allowed, rebuilds the
 * ORIGINAL MercadoPago share link instead of minting a second one.
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
    commerceListingSubscriptions,
    eq,
    getDb,
    partnerSubscriptions
} from '@repo/db';
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
    /** When the correlation row — and therefore this reuse window — expires. */
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
            subscriptionId: commerceListingSubscriptions.subscriptionId,
            status: commerceListingSubscriptions.status
        })
        .from(commerceListingSubscriptions)
        .where(
            and(
                eq(commerceListingSubscriptions.entityType, input.entityType),
                eq(commerceListingSubscriptions.entityId, input.entityId)
            )
        )
        .limit(1);

    return rows[0] ?? null;
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
