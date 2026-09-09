/**
 * Past-due payment-method replacement (HOS-348 Part B).
 *
 * HOS-348 established that a customer whose subscription is `past_due` had
 * no way to fix it: `GET /users/me/subscription` was gated by
 * `pastDueGraceMiddleware` (fixed in Part A), and there was no endpoint at
 * all to actually replace a failing card. This module is that endpoint's
 * business logic.
 *
 * ## Why a NEW preapproval, not a mutation of the old one
 *
 * MercadoPago preapproval DATES are immutable (a `PUT` that tries to change
 * them returns 200 and silently changes nothing — see
 * `docs/billing/grace-period-source-of-truth.md` and the root `CLAUDE.md`
 * "MercadoPago preapproval mutability limits" entry) and there is no MP API
 * to swap the card on an existing preapproval. The only way to change the
 * customer's payment method is a brand-new preapproval — the SAME mechanism
 * `TrialService.reactivateSubscription` (`apps/api/src/services/trial.service.ts`)
 * already uses to reactivate a `canceled` subscription, and the SAME
 * mint-then-defer-cancel pairing `completeSupersessionPairing`
 * (`reactivation-supersession-complete.ts`) already completes once the new
 * preapproval is confirmed. This module reuses BOTH exactly as they stand:
 *
 * - {@link createPaidSubscription} (`paid-subscription-create.ts`) — the
 *   same low-level `mode: 'paid'` preapproval-create helper `/start-paid`
 *   and reactivation both call. No trial field is ever set here (guard G-1,
 *   `scripts/check-no-trial-to-mercadopago.sh`, would fail CI if one were
 *   added) — the customer already used whatever trial they had.
 * - {@link resolveReactivationPlan} (`reactivation-plan-guard.ts`) — resolves
 *   the plan + price to mint against. Unlike reactivation, the caller here
 *   does NOT choose a plan: this is "fix my card for my current plan", not a
 *   plan change, so the route always passes the past-due row's OWN
 *   `planId`.
 * - `metadata.supersedesSubscriptionId` stamped on the new row is read by
 *   `completeReactivationSupersession`
 *   (`routes/webhooks/mercadopago/subscription-logic.ts`) — completely
 *   unmodified — which fires `completeSupersessionPairing` ONLY on the new
 *   row's confirmed `PENDING_PROVIDER -> ACTIVE` webhook transition. THIS is
 *   what enforces the load-bearing invariant: **the old (past-due)
 *   preapproval is cancelled when, and only when, the new one is confirmed
 *   authorized — never at mint time.** If the customer opens the MercadoPago
 *   authorization page and abandons it, nothing here has touched the old
 *   subscription; it stays exactly as past-due as before, still cobrable,
 *   still MP's own problem to keep retrying. Minting is the ONLY thing this
 *   module does; the cancel is entirely the existing webhook's job.
 *
 * ## The unpaid period is forgiven — owner decision, 2026-09-02
 *
 * The new preapproval does **NOT** attempt to collect the period the old one
 * failed to charge, and nothing here records it as a debt to chase later.
 * This was an explicit product decision (not an oversight, and not something
 * discoverable from the code before this comment): the owner's reasoning was
 * that a customer who comes back to fix their card is worth more than one
 * month that already failed seven days of MercadoPago's own dunning. Do
 * NOT "fix" this by wiring a one-time charge for the missed period before
 * activating the new preapproval, and do not read `unpaidPeriodForgiven` in
 * the stamped metadata (below) as a bug — it is the record of that decision.
 *
 * ## The listing pointer — HOS-1287
 *
 * This flow is not accommodation-only, and never was: a gastronomy, experience
 * or partner subscription goes `past_due` the same way and reaches the same
 * endpoint. Until HOS-1287 it minted the replacement without carrying the
 * source row's entity pointer, which was the silent half of the same threat
 * `preapproval-recovery.service.ts` refused outright: the new subscription
 * eventually confirms, `completeSupersessionPairing` cancels the old
 * preapproval, and the listing's `entity_subscriptions` /
 * `partner_subscriptions` row is still pointing at the CANCELLED subscription.
 * A paying customer, a dark listing, nothing thrown, nothing logged.
 *
 * The fix is the pointer and ONLY the pointer:
 * {@link domainMetadataForCarryForward} merges the coordinates onto the new
 * row's own `metadata`, and the reconcilers' existing
 * `recoverCommerceLinkFromSubscriptionMetadata` /
 * `recoverPartnerLinkFromSubscriptionMetadata` re-point the bridge row when the
 * new subscription actually goes live. Writing the bridge row HERE, at mint
 * time, would be the opposite of this module's whole invariant: it would hand
 * the listing to a `pending_provider` row and unpublish it while the old
 * preapproval is still the one being charged — and if the customer then
 * abandons MercadoPago's authorization page, it would stay unpublished.
 *
 * A domain whose price is not derivable from its plan (`addon`, which borrows a
 * plan's price row and states its real amount as an override) refuses with
 * `DOMAIN_NOT_REPLACEABLE` rather than minting at the borrowed price.
 *
 * ## Idempotency
 *
 * Two independent layers, matching the two idempotency patterns that already
 * exist elsewhere in billing:
 *
 * 1. **Request-level** — the route mounts `idempotencyKeyMiddleware`
 *    (`middlewares/idempotency-key.ts`), the same `X-Idempotency-Key` header
 *    contract `/start-paid` uses. A retried request with the SAME key and
 *    body replays the cached response with no new side effect.
 * 2. **Business-level** — {@link findReusableReplacementAttempt} below,
 *    adapted from `decideOwnPreapprovalReuse`
 *    (`checkout-idempotency.ts`, HOS-937 step 4): before minting, look for
 *    an already-in-flight `pending_provider` row whose own metadata carries
 *    `supersedesSubscriptionId` pointing at the SAME past-due subscription,
 *    created within the reuse window, and hand back its stored
 *    `checkoutUrl` instead of minting a second preapproval. This is the
 *    guard against a click that arrives with a DIFFERENT idempotency key
 *    (a fresh page load, a retried request the client didn't dedupe) — the
 *    request-level cache alone cannot catch that case.
 *
 * @module services/billing/past-due-payment-method-replacement
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { and, billingSubscriptions, type DrizzleClient, eq, getDb, gte, sql } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import { OWN_PREAPPROVAL_REUSE_WINDOW_MS } from './checkout-idempotency.js';
import { createPaidSubscription } from './paid-subscription-create.js';
import { resolveReactivationPlan } from './reactivation-plan-guard.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';
import {
    domainMetadataForCarryForward,
    resolveSubscriptionDomainCarryForward,
    type SubscriptionDomainCarryForward,
    SubscriptionDomainCarryForwardError
} from './subscription-domain-carry-forward.js';

/**
 * Metadata key stamped `'true'` on the NEW subscription row, read back by
 * `completeReactivationSupersession` (`subscription-logic.ts`) to pick the
 * `'payment-method-replacement'` triggerSource instead of
 * `'subscription-reactivation'` — see that module for the audit-trail
 * distinction.
 */
