/**
 * Pure decision function behind the per-entity checkout idempotency
 * (commerce listings and partners).
 *
 * ## Why this exists
 *
 * Since the Path C migration (HOS-191) a checkout no longer creates a
 * MercadoPago preapproval server-side: it provisions a `preapproval_plan`,
 * materializes a `pending_provider` subscription plus a
 * `billing_pending_checkouts` correlation row, and hands the buyer MercadoPago's
 * HOSTED share link. Nothing tied that link to the ENTITY, so every click minted
 * a fresh subscription and a fresh, independently payable link. Two clicks, two
 * live links, and a buyer who pays both is charged twice for one listing.
 *
 * The route-level 409 cannot close this: it keys on
 * `{active, trialing, past_due}` and an in-flight checkout sits at
 * `pending_provider`, deliberately outside that set — including
 * `pending_provider` would wedge a listing forever on a single abandoned
 * checkout. The two admin entry points have no guard at all.
 *
 * The fix is to make the checkout IDEMPOTENT while it is genuinely in flight:
 * hand back the SAME share link instead of minting another. This module owns
 * the "is it genuinely in flight, and is it still the RIGHT link" question, in
 * one pure, side-effect-free place, so every refusal reason is independently
 * testable and no branch can be reached only through a live database.
 *
 * ## Deliberately NOT done here
 *
 * Nothing is cancelled, paused, or refunded — in MercadoPago or locally. A
 * superseded pending subscription is simply left for the `abandoned-pending-subs`
 * cron, which is the existing, human-free disposal path for exactly this row
 * shape. Moving money without a human is out of scope by owner decision.
 *
 * @module services/billing/checkout-reuse-decision
 */

import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * The domain bridge row that ties an entity (commerce listing / partner) to its
 * current billing subscription. Both `commerce_listing_subscriptions` and
 * `partner_subscriptions` are upserted per entity, so at most one exists.
 */
export interface CheckoutBridgeSnapshot {
    /** `billing_subscriptions.id` the entity currently points at. */
    readonly subscriptionId: string;
    /** Denormalized mirror of that subscription's status. */
    readonly status: string;
}

/**
 * The `billing_pending_checkouts` correlation row for a `pending_provider`
 * subscription — everything needed to decide whether its share link is still
 * the correct one, and to rebuild that link byte-for-byte.
 */
export interface PendingCheckoutSnapshot {
    /** `billing_subscriptions.id` this correlation row belongs to. */
    readonly localSubscriptionId: string;
    /** Billing customer the checkout was opened for. */
    readonly customerId: string;
    /** Hospeda commercial plan id snapshotted at checkout time. */
    readonly planId: string;
    /** MercadoPago `preapproval_plan` id the buyer was redirected to. */
    readonly mpPreapprovalPlanId: string;
    /** Anti-IDOR token stamped on the share link as `external_reference`. */
    readonly nonce: string;
    /** Correlation lifecycle: `pending` | `linked` | `reconcile_assisted`. */
    readonly status: string;
    /** When this correlation row stops resolving. */
    readonly expiresAt: Date;
    /**
     * Whether the row carries a `pendingDiscount` / `pendingTrialExtension`
     * snapshot. See {@link decideCheckoutReuse} for why its mere presence
     * forbids reuse.
     */
    readonly hasPromoSnapshot: boolean;
}

/** Why an in-flight checkout was NOT reused. Logged for ops, never returned to a client. */
export type CheckoutReuseRefusal =
    | 'no-bridge-row'
    | 'bridge-not-pending-provider'
    | 'no-correlation-row'
    | 'correlation-not-pending'
    | 'correlation-expired'
    | 'customer-changed'
    | 'plan-changed'
    | 'mp-plan-changed'
    | 'promo-snapshot-present';

/** Input for {@link decideCheckoutReuse}. */
export interface DecideCheckoutReuseInput {
    /** The entity's current bridge row, or `null` when it never had one. */
    readonly bridge: CheckoutBridgeSnapshot | null;
    /** The correlation row for `bridge.subscriptionId`, or `null` when absent. */
    readonly pendingCheckout: PendingCheckoutSnapshot | null;
    /** Billing customer the CURRENT checkout attempt belongs to. */
    readonly customerId: string;
    /** Commercial plan the CURRENT attempt resolved. */
    readonly planId: string;
    /** MercadoPago `preapproval_plan` the CURRENT attempt resolved/provisioned. */
    readonly mpPreapprovalPlanId: string;
    /** "Now" reference for the expiry check. Injected so tests can lock the clock. */
    readonly now?: Date;
}

