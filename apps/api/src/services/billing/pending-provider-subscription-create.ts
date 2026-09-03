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
 * insert shape this helper deliberately mirrors. A caller with its OWN
 * domain link row to write (commerce, partner) joins that same transaction
 * through `writeDomainLinkRow` rather than opening a second one.
 *
 * @module services/billing/pending-provider-subscription-create
 */

import { randomBytes } from 'node:crypto';
import {
    billingPendingCheckoutModel,
    billingSubscriptions,
    type DrizzleClient,
    eq
} from '@repo/db';
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
 * A resolved-but-not-yet-redeemed `trial_extension` promo code (HOS-240),
 * snapshotted at checkout time. Named/exported (rather than kept inline on
 * {@link CreatePendingProviderSubscriptionInput}) so both checkout flows
 * that snapshot it — the `billing_pending_checkouts` correlation row here,
 * and `billing_subscriptions.metadata` for the HOS-937 own-preapproval flow
 * — share the same shape instead of duplicating it structurally.
 */
export interface PendingTrialExtension {
    /** The DB promo code id (for the redemption record + FK stamp). */
    readonly promoCodeId: string;
    /** The normalized promo code string (logging / redemption record). */
    readonly code: string;
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
    /**
     * Snapshot of the customer's email, used as a webhook-fallback reconciliation
     * signal.
     *
     * OPTIONAL, and deliberately so: `verifyPreapprovalOwnership`
     * (`link-preapproval.service.ts`) treats this snapshot as a VETO — a
     * CONFIRMED mismatch against the live preapproval's payer email refuses the
     * link on every tier, while an ABSENT snapshot never blocks one. Omit it
     * whenever the local billing customer's email is not the payer's real
     * address, rather than snapshotting a placeholder: a value that can never
     * match is strictly worse than no value, because it turns every webhook
     * link into a permanent refusal. The partner checkout is exactly that case
     * (its customer carries a synthetic `@partners.hospeda.invalid` address —
     * see `routes/partners/admin/send-link.ts`). Tier 3 candidate selection
     * already accepts a NULL snapshot (`findReconcileCandidates` matches
     * `payer_email = X OR payer_email IS NULL`).
     */
    readonly payerEmail?: string;
    /*
     * HOS-1012: `trialGranted` and `freeTrialDays` are GONE from this input.
     *
     * They existed so a checkout could pre-write the trial window it had just
     * asked MercadoPago for (HOS-211 Option B / HOS-812), because the provider's
     * own `retrieve()` shape could not be trusted to report it. No checkout asks
     * for a trial any more, so there is no window to pre-write and no provider
     * answer to second-guess: a row created here is always born with
     * `trialStart`/`trialEnd` NULL.
     *
     * Hospeda's trial is now local and starts elsewhere — at the owner's first
     * publish, with no card and no MercadoPago object behind it.
     */
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
    readonly pendingTrialExtension?: PendingTrialExtension;
    /** Product domain to stamp on the subscription. Defaults to `'accommodation'`. */
    readonly productDomain?: string;
    /**
     * Domain coordinates merged into the subscription's `metadata` — the
     * SUBSCRIPTION → ENTITY path (`{ commerceEntityType, commerceEntityId }`
     * for commerce, `{ partnerId }` for partner).
     *
     * It exists because the domain link rows only encode the INVERSE direction
     * and cannot be trusted to survive: `entity_subscriptions` is
     * UNIQUE on `(entity_type, entity_id)` and `partner_subscriptions` on
     * `partner_id`, and both are UPSERTED. Path C creates one subscription per
     * checkout CLICK, so a second click overwrites the only pointer to the
     * first subscription — and if the buyer then completes the FIRST share link
     * (still valid), the activating webhook finds no link row and the listing
     * stays unpublished with a live charge against it. These coordinates are
     * what lets the reconcilers recover that subscription
     * (`recoverCommerceLinkFromSubscriptionMetadata` /
     * `recoverPartnerLinkFromSubscriptionMetadata`).
     *
     * Stored on `metadata` (JSONB) deliberately: no schema migration, and the
     * value is immutable checkout-time context, not mutable state.
     */
    readonly domainMetadata?: Readonly<Record<string, string>>;
    /**
     * Optional domain-specific write executed INSIDE the same transaction as the
     * subscription row and the correlation row.
     *
     * The commerce and partner checkouts each own a link table
     * (`entity_subscriptions` / `partner_subscriptions`) whose row must
     * exist for their reconcilers to find the listing/partner when the webhook
     * later activates the subscription. Writing it after this function returned
     * would leave a window in which a `pending_provider` commerce subscription
     * exists with no link row — an unrecoverable state, since the listing could
     * never be flipped PUBLIC even after the owner pays. Path C creates one such
     * row per CHECKOUT CLICK (not per payment), so that window is entered far
     * more often than the pre-Path-C flow's was.
     *
     * Receives the transaction client plus the id of the subscription row just
     * inserted (which this helper generates, so the caller cannot know it before
     * the call returns). Must not commit or roll back itself; anything it throws
     * aborts the whole transaction, exactly like a failed correlation-row insert.
     */
    readonly writeDomainLinkRow?: (params: {
        readonly tx: DrizzleClient;
        readonly localSubscriptionId: string;
    }) => Promise<void>;
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
        pendingDiscount,
        pendingTrialExtension,
        writeDomainLinkRow,
        domainMetadata,
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
            // HOS-1012: a checkout NEVER opens a trial window. HOS-211 Option B
            // wrote one here from the days the checkout had just asked
            // MercadoPago for; HOS-936 then had to reconcile that promise back
            // against the provider's real `next_payment_date`, because the
            // provider was free to contradict it. Nothing is promised now, so
            // there is nothing to reconcile: these are hard NULLs, not a
            // conditional that happens to evaluate to null. Hospeda's own trial
            // row is opened at the first publish, not here.
            trialStart: null,
            trialEnd: null,
            livemode,
            metadata: {
                source: 'start-paid-share-link',
                createdBy: 'subscription-flow',
                intendedInterval: billingInterval,
                priceId,
                mpPreapprovalPlanId,
                // HOS-1012: no `trialGranted` key. It could only ever read
                // `'false'` now, and a metadata key that carries one constant is
                // noise a reader has to disprove.
                // Spread LAST so the domain coordinates are unmistakably part of
                // the same immutable checkout snapshot; absent entirely when the
                // caller has no domain entity (the accommodation path).
                ...(domainMetadata ?? {})
            }
        });

        // 2. Stamp product_domain via a typed UPDATE — mirrors the commerce
        //    flow's and the comp flow's identical two-step stamp.
        await tx
            .update(billingSubscriptions)
            .set({ productDomain })
            .where(eq(billingSubscriptions.id, localSubscriptionId));

        // 3. Retire this customer's earlier in-flight checkouts for the SAME
        //    MercadoPago plan (HOS-276 follow-up), inside the same transaction
        //    so two live correlation rows for one pair can never coexist.
        //
        //    Why here and not in the linker: the webhook fallback (Tier 3) can
        //    only tell candidates apart by `mp_preapproval_plan_id` + payer
        //    email + a 24h window, and a customer who retries after a declined
        //    card produces rows identical on all three. Tier 3 then refuses to
        //    guess and a genuinely approved payment is left with nowhere to
        //    land — measured in staging on 2026-08-29, where two rival rows
        //    were refused 6ms apart and a $35.000 charge went unrecorded. The
        //    ambiguity is removed at the source instead of taught to the
        //    heuristic.
        //
        //    TRADEOFF, deliberate: if the superseded attempt had ALREADY been
        //    paid and its webhook is still in flight, that payment now links to
        //    this newer subscription (same customer, same plan, same price)
        //    rather than to the attempt it was made against. Cross-customer
        //    mislinking remains impossible — the ownership guard still checks
        //    plan and payer. Landing a real payment on the customer's current
        //    subscription is strictly better than the previous behaviour, which
        //    dropped it entirely.
        const superseded = await billingPendingCheckoutModel.supersedePendingForCustomerPlan(
            { customerId, mpPreapprovalPlanId },
            tx
        );
        if (superseded.length > 0) {
            apiLogger.info(
                {
                    customerId,
                    mpPreapprovalPlanId,
                    localSubscriptionId,
                    supersededCheckoutIds: superseded.map((row) => row.id)
                },
                'HOS-276: superseded earlier in-flight checkouts for this customer+plan so the webhook fallback keeps a single candidate'
            );
        }

        // 4. Insert the correlation row, INSIDE the same transaction so the
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
                ...(payerEmail ? { payerEmail } : {}),
                ...(pendingDiscount ? { pendingDiscount } : {}),
                ...(pendingTrialExtension ? { pendingTrialExtension } : {}),
                status: 'pending',
                expiresAt
            },
            tx
        );

        // 5. Domain-specific link row (commerce listing / partner), inside the
        //    SAME transaction — see `writeDomainLinkRow`'s JSDoc for why it
        //    cannot be written after this function returns.
        await writeDomainLinkRow?.({ tx, localSubscriptionId });
    });

    apiLogger.info(
        { localSubscriptionId, customerId, planId, billingInterval, mpPreapprovalPlanId },
        'HOS-191: materialized pending_provider subscription for share-link checkout'
    );

    return { localSubscriptionId, nonce, expiresAt: expiresAt.toISOString() };
}
