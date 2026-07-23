/**
 * Pending-provider subscription creator for the MercadoPago hosted
 * preapproval-plan share-link checkout ("Path C", HOS-191).
 *
 * Path C never creates the MercadoPago preapproval server-side —
 * `billing.subscriptions.create({ mode: 'paid', providerPriceId })` (the
 * previous flow) calls `POST /preapproval` with a `preapproval_plan_id` and
 * MercadoPago rejects it with "card_token_id is required" unless a card was
 * already tokenized, which Hospeda's self-serve checkout never does. Instead,
 * the checkout redirects the browser to MercadoPago's HOSTED share link for
 * the resolved `preapproval_plan` (where MP itself collects the card), and
 * this helper materializes the two rows the eventual link-back needs:
 *
 *   1. a `billing_subscriptions` row in `pending_provider` status, with NO
 *      `mp_subscription_id` — the real MercadoPago preapproval does not
 *      exist yet; it is created by MercadoPago itself once the customer
 *      completes the hosted checkout.
 *   2. a `billing_pending_checkouts` correlation row that lets the eventual
 *      `back_url` redirect handler or `preapproval.created` /
 *      `subscription_authorized_payment.created` webhook (F2/F3, NOT
 *      implemented here) link the real preapproval id back to this
 *      subscription.
 *
 * Both inserts run in ONE transaction (`withServiceTransaction`) so a
 * partial write can never leave a `pending_provider` subscription with no
 * correlation row to reconcile it (or vice versa) — the same atomicity
 * guarantee `createCompSubscription` gives the comp-redemption path, whose
 * insert shape this helper deliberately mirrors.
 *
 * @module services/billing/pending-provider-subscription-create
 */

import { randomBytes } from 'node:crypto';
import { billingPendingCheckoutModel, billingSubscriptions, eq } from '@repo/db';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { withServiceTransaction } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';

/**
 * How long a `billing_pending_checkouts` correlation row stays linkable — the
 * window inside which the `abandoned-pending-subs` cron will NOT reap the
 * `pending_provider` subscription it points at (FIX B layer 1, HOS-191 Path C).
 *
 * Deliberately LONGER than the cron's candidate-selection TTL
 * ({@link PENDING_PROVIDER_TTL_MS} in `subscription-checkout.service.ts`, 30
 * minutes): those two windows are NOT the same thing. The 30-minute cron TTL
 * decides when a `pending_provider` row becomes a reap *candidate*; this 3-hour
 * checkout TTL decides whether the reaper *skips* that candidate because a real
 * MercadoPago hosted checkout may still be in flight.
 *
 * 3 hours comfortably covers a realistically slow card-first checkout — a
 * customer wrestling with 3DS/OTP, bank app hand-offs, or simply walking away
 * and coming back — where MercadoPago has (or is about to) collect the card but
 * the back_url/webhook link has not fired yet. The `billing_subscriptions` row
 * legitimately shows as "pending" for up to that long; the overwhelming
 * common case still links within seconds of the back_url redirect, so this only
 * affects the long tail. After the 3 hours elapse with no link, the reaper
 * treats the row as a genuine abandonment.
 */
const PENDING_CHECKOUT_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * A promo-code discount resolved at checkout time but not yet applied to a
 * real MercadoPago preapproval (Path C creates no preapproval synchronously
 * to mutate). Snapshotted on the correlation row; applied as a follow-up
 * mutation once the preapproval is linked (F2/F3).
 */
export interface PendingCheckoutDiscount {
    /** The DB promo code id (for stamping + redemption once applied). */
    readonly promoCodeId: string;
    /** The discounted cycle-1 amount, in centavos (baked into the MP plan, HOS-244). */
    readonly finalAmountCentavos: number;
    /**
     * The discount's `durationCycles` snapshotted at checkout (HOS-244). `null` =
     * forever; `N` = finite N-cycle discount. Carried on the snapshot so the
     * link-time bookkeeping can seed `promo_effect_remaining_cycles` WITHOUT
     * re-resolving the promo code — which is what makes stamping fail-closed and
     * closes the permanent-discount leak (a born-discounted preapproval whose
     * counter never gets seeded would never restore to full).
     *
     * Optional for backward-compat with pending checkouts snapshotted BEFORE this
     * field existed (in-flight rows at deploy time): when absent, the link path
     * falls back to re-resolving it from the promo code.
     */
    readonly durationCycles?: number | null;
}

/**
 * Input for {@link createPendingProviderSubscription}.
 */