/** Outcome of {@link decideCheckoutReuse}. */
export type CheckoutReuseDecision =
    | { readonly reuse: true; readonly pendingCheckout: PendingCheckoutSnapshot }
    | { readonly reuse: false; readonly reason: CheckoutReuseRefusal };

/**
 * Decide whether an entity's in-flight checkout may be handed back instead of
 * minting a second one.
 *
 * Reuse requires ALL of the following. Each is a distinct failure mode that a
 * naive "if a pending exists, reuse it" would get wrong:
 *
 * 1. **A bridge row exists** — the entity was subscribed at least once.
 * 2. **The bridge row is `pending_provider`** — this is the ONLY window
 *    idempotency covers. A live subscription (`active`/`trialing`/`past_due`) is
 *    the route-level 409's business, and answering it with a stale share link
 *    would be strictly worse than the 409 it is supposed to get.
 * 3. **A correlation row exists and is still `pending`** — once F2/F3 links the
 *    real preapproval the row flips to `linked`/`reconcile_assisted`; that
 *    checkout is finished, not in flight.
 * 4. **The correlation row has not expired** — an abandoned checkout must never
 *    wedge the entity. Past `expiresAt`, a NEW checkout is the correct answer,
 *    which is precisely why widening the 409 to `pending_provider` was rejected.
 * 5. **The billing customer is unchanged** — a listing that changed owners must
 *    not be paid for on the previous owner's checkout.
 * 6. **The commercial plan is unchanged** — an admin re-sending a partner link
 *    after switching plans must get the new plan.
 * 7. **The MercadoPago plan is unchanged** — `resolveOrProvisionMpPlan`
 *    re-provisions on price drift, so a different `preapproval_plan` id means
 *    the stored link would charge the OLD price. Never serve it.
 * 8. **No promo snapshot on the stored row** — commerce and partner checkouts
 *    accept no promo code today, so this cannot fire yet; it is a forward fence.
 *    A promo lives on the correlation row, and the code supplied on the second
 *    click is not necessarily the one snapshotted on the first, so reusing the
 *    old link could hand the buyer the wrong discount. Fail CLOSED: mint a fresh
 *    checkout carrying whatever the current attempt actually resolved.
 *
 * @param input - See {@link DecideCheckoutReuseInput}.
 * @returns `{ reuse: true, pendingCheckout }` when the stored share link is
 *   still exactly the right one, otherwise `{ reuse: false, reason }`.
 */
export function decideCheckoutReuse(input: DecideCheckoutReuseInput): CheckoutReuseDecision {
    const { bridge, pendingCheckout, customerId, planId, mpPreapprovalPlanId } = input;
    const now = input.now ?? new Date();

    if (bridge === null) {
        return { reuse: false, reason: 'no-bridge-row' };
    }
    if (bridge.status !== SubscriptionStatusEnum.PENDING_PROVIDER) {
        return { reuse: false, reason: 'bridge-not-pending-provider' };
    }
    if (pendingCheckout === null) {
        return { reuse: false, reason: 'no-correlation-row' };
    }
    if (pendingCheckout.status !== 'pending') {
        return { reuse: false, reason: 'correlation-not-pending' };
    }
    if (pendingCheckout.expiresAt.getTime() <= now.getTime()) {
        return { reuse: false, reason: 'correlation-expired' };
    }
    if (pendingCheckout.customerId !== customerId) {
        return { reuse: false, reason: 'customer-changed' };
    }
    if (pendingCheckout.planId !== planId) {
        return { reuse: false, reason: 'plan-changed' };
    }
    if (pendingCheckout.mpPreapprovalPlanId !== mpPreapprovalPlanId) {
        return { reuse: false, reason: 'mp-plan-changed' };
    }
    if (pendingCheckout.hasPromoSnapshot) {
        return { reuse: false, reason: 'promo-snapshot-present' };
    }

    return { reuse: true, pendingCheckout };
}