export const PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY =
    'pastDuePaymentMethodReplacement' as const;

/**
 * Reuse window for an in-flight replacement attempt. Same value as
 * `OWN_PREAPPROVAL_REUSE_WINDOW_MS` (`checkout-idempotency.ts`) and same
 * rationale (a slow card-first checkout: 3DS/OTP, a bank app hand-off,
 * walking away and coming back).
 *
 * HOS-1272: now IMPORTED rather than re-declared — this constant used to
 * duplicate `3 * 60 * 60 * 1000` independently (reasoning: that module is
 * "scoped to the commerce/partner bridge-table flows this replacement has no
 * bridge table for"), but the NUMBER has no such scoping, only the reuse
 * FUNCTIONS do — this was one of several places the same window ended up
 * declared separately. Kept as its own exported name (this module already
 * has its own callers), only its source changed.
 */
const REPLACEMENT_REUSE_WINDOW_MS = OWN_PREAPPROVAL_REUSE_WINDOW_MS;

/**
 * The past-due subscription row this module needs, already validated by the
 * caller (route) — see {@link ReplacePastDuePaymentMethodInput}.
 */
export interface PastDueSubscriptionForReplacement {
    /** `billing_subscriptions.id` of the past-due row. */
    readonly id: string;
    /** `billing_subscriptions.plan_id` — the plan to mint the replacement against. */
    readonly planId: string;
    /**
     * `billing_subscriptions.product_domain` of the past-due row. REQUIRED, and
     * required together with {@link metadata} (HOS-1287): a replacement that
     * does not know which vertical it is replacing cannot carry that vertical's
     * entity pointer, and the compiler asking every call site for it is what
     * stops the next one from omitting it silently.
     *
     * `null` is accepted and means accommodation — the column post-dates most
     * rows, so absence fails OPEN there exactly as `subscriptionMatchesDomain`
     * documents.
     */
    readonly productDomain: string | null;
    /**
     * `billing_subscriptions.metadata` of the past-due row — where the commerce
     * / partner entity pointer was stamped at checkout. See {@link productDomain}.
     */
    readonly metadata: unknown;
}