export interface CreatePendingProviderSubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /** The Hospeda commercial plan id (`billing_plans.id`, a UUID). */
    readonly planId: string;
    /** The qzpay price id (`billing_prices.id`) for this variant. Not a column on
     * `billing_subscriptions` — stamped into `metadata` for traceability, mirroring
     * how the pre-Path-C flow's `metadata.intendedInterval` served the same purpose. */
    readonly priceId: string;
    /** Billing cadence of this checkout. */
    readonly billingInterval: 'monthly' | 'annual';
    /** The MercadoPago `preapproval_plan` id the customer is being redirected to. */
    readonly mpPreapprovalPlanId: string;
    /** Snapshot of the customer's email, used as a webhook-fallback reconciliation signal. */
    readonly payerEmail: string;
    /**
     * Whether this checkout granted free trial days (baked into the MP plan
     * referenced by {@link mpPreapprovalPlanId} — see `resolveCheckoutMpPlanId`).
     * Stamped into `metadata` since the local subscription cannot carry a real
     * `trialing` status until the preapproval is linked and confirmed (HOS-171:
     * `TRIALING` is derived, never stored at creation).
     */
    readonly trialGranted: boolean;
    /**
     * Free trial length in days, resolved once at checkout by
     * `resolveCheckoutFreeTrialDays` (plan base + any `trial_extension` promo).
     * `undefined` when no trial applies. Persisted here (HOS-211 Option B) as
     * `trialStart`/`trialEnd` on the row itself, so the eventual webhook's
     * preserve-if-set logic (`resolvedTrialEnd = localSubscription.trialEnd ?? ...`
     * in `subscription-logic.ts`) can derive `trialing` WITHOUT depending on
     * `auto_recurring.free_trial` being present on qzpay's `retrieve()` response
     * — which it is not, on `@qazuor/qzpay-mercadopago@2.6.0`'s mapped shape.
     * Does NOT change `status`, which stays `pending_provider` regardless (see
     * the insert below) — entitlements gate on status only (HOS-171).
     */
    readonly freeTrialDays?: number;
    /** A resolved-but-not-yet-applied discount (SPEC-262), if a `discount` promo code was used. */
    readonly pendingDiscount?: PendingCheckoutDiscount;
    /**
     * A DB-backed `trial_extension` promo whose free days were granted on this
     * checkout (HOS-240). Snapshotted on the `billing_pending_checkouts`
     * correlation row and DEFERRED to link time — exactly like
     * {@link pendingDiscount}. The redemption (`used_count++`, usage row,
     * `promo_code_id` stamp) is recorded by `link-preapproval.service.ts` ONLY
     * once the real MercadoPago preapproval is linked, so an abandoned checkout
     * never burns a capped code for a subscription that never activated.
     * Omitted for config-backed trials (no DB row), kill-switched/ineligible
     * trials, and non-trial checkouts.
     */
    readonly pendingTrialExtension?: {
        readonly promoCodeId: string;
        readonly code: string;
    };
    /** Product domain to stamp on the subscription. Defaults to `'accommodation'`. */
    readonly productDomain?: string;
    /** Whether the customer/record is in live mode. */
    readonly livemode: boolean;
}

/**
 * Result of {@link createPendingProviderSubscription}.
 */
export interface CreatePendingProviderSubscriptionResult {
    /** The id of the freshly-created `status='pending_provider'` subscription. */
    readonly localSubscriptionId: string;
    /** The anti-IDOR correlation nonce, embedded in the `back_url` query string by the caller. */
    readonly nonce: string;
    /** ISO timestamp at which the `abandoned-pending-subs` cron will reap this row if never linked. */
    readonly expiresAt: string;
}

/**
 * Create a `status='pending_provider'` subscription plus its
 * `billing_pending_checkouts` correlation row for the share-link checkout
 * flow (HOS-191 Path C). Creates NO MercadoPago preapproval — that happens
 * entirely on MercadoPago's hosted page.
 *
 * @param input - Customer/plan/price identifiers, the resolved MP plan id,
 *   and checkout-time state (trial/discount) to snapshot for later linking.
 * @returns The created subscription id, correlation nonce, and expiry.
 * @throws Error when the atomic transaction fails (caller maps to 500).
 *
 * @example
 * ```ts
 * const { localSubscriptionId, nonce, expiresAt } = await createPendingProviderSubscription({
 *   customerId,
 *   planId: plan.id,
 *   priceId: monthlyPrice.id,
 *   billingInterval: 'monthly',
 *   mpPreapprovalPlanId: providerPriceId,
 *   payerEmail: customer.email,
 *   trialGranted: freeTrialDays !== undefined,
 *   freeTrialDays,
 *   livemode: customer.livemode
 * });
 * ```
 */
