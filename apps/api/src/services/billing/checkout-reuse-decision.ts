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
 * ## HOS-867: "in flight" is a freshness question, not a TTL question
 *
 * Until HOS-867 the ONLY time gate was the correlation row's 3-hour
 * `expiresAt`, so a buyer whose card was rejected at MercadoPago's hosted
 * checkout was handed the SAME (now dead) share link for up to three hours.
 * A rejected hosted checkout produces NO MercadoPago object (HOS-937 spec
 * §8.3, measured: "no new object and no payment are created") and therefore
 * no webhook — there is no signal to invalidate on, and with no
 * `mp_subscription_id` there is no per-checkout object to ask MercadoPago
 * about either. The one signal that reliably distinguishes a retry after a
 * failed attempt from a double click is the AGE of the in-flight checkout:
 * no buyer can load MercadoPago's hosted page, attempt a payment, be
 * rejected, and navigate back in under {@link CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS},
 * while a double click lands well under two seconds. Past that window, reuse
 * is refused and a fresh checkout is minted (superseding the old correlation
 * row, exactly as every other refusal already does).
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
 * The maximum age (ms) at which an in-flight checkout may be handed back
 * verbatim instead of minting a fresh one (HOS-867).
 *
 * This window's ONLY job is double-click idempotency — the same job the
 * 3-hour TTL was doing until HOS-867, minus the hours. A mechanical double
 * click lands well under two seconds; a buyer who actually completed a
 * MercadoPago hosted round-trip (load the page, attempt a payment, be
 * rejected, navigate back) cannot return in under ~15 seconds even with a
 * saved card. Ten seconds sits between the two, with margin on both sides.
 *
 * Past the window, reuse is REFUSED even though the checkout may still be
 * technically alive, because the failure modes are not symmetric:
 *
 * - wrongly REUSING hands a buyer whose payment failed a dead link for up to
 *   three hours (the bug this closes — measured by the 25/08 smoke, H-31);
 * - wrongly MINTING leaves a superseded pending row that the
 *   `abandoned-pending-subs` cron already reaps, and a second live link that
 *   only becomes a second charge if the buyer deliberately completes BOTH
 *   checkouts — the alternative outcome the staging smoke checklist's D5
 *   (browser-back during checkout) already documents as acceptable.
 *
 * A buyer who retries within the window and still receives a stale link
 * crosses it on their very next attempt seconds later — the worst case is
 * one extra click, never a lockout.
 *
 * Note this is deliberately NOT the 3-hour `PENDING_CHECKOUT_TTL_MS`
 * (`pending-provider-subscription-create.ts`): that TTL governs how long the
 * correlation row can still be LINKED by a slow returning buyer or a webhook
 * and must stay long; reuse itself is the only thing that lapses here.
 */
export const CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS = 10_000;

/**
 * The domain bridge row that ties an entity (commerce listing / partner) to its
 * current billing subscription. Both `entity_subscriptions` and
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
    /**
     * When the checkout this row describes was opened (`created_at`) — the
     * same instant the `pending_provider` subscription was created, since
     * both rows are written in one transaction. Drives the
     * {@link CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS} freshness gate: a
     * checkout old enough that the buyer must have already been to
     * MercadoPago and back is no longer assumed to be the same buyer
     * gesture (HOS-867).
     */
    readonly createdAt: Date;
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
    | 'double-click-window-elapsed'
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
 * 5. **The checkout is younger than {@link CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS}**
 *    (HOS-867) — the window's only job is double-click idempotency. Past it,
 *    the buyer has had time to reach MercadoPago, fail there, and come back;
 *    MercadoPago reports nothing for a rejected hosted checkout (no
 *    preapproval, no webhook), so age is the only signal that separates a
 *    retry after a failed attempt from a double click. Refusing reuse mints a
 *    fresh checkout and supersedes the old correlation row, leaving the
 *    superseded subscription to the `abandoned-pending-subs` cron — the same
 *    disposal every other refusal already uses.
 * 6. **The billing customer is unchanged** — a listing that changed owners must
 *    not be paid for on the previous owner's checkout.
 * 7. **The commercial plan is unchanged** — an admin re-sending a partner link
 *    after switching plans must get the new plan.
 * 8. **The MercadoPago plan is unchanged** — `resolveOrProvisionMpPlan`
 *    re-provisions on price drift, so a different `preapproval_plan` id means
 *    the stored link would charge the OLD price. Never serve it.
 * 9. **No promo snapshot on the stored row** — commerce and partner checkouts
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
    // HOS-867: freshness gate, deliberately AFTER the expiry check so a row
    // past its 3-hour TTL still reports `correlation-expired` (the vocabulary
    // ops already reads for that case) and the new reason only ever covers
    // the 10s..3h band where the bug lived. The boundary is inclusive-refuse,
    // matching the expiry boundary above: exactly-at-the-window is a refusal,
    // one millisecond inside is a reuse.
    if (
        now.getTime() - pendingCheckout.createdAt.getTime() >=
        CHECKOUT_REUSE_DOUBLE_CLICK_WINDOW_MS
    ) {
        return { reuse: false, reason: 'double-click-window-elapsed' };
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