/** Input for {@link replacePastDuePaymentMethod}. */
export interface ReplacePastDuePaymentMethodInput {
    readonly billing: QZPayBilling;
    /** Billing customer id (the SAME customer that owns the past-due row). */
    readonly customerId: string;
    /** The already-validated past-due row (status/ownership/interval checked by the route). */
    readonly pastDueSubscription: PastDueSubscriptionForReplacement;
    /** MercadoPago `back_url` for the new preapproval. */
    readonly paymentMethodReturnUrl: string;
    /** Webhook destination for the new preapproval. */
    readonly notificationUrl: string;
    /** Drizzle client override (tests). Defaults to `getDb()`. */
    readonly db?: DrizzleClient;
}

/** Result of {@link replacePastDuePaymentMethod}. */
export interface ReplacePastDuePaymentMethodResult {
    /** The new (not-yet-confirmed) local subscription id. */
    readonly localSubscriptionId: string;
    /** MercadoPago checkout URL the caller must redirect the user to. */
    readonly checkoutUrl: string;
    /** `true` when an in-flight attempt was reused instead of minting a fresh one. */
    readonly reused: boolean;
}

/**
 * Looks for an already-in-flight replacement attempt for this exact
 * past-due row: a `pending_provider` subscription, owned by the same
 * customer, whose `metadata.supersedesSubscriptionId` points at
 * `pastDueSubscriptionId`, created within {@link REPLACEMENT_REUSE_WINDOW_MS}.
 *
 * Adapted from `decideOwnPreapprovalReuse` (`checkout-idempotency.ts`) — same
 * freshness/identity conditions, keyed off `supersedesSubscriptionId`
 * instead of a commerce/partner bridge row (this flow has none).
 *
 * @returns The reusable `{localSubscriptionId, checkoutUrl}`, or `null` when
 *   a fresh preapproval must be minted.
 */
async function findReusableReplacementAttempt(input: {
    readonly db: DrizzleClient;
    readonly customerId: string;
    readonly pastDueSubscriptionId: string;
}): Promise<{ readonly localSubscriptionId: string; readonly checkoutUrl: string } | null> {
    const cutoff = new Date(Date.now() - REPLACEMENT_REUSE_WINDOW_MS);

    const rows = await input.db
        .select({
            id: billingSubscriptions.id,
            metadata: billingSubscriptions.metadata,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, input.customerId),
                eq(billingSubscriptions.status, SubscriptionStatusEnum.PENDING_PROVIDER),
                sql`${billingSubscriptions.metadata}->>'supersedesSubscriptionId' = ${input.pastDueSubscriptionId}`,
                gte(billingSubscriptions.createdAt, cutoff)
            )
        )
        .orderBy(sql`${billingSubscriptions.createdAt} desc`)
        .limit(1);

    const row = rows[0];
    if (!row) {
        return null;
    }

    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const checkoutUrl = typeof metadata.checkoutUrl === 'string' ? metadata.checkoutUrl : null;
    if (!checkoutUrl) {
        // Row exists (mint started) but never got as far as the checkoutUrl
        // stamp below — treat as not-yet-reusable rather than hand back an
        // empty URL; the caller mints a fresh attempt instead.
        return null;
    }

    return { localSubscriptionId: row.id, checkoutUrl };
}

/**
 * Mint a replacement MercadoPago preapproval for a `past_due` subscription's
 * OWN current plan, and stamp it so the existing reactivation-supersession
 * machinery cancels the old preapproval once — and only once — the new one
 * is confirmed authorized.
 *
 * Does NOT touch the old (past-due) subscription in any way: no cancel, no
 * status write. See the module JSDoc for why that is the whole point.
 *
 * @param input - Billing client, customer + past-due row, and checkout URLs.
 * @returns The new subscription id and its checkout URL (freshly minted or
 *   reused from an in-flight attempt).
 * @throws SubscriptionCheckoutError From {@link resolveReactivationPlan}
 *   (`PLAN_NOT_FOUND`, `ANNUAL_REACTIVATION_UNSUPPORTED`,
 *   `INVALID_REACTIVATION_PLAN`) or {@link createPaidSubscription}
 *   (`MISSING_INIT_POINT`, `MISSING_PROVIDER_SUBSCRIPTION_ID`); and
 *   `DOMAIN_NOT_REPLACEABLE` (HOS-1287, → 422) when the past-due row's product
 *   domain cannot be carried onto a fresh preapproval — see the module JSDoc's
 *   "the listing pointer" section.
 */