export async function createPendingProviderSubscription(
    input: CreatePendingProviderSubscriptionInput
): Promise<CreatePendingProviderSubscriptionResult> {
    const {
        customerId,
        planId,
        priceId,
        billingInterval,
        mpPreapprovalPlanId,
        payerEmail,
        trialGranted,
        freeTrialDays,
        pendingDiscount,
        pendingTrialExtension,
        livemode
    } = input;
    const productDomain = input.productDomain ?? ProductDomainEnum.ACCOMMODATION;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PENDING_CHECKOUT_TTL_MS);
    const localSubscriptionId = crypto.randomUUID();
    // Anti-IDOR correlation token embedded in the `back_url` query string
    // (F2, not implemented here) — 16 bytes -> 32 hex chars, well under the
    // `nonce varchar(64)` column limit.
    const nonce = randomBytes(16).toString('hex');
    // Mirrors `createCompSubscription`'s mapping to the qzpay storage shape.
    const dbBillingInterval = billingInterval === 'annual' ? 'year' : 'month';

    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        // 1. Insert the pending_provider subscription row. No mp_subscription_id
        //    (the preapproval does not exist yet) and no promo_code_id — a
        //    `pendingDiscount` or `pendingTrialExtension` (HOS-240) is only
        //    resolved, not REDEEMED, until F2/F3 links the real preapproval and
        //    applies/records it (see `link-preapproval.service.ts`).
        await tx.insert(billingSubscriptions).values({
            id: localSubscriptionId,
            customerId,
            planId,
            billingInterval: dbBillingInterval,
            intervalCount: 1,
            currentPeriodStart: now,
            // Placeholder — overwritten with the real MP-reported period once
            // the preapproval is linked (F2/F3). Bounded to the same TTL as the
            // correlation row so an unreconciled row never claims a real
            // billing period; `current_period_end` is NOT NULL in the schema.
            currentPeriodEnd: expiresAt,
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            // HOS-211 Option B: persist the trial window at creation time, from
            // the checkout-time-resolved `freeTrialDays`, instead of relying on
            // the webhook to derive it from a live `auto_recurring.free_trial`
            // that qzpay's mapped subscription shape does not expose. `status`
            // intentionally stays `pending_provider` above — a set `trialEnd` on
            // a pending row grants nothing until the webhook flips status, per
            // the HOS-171 guard (entitlements gate on status, never trial_end).
            trialStart: freeTrialDays === undefined ? null : now,
            trialEnd:
                freeTrialDays === undefined
                    ? null
                    : new Date(now.getTime() + freeTrialDays * 24 * 60 * 60 * 1000),
            livemode,
            metadata: {
                source: 'start-paid-share-link',
                createdBy: 'subscription-flow',
                intendedInterval: billingInterval,
                priceId,
                mpPreapprovalPlanId,
                trialGranted: String(trialGranted)
            }
        });

        // 2. Stamp product_domain via a typed UPDATE — mirrors the commerce
        //    flow's and the comp flow's identical two-step stamp.
        await tx
            .update(billingSubscriptions)
            .set({ productDomain })
            .where(eq(billingSubscriptions.id, localSubscriptionId));

        // 3. Insert the correlation row, INSIDE the same transaction so the
        //    pending_provider subscription can never exist without a way to
        //    link it (or vice versa). Both `pendingDiscount` and
        //    `pendingTrialExtension` (HOS-240) are SNAPSHOTTED here — their
        //    application/redemption is deferred to link time.
        await billingPendingCheckoutModel.create(
            {
                localSubscriptionId,
                customerId,
                planId,
                mpPreapprovalPlanId,
                nonce,
                payerEmail,
                ...(pendingDiscount ? { pendingDiscount } : {}),
                ...(pendingTrialExtension ? { pendingTrialExtension } : {}),
                status: 'pending',
                expiresAt
            },
            tx
        );
    });

    apiLogger.info(
        { localSubscriptionId, customerId, planId, billingInterval, mpPreapprovalPlanId },
        'HOS-191: materialized pending_provider subscription for share-link checkout'
    );

    return { localSubscriptionId, nonce, expiresAt: expiresAt.toISOString() };
}