export async function replacePastDuePaymentMethod(
    input: ReplacePastDuePaymentMethodInput
): Promise<ReplacePastDuePaymentMethodResult> {
    const db = input.db ?? getDb();
    const { billing, customerId, pastDueSubscription, paymentMethodReturnUrl, notificationUrl } =
        input;

    const reusable = await findReusableReplacementAttempt({
        db,
        customerId,
        pastDueSubscriptionId: pastDueSubscription.id
    });
    if (reusable) {
        apiLogger.info(
            {
                customerId,
                pastDueSubscriptionId: pastDueSubscription.id,
                localSubscriptionId: reusable.localSubscriptionId
            },
            'HOS-348: reusing an in-flight payment-method replacement instead of minting a second preapproval'
        );
        return { ...reusable, reused: true };
    }

    // HOS-1287: which vertical is being replaced, and where its listing is.
    // Resolved BEFORE anything is minted, so a domain this flow cannot
    // faithfully reproduce refuses instead of minting a preapproval that would
    // then have to be cleaned up.
    let carryForward: SubscriptionDomainCarryForward;
    try {
        carryForward = resolveSubscriptionDomainCarryForward({
            productDomain: pastDueSubscription.productDomain,
            metadata: pastDueSubscription.metadata,
            context: `HOS-348 replacement: subscription ${pastDueSubscription.id}`
        });
    } catch (error) {
        if (error instanceof SubscriptionDomainCarryForwardError) {
            throw new SubscriptionCheckoutError('DOMAIN_NOT_REPLACEABLE', error.message);
        }
        throw error;
    }

    // "Fix my card for my current plan", not a plan change — the plan is
    // always the past-due row's own, never caller-supplied.
    const { plan, priceId } = await resolveReactivationPlan({
        billing,
        planId: pastDueSubscription.planId,
        billingInterval: 'monthly'
    });

    const { subscription, checkoutUrl } = await createPaidSubscription({
        billing,
        customerId,
        planId: plan.id,
        priceId,
        paymentMethodReturnUrl,
        notificationUrl,
        metadata: {
            supersedesSubscriptionId: pastDueSubscription.id,
            [PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY]: 'true',
            replacedAt: new Date().toISOString(),
            previousPlanId: pastDueSubscription.planId,
            // HOS-1287: the SUBSCRIPTION → ENTITY pointer, carried onto the
            // replacement row. The pointer ONLY — no bridge-row write here, see
            // the module JSDoc's "the listing pointer" section for why writing
            // one at mint time would unpublish a listing that is still being
            // paid for under the old preapproval. Empty for a domain that owns
            // no listing (accommodation, tourist).
            ...domainMetadataForCarryForward(carryForward),
            // HOS-348 (owner decision, 2026-09-02): the unpaid period on the
            // superseded past-due subscription is deliberately NOT charged
            // through this new preapproval and is NOT tracked as a debt to
            // collect later — see the module JSDoc "unpaid period is
            // forgiven" section before changing this.
            unpaidPeriodForgiven: 'true'
        }
    });

    // Stamp checkoutUrl onto the new row's own metadata so a LATER call
    // (a different idempotency key, e.g. a fresh page load) can find and
    // reuse this same in-flight attempt via findReusableReplacementAttempt
    // above, instead of minting a second preapproval. Mirrors the identical
    // stamp `own-preapproval-subscription-create.ts` performs for the same
    // reason (HOS-937 step 4) — `createPaidSubscription` itself never writes
    // this, only the caller.
    await db
        .update(billingSubscriptions)
        .set({
            metadata: sql`jsonb_set(coalesce(${billingSubscriptions.metadata}, '{}'::jsonb), '{checkoutUrl}', to_jsonb(${checkoutUrl}::text))`
        })
        .where(eq(billingSubscriptions.id, subscription.id));

    apiLogger.info(
        {
            customerId,
            pastDueSubscriptionId: pastDueSubscription.id,
            newSubscriptionId: subscription.id
        },
        'HOS-348: minted a replacement preapproval for a past-due subscription — the old preapproval is untouched until the new one confirms authorized'
    );

    return { localSubscriptionId: subscription.id, checkoutUrl, reused: false };
}
