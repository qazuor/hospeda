/**
 * Preapproval-to-local-subscription linking (HOS-191 Path C, F2/F3).
 *
 * Path C's `/start-paid` never creates the MercadoPago preapproval server-side —
 * it redirects the browser to MercadoPago's hosted share link for a
 * `preapproval_plan` and materializes a `pending_provider` local subscription
 * plus a `billing_pending_checkouts` correlation row (see
 * `pending-provider-subscription-create.ts`). This module is the SINGLE place
 * that reconciles the real preapproval id MercadoPago eventually creates back
 * to that local subscription, called from two independent triggers:
 *
 * - **F2** — the `back_url` redirect handler (`routes/billing/link-preapproval.ts`),
 *   when the customer's browser returns from MercadoPago's hosted checkout.
 * - **F3** — the `subscription_preapproval` webhook fallback
 *   (`routes/webhooks/mercadopago/subscription-logic.ts`), which fires
 *   server-to-server regardless of whether the browser ever comes back.
 *
 * ## Correlation model
 *
 * The MercadoPago preapproval's `external_reference` is set to the pending
 * checkout's anti-IDOR `nonce` (opaque, unique, never the local subscription id
 * or customer id). Three ways this function resolves the target
 * `billing_pending_checkouts` row, in priority order:
 *
 * 1. **Ownership-verified** (`expectedLocalSubscriptionId` + `expectedCustomerId`,
 *    the F2 back_url path) — the front-end already knows which local
 *    subscription this is; we just verify the caller actually owns it.
 * 2. **Exact match by nonce** (`externalReference`, the F3 webhook path when
 *    F2 already ran and set it) — high confidence, no heuristics.
 * 3. **Heuristic reconciliation** (the F3 webhook path when F2 never ran) —
 *    narrows `billing_pending_checkouts` candidates by the preapproval's MP
 *    plan id + payer email within a time window. Exactly one candidate is
 *    accepted; zero or multiple is refused (never guess) and reported for
 *    manual follow-up.
 *
 * ## Idempotency
 *
 * The whole operation is a compare-and-set on `billing_subscriptions.mp_subscription_id`:
 * if a subscription already carries this preapproval id, every call (F2, F3, or
 * a retried webhook delivery) short-circuits to `'already'` with no further writes.
 *
 * @module services/billing/link-preapproval
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import {
    and,
    billingPendingCheckoutModel,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { getPromoCodeById, withServiceTransaction } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { fetchPreapprovalPlanId } from '../../utils/mp-preapproval-plan-lookup.js';
import { applySignupDiscountToMonthly } from '../subscription-discount-signup.service.js';

/**
 * How far back (from "now") the heuristic (Tier 3) reconciliation path
 * considers a `pending` `billing_pending_checkouts` row a plausible
 * candidate. Bounded to roughly a day, combined with a positive payer-email
 * match, as a wide safety net for the one resolution path with no
 * unforgeable identity signal to trust.
 *
 * This is intentionally NOT the same staleness policy as the other two
 * tiers — the three resolution tiers use asymmetric bounds on purpose:
 *
 * - **Tier 1** (`findByLocalSubscriptionId`, ownership-verified) bounds by
 *   `expiresAt`: `localSubscriptionId` comes from the CLIENT's
 *   `sessionStorage`, which can be arbitrarily old, so a hard TTL guard is
 *   the correct safety valve.
 * - **Tier 2** (`findByNonce`, exact nonce match) has NO `expiresAt` bound at
 *   all: the nonce is only reachable there once already stamped on the live
 *   preapproval by a prior Tier-1-verified attempt, so the match itself is
 *   proof of identity — bounding it by `expiresAt` would strand an
 *   already-verified payment (e.g. a late webhook redelivery) as
 *   `not_found` for no security benefit.
 * - **Tier 3** (`findReconcileCandidates`, this window) has no nonce or
 *   client-asserted id to lean on at all, so `RECONCILE_WINDOW_MS` plus a
 *   positive email match are the only signals — deliberately the loosest of
 *   the three, and the only one actually described as a time "window".
 */
const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Outcome discriminant for {@link linkPreapprovalToLocalSub}.
 *
 * - `'linked'` — a NEW link was just written (ownership-verified or exact-nonce
 *   match), including the heuristic reconciliation path when it resolved to
 *   exactly one candidate.
 * - `'already'` — the preapproval was already linked (idempotent replay), or a
 *   concurrent caller won a compare-and-set race for the same preapproval.
 * - `'idor'` — the caller does not own the resolved pending checkout; the live
 *   preapproval's `external_reference` already belongs to a DIFFERENT
 *   correlation row; or the live preapproval fails the ownership guard (its
 *   MercadoPago plan or payer email does not match the resolved checkout, FIX
 *   A). Never overwrites someone else's linking.
 * - `'reconcile_assisted'` — the heuristic path found zero or multiple
 *   candidates, a single heuristic candidate failed the payer-email ownership
 *   check, OR a user-facing (Tier 1 back_url) attempt could NOT positively
 *   verify the payer identity (the live preapproval exposed no payer email, or
 *   the checkout's snapshotted payer email is unset). Refused, not accused;
 *   flagged for manual follow-up (recoverable — no money linked to the wrong
 *   subscription).
 * - `'not_found'` — no pending checkout could be resolved at all (unknown
 *   `localSubscriptionId`, unknown nonce).
 */
export type LinkPreapprovalOutcome =
    | 'linked'
    | 'already'
    | 'idor'
    | 'reconcile_assisted'
    | 'not_found';

/**
 * Result of {@link linkPreapprovalToLocalSub}.
 */
export interface LinkPreapprovalResult {
    readonly outcome: LinkPreapprovalOutcome;
    /** Present for `'linked'` and `'already'` — the linked local subscription id. */
    readonly localSubscriptionId?: string;
}

/**
 * Input for {@link linkPreapprovalToLocalSub}.
 */
export interface LinkPreapprovalInput {
    /** The real MercadoPago preapproval id. */
    readonly preapprovalId: string;
    /**
     * The preapproval's `external_reference` as already known by the caller
     * (from its own `retrieve()` call, or from the webhook-reported payload).
     * `null` when unset. Used to pick the resolution path (see module JSDoc);
     * a FRESH retrieve is still performed internally for the final IDOR guard
     * (TOCTOU-safe — this value may be stale by the time we write).
     */
    readonly externalReference: string | null;
    /** The preapproval's payer email, if known. Narrows the heuristic reconciliation path. */
    readonly payerEmail: string | null;
    /**
     * Present on the F2 `back_url` path: the local subscription id the
     * front-end already knows. Triggers the ownership-verified resolution
     * path (ignored — and superseded by nonce/heuristic resolution — when absent). */
    readonly expectedLocalSubscriptionId?: string;
    /**
     * Present on the F2 `back_url` path: the billing customer id of the
     * authenticated caller. Required to guard the ownership-verified path
     * against IDOR (a caller quoting someone else's `localSubscriptionId`).
     */
    readonly expectedCustomerId?: string;
    readonly billing: QZPayBilling;
    readonly adapter: QZPayMercadoPagoAdapter;
    /**
     * Drizzle client override for the non-transactional reads/writes (the
     * idempotency check and the deferred-discount livemode lookup). Defaults
     * to `getDb()`. Does NOT affect the compare-and-set write in step 5 —
     * that always runs inside its own `withServiceTransaction` boundary; mock
     * `withServiceTransaction` itself in tests that need to control it.
     */
    readonly db?: DrizzleClient;
}

/** Shape of the pending-checkout row this module actually reads. */
type PendingCheckoutRow = Awaited<ReturnType<typeof billingPendingCheckoutModel.findByNonce>>;

/**
 * Resolve the target `billing_pending_checkouts` row for a linking attempt.
 *
 * Encapsulates the three-tier resolution priority described in the module
 * JSDoc. Returns a discriminated result so the caller can branch on outcome
 * without a pile of nested conditionals.
 *
 * @internal
 */
async function resolvePendingCheckout(params: {
    readonly preapprovalId: string;
    readonly externalReference: string | null;
    readonly payerEmail: string | null;
    readonly expectedLocalSubscriptionId?: string;
    readonly expectedCustomerId?: string;
}): Promise<
    | { readonly kind: 'idor' }
    | { readonly kind: 'not_found' }
    | { readonly kind: 'reconcile_assisted' }
    | {
          readonly kind: 'found';
          readonly checkout: NonNullable<PendingCheckoutRow>;
          readonly viaHeuristic: boolean;
          /**
           * The preapproval's MercadoPago `preapproval_plan_id` when it was
           * already fetched to resolve the candidate (Tier 3 heuristic path).
           * Reused by the ownership guard so it never re-fetches the same field.
           */
          readonly resolvedPreapprovalPlanId?: string;
      }
> {
    const {
        preapprovalId,
        externalReference,
        payerEmail,
        expectedLocalSubscriptionId,
        expectedCustomerId
    } = params;

    // Tier 1: ownership-verified (F2 back_url path).
    if (expectedLocalSubscriptionId) {
        const checkout = await billingPendingCheckoutModel.findByLocalSubscriptionId({
            localSubscriptionId: expectedLocalSubscriptionId
        });
        if (!checkout) {
            return { kind: 'not_found' };
        }
        if (checkout.customerId !== expectedCustomerId) {
            apiLogger.error(
                {
                    preapprovalId,
                    expectedLocalSubscriptionId,
                    expectedCustomerId,
                    actualCustomerId: checkout.customerId
                },
                'HOS-191 link-preapproval: caller does not own the pending checkout it quoted — refusing (possible IDOR)'
            );
            Sentry.captureException(
                new Error(
                    'HOS-191 link-preapproval: ownership mismatch on expectedLocalSubscriptionId'
                ),
                {
                    extra: { preapprovalId, expectedLocalSubscriptionId, expectedCustomerId }
                }
            );
            return { kind: 'idor' };
        }
        return { kind: 'found', checkout, viaHeuristic: false };
    }

    // Tier 2: exact match by nonce (F3 webhook path, F2 already ran).
    if (externalReference) {
        const checkout = await billingPendingCheckoutModel.findByNonce({
            nonce: externalReference
        });
        if (!checkout) {
            return { kind: 'not_found' };
        }
        return { kind: 'found', checkout, viaHeuristic: false };
    }

    // Tier 3: heuristic reconciliation (F3 webhook path, F2 never ran).
    const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        apiLogger.error(
            { preapprovalId },
            'HOS-191 link-preapproval: HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN not configured — cannot resolve preapproval_plan_id for reconciliation'
        );
        return { kind: 'not_found' };
    }

    const planLookup = await fetchPreapprovalPlanId({ preapprovalId, accessToken });
    if (planLookup.kind !== 'ok' || !planLookup.preapprovalPlanId) {
        apiLogger.warn(
            { preapprovalId, lookup: planLookup },
            'HOS-191 link-preapproval: could not resolve preapproval_plan_id — cannot attempt heuristic reconciliation'
        );
        return { kind: 'not_found' };
    }

    const since = new Date(Date.now() - RECONCILE_WINDOW_MS);
    const candidates = await billingPendingCheckoutModel.findReconcileCandidates({
        mpPreapprovalPlanId: planLookup.preapprovalPlanId,
        ...(payerEmail ? { payerEmail } : {}),
        since
    });

    if (candidates.length !== 1) {
        apiLogger.warn(
            {
                preapprovalId,
                mpPreapprovalPlanId: planLookup.preapprovalPlanId,
                payerEmail,
                candidateCount: candidates.length
            },
            'HOS-191 link-preapproval: heuristic reconciliation found zero or multiple candidates — refusing to guess'
        );
        Sentry.captureException(
            new Error(
                `HOS-191 link-preapproval: ambiguous reconciliation (${candidates.length} candidates)`
            ),
            {
                extra: {
                    preapprovalId,
                    mpPreapprovalPlanId: planLookup.preapprovalPlanId,
                    payerEmail
                }
            }
        );
        for (const candidate of candidates) {
            await billingPendingCheckoutModel.markReconcileAssisted({ id: candidate.id });
        }
        return { kind: 'reconcile_assisted' };
    }

    const [candidate] = candidates;
    if (!candidate) {
        // Unreachable: length === 1 checked above. Narrow without a non-null
        // assertion to keep the file free of `noNonNullAssertion` suppressions.
        return { kind: 'reconcile_assisted' };
    }
    return {
        kind: 'found',
        checkout: candidate,
        viaHeuristic: true,
        resolvedPreapprovalPlanId: planLookup.preapprovalPlanId
    };
}

/**
 * Case-insensitive, whitespace-trimmed email equality. Both operands must be
 * present; a missing operand is never a match.
 *
 * @internal
 */
function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) {
        return false;
    }
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Extract a Postgres SQLSTATE from an unknown thrown value. Drizzle wraps the
 * driver error, so the structured `code` lives on `.cause.code` (or directly on
 * `.code` on older builds) — mirrors the detection in the MercadoPago webhook
 * `event-handler.ts`.
 *
 * @internal
 */
function getPgErrorCode(err: unknown): string | undefined {
    return (
        (err as { cause?: { code?: string }; code?: string }).cause?.code ??
        (err as { code?: string }).code
    );
}

/**
 * The resolution tier a linking attempt reached. Governs how strictly the
 * ownership guard treats the payer-email signal.
 *
 * - `'ownership'` — Tier 1, the F2 `back_url` handler. The caller controls the
 *   `preapprovalId` in the request body, so this is where an attacker lives:
 *   email identity MUST be positively proven (fail-closed).
 * - `'nonce'` — Tier 2, the F3 webhook when F2 already stamped the
 *   `external_reference`. The nonce is an unforgeable server-side secret that
 *   only an already-email-verified Tier 1 could have set, so the nonce match
 *   itself binds identity; email is a corroborating negative only.
 * - `'heuristic'` — Tier 3, the F3 webhook with no nonce yet. Email is the
 *   primary discriminant; a mismatch or absence refuses without accusing.
 *
 * @internal
 */
type OwnershipTier = 'ownership' | 'nonce' | 'heuristic';

/**
 * Ownership guard for a FRESH preapproval (HOS-191 FIX A, hardened by FIX 1).
 *
 * The `external_reference` mismatch check in {@link linkPreapprovalToLocalSub}
 * only catches a preapproval that ALREADY carries someone else's nonce. When
 * the live preapproval has NO `external_reference` yet (about to be stamped
 * with THIS caller's nonce), nothing else proves the preapproval actually
 * belongs to this checkout — so an authenticated caller could quote a stranger's
 * `preapprovalId` together with their own `localSubscriptionId` and hijack it.
 *
 * The MercadoPago `preapproval_plan_id` is NOT a per-customer secret — every
 * buyer of the same commercial plan/interval/trial shares it, and it travels in
 * the public share-link URL — so a plan match ALONE cannot prove ownership. The
 * **payer email is the identity discriminant**, applied fail-closed and
 * per-tier (see {@link OwnershipTier}):
 *
 * 1. **Plan match (always, when resolvable).** A different plan id is a
 *    different checkout — `idor`. Necessary but NOT sufficient on its own.
 * 2. **Payer-email identity, per tier:**
 *    - **Tier 1 (`ownership`)** requires a POSITIVE email match. A confirmed
 *      mismatch is an active hijack → `idor`. An absent live payer email, or an
 *      absent checkout-snapshot email, means the identity cannot be verified →
 *      `reconcile_assisted` (NEVER a blind link).
 *    - **Tier 3 (`heuristic`)** also requires a positive match, but a mismatch
 *      or absence downgrades to `reconcile_assisted` (refuse, do not accuse).
 *    - **Tier 2 (`nonce`)** trusts the unforgeable nonce: a live-email mismatch
 *      still refuses (`idor`), but an absent/unverifiable email does NOT degrade
 *      the trusted match — the legitimate webhook path is never broken.
 *
 * The comparison email is `checkout.payerEmail` — the snapshot taken at
 * checkout time (`billing_pending_checkouts.payer_email`), NOT a live
 * `billing.customers.get()` lookup (FIX 1). A live lookup reads the
 * customer's CURRENT account email, which can legitimately drift between
 * "customer clicks the share link" and "customer returns from MercadoPago" —
 * e.g. the customer changes their account email mid-checkout. Comparing
 * against a drifted live email would read a perfectly legitimate return as a
 * payer-email mismatch → false-positive `idor` (409) plus a false Sentry
 * "possible IDOR" alert against a real customer. The snapshot is immune to
 * that drift, and is a synchronous field read off the already-resolved
 * `checkout` row — no async lookup, so no lookup-failure mode to fail closed
 * on either.
 *
 * The common legitimate case is safe: a customer returning via `back_url` has an
 * authorized preapproval that carries their own payer email → positive match →
 * link. The rare null-email case falls to `reconcile_assisted`, recoverable
 * with no money linked to the wrong subscription — the correct trade for money.
 *
 * @internal
 */
async function verifyPreapprovalOwnership(params: {
    readonly preapprovalId: string;
    readonly checkout: NonNullable<PendingCheckoutRow>;
    readonly livePayerEmail: string | null;
    readonly tier: OwnershipTier;
    readonly resolvedPreapprovalPlanId?: string;
}): Promise<'ok' | 'idor' | 'reconcile_assisted'> {
    const { preapprovalId, checkout, livePayerEmail, tier, resolvedPreapprovalPlanId } = params;

    // 1. Plan match. Reuse the Tier 3 lookup when present; otherwise fetch once.
    //    A match is necessary but NOT sufficient (the plan id is not a secret) —
    //    only a mismatch is decisive here.
    let preapprovalPlanId = resolvedPreapprovalPlanId;
    if (!preapprovalPlanId) {
        const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
        if (accessToken) {
            const lookup = await fetchPreapprovalPlanId({ preapprovalId, accessToken });
            if (lookup.kind === 'ok' && lookup.preapprovalPlanId) {
                preapprovalPlanId = lookup.preapprovalPlanId;
            }
        }
    }
    if (preapprovalPlanId && preapprovalPlanId !== checkout.mpPreapprovalPlanId) {
        apiLogger.error(
            {
                preapprovalId,
                checkoutMpPreapprovalPlanId: checkout.mpPreapprovalPlanId,
                livePreapprovalPlanId: preapprovalPlanId
            },
            'HOS-191 link-preapproval: live preapproval belongs to a DIFFERENT MercadoPago plan than the resolved checkout — refusing (possible IDOR)'
        );
        Sentry.captureException(
            new Error('HOS-191 link-preapproval: preapproval plan id mismatch'),
            { extra: { preapprovalId, checkoutMpPreapprovalPlanId: checkout.mpPreapprovalPlanId } }
        );
        return 'idor';
    }

    // 2. Payer-email identity. Compare against the CHECKOUT-TIME SNAPSHOT
    //    (`checkout.payerEmail`, see the function JSDoc for why a live
    //    `billing.customers.get()` lookup is the wrong source — email drift
    //    between checkout and return causes a false-positive mismatch). A
    //    synchronous field read: no lookup, so no lookup-failure mode.
    const snapshotEmail = checkout.payerEmail;

    const emailMatches =
        !!livePayerEmail && !!snapshotEmail && emailsMatch(snapshotEmail, livePayerEmail);
    const emailMismatch =
        !!livePayerEmail && !!snapshotEmail && !emailsMatch(snapshotEmail, livePayerEmail);

    // Tier 2 (exact nonce): the unforgeable server-side nonce already bound the
    // identity — only an already-email-verified Tier 1 could have stamped it.
    // A live-email mismatch still refuses; an absent/unverifiable email does not.
    if (tier === 'nonce') {
        if (emailMismatch) {
            apiLogger.error(
                { preapprovalId, customerId: checkout.customerId, tier },
                'HOS-191 link-preapproval: nonce-matched preapproval payer email differs from the checkout customer — refusing (possible IDOR)'
            );
            Sentry.captureException(
                new Error('HOS-191 link-preapproval: payer email mismatch (nonce tier)'),
                { extra: { preapprovalId, customerId: checkout.customerId, tier } }
            );
            return 'idor';
        }
        return 'ok';
    }

    // Tier 1 (ownership / back_url) & Tier 3 (heuristic): a POSITIVE email match
    // is REQUIRED — this is real money on a caller-controlled preapproval id.
    if (emailMatches) {
        return 'ok';
    }

    // No positive match. A confirmed mismatch on the user-facing path is an
    // active hijack → idor. Every other unverifiable case (absent live email,
    // absent checkout snapshot email, or a heuristic mismatch) refuses without
    // accusing → reconcile_assisted, recoverable and money-safe.
    if (emailMismatch && tier === 'ownership') {
        apiLogger.error(
            { preapprovalId, customerId: checkout.customerId, tier },
            'HOS-191 link-preapproval: back_url preapproval payer email differs from the checkout customer — refusing (possible IDOR)'
        );
        Sentry.captureException(
            new Error('HOS-191 link-preapproval: payer email mismatch (ownership tier)'),
            { extra: { preapprovalId, customerId: checkout.customerId, tier } }
        );
        return 'idor';
    }

    apiLogger.warn(
        {
            preapprovalId,
            customerId: checkout.customerId,
            tier,
            hasLivePayerEmail: !!livePayerEmail,
            hasSnapshotPayerEmail: !!snapshotEmail
        },
        'HOS-191 link-preapproval: could not positively verify preapproval payer identity — refusing to link blindly (reconcile_assisted)'
    );
    return 'reconcile_assisted';
}

/**
 * Apply a checkout-time pending discount (SPEC-262) to a just-linked
 * preapproval, best-effort. Never throws and never blocks the linking outcome
 * — a discount-application failure means the customer is (safely) charged
 * full price and the failure is logged loudly for manual reconciliation,
 * matching the FAIL-CLOSED-on-amount-but-never-block-checkout posture used
 * throughout the promo-code system (see `subscription-discount-signup.service.ts`).
 *
 * @internal
 */
async function applyPendingDiscountBestEffort(params: {
    readonly billing: QZPayBilling;
    readonly localSubscriptionId: string;
    readonly preapprovalId: string;
    readonly customerId: string;
    readonly planId: string;
    readonly pendingDiscount: {
        readonly promoCodeId: string;
        readonly finalAmountCentavos: number;
    };
    readonly livemode: boolean;
}): Promise<void> {
    const {
        billing,
        localSubscriptionId,
        preapprovalId,
        customerId,
        planId,
        pendingDiscount,
        livemode
    } = params;

    try {
        // NOTE: `getPromoCodeById`'s inferred return type does not narrow `data`
        // to non-optional after checking `success` (see the same pattern in
        // `payment-logic.ts`'s `resolveActiveDiscountAmount` and
        // `promo-code.trial-extension.ts`) — guard both `success` and `data`/`effect`
        // explicitly via optional chaining rather than a non-null assertion.
        const promoCodeResult = await getPromoCodeById(pendingDiscount.promoCodeId);
        const effect = promoCodeResult.success ? promoCodeResult.data?.effect : undefined;
        if (!promoCodeResult.success || !effect || effect.kind !== 'discount') {
            apiLogger.error(
                { localSubscriptionId, preapprovalId, promoCodeId: pendingDiscount.promoCodeId },
                'HOS-191 link-preapproval: pending discount promo code is no longer resolvable to a valid discount effect — skipping (customer charged full price)'
            );
            return;
        }
        const code = promoCodeResult.data?.code;
        if (!code) {
            apiLogger.error(
                { localSubscriptionId, preapprovalId, promoCodeId: pendingDiscount.promoCodeId },
                'HOS-191 link-preapproval: pending discount promo code resolved with no code string — skipping (customer charged full price)'
            );
            return;
        }

        const plan = await billing.plans.get(planId);
        const monthlyPrice = plan?.prices.find((p) => p.billingInterval === 'month');
        if (!monthlyPrice) {
            apiLogger.error(
                { localSubscriptionId, preapprovalId, planId },
                'HOS-191 link-preapproval: could not resolve full monthly price for pending discount — skipping (customer charged full price)'
            );
            return;
        }

        const result = await applySignupDiscountToMonthly({
            billing,
            subscriptionId: localSubscriptionId,
            mpSubscriptionId: preapprovalId,
            customerId,
            promoCodeId: pendingDiscount.promoCodeId,
            code,
            effect,
            fullPriceCentavos: monthlyPrice.unitAmount,
            livemode
        });

        if (!result.success) {
            apiLogger.error(
                {
                    localSubscriptionId,
                    preapprovalId,
                    error: result.error.message
                },
                'HOS-191 link-preapproval: deferred discount application failed — customer charged full price, needs manual reconcile'
            );
            Sentry.captureException(
                new Error(
                    `HOS-191 link-preapproval: deferred discount apply failed: ${result.error.message}`
                ),
                { extra: { localSubscriptionId, preapprovalId } }
            );
        }
    } catch (err) {
        apiLogger.error(
            {
                localSubscriptionId,
                preapprovalId,
                error: err instanceof Error ? err.message : String(err)
            },
            'HOS-191 link-preapproval: unexpected error applying deferred discount — customer charged full price, needs manual reconcile'
        );
        Sentry.captureException(err, { extra: { localSubscriptionId, preapprovalId } });
    }
}

/**
 * Link a real MercadoPago preapproval to the local `pending_provider`
 * subscription it belongs to. See module JSDoc for the full correlation
 * model and idempotency contract.
 *
 * @param input - See {@link LinkPreapprovalInput}.
 * @returns The linking outcome. Never throws for expected failure modes
 *   (ownership mismatch, ambiguous reconciliation, not found) — those are
 *   all typed outcomes. Genuinely unexpected errors (DB down, etc.) propagate.
 */
export async function linkPreapprovalToLocalSub(
    input: LinkPreapprovalInput
): Promise<LinkPreapprovalResult> {
    const {
        preapprovalId,
        externalReference,
        payerEmail,
        expectedLocalSubscriptionId,
        expectedCustomerId,
        billing,
        adapter,
        db
    } = input;
    const client = db ?? getDb();

    // Step 1: idempotency short-circuit — already linked.
    const [existing] = await client
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.mpSubscriptionId, preapprovalId))
        .limit(1);
    if (existing) {
        return { outcome: 'already', localSubscriptionId: existing.id };
    }

    // Step 2: resolve the target pending-checkout row.
    const resolution = await resolvePendingCheckout({
        preapprovalId,
        externalReference,
        payerEmail,
        expectedLocalSubscriptionId,
        expectedCustomerId
    });
    if (resolution.kind !== 'found') {
        return { outcome: resolution.kind };
    }
    const { checkout, viaHeuristic, resolvedPreapprovalPlanId } = resolution;

    // Step 3: fresh IDOR guard — re-retrieve the LIVE preapproval and refuse to
    // overwrite a DIFFERENT correlation row's linking (TOCTOU-safe: `externalReference`
    // passed in by the caller may be stale by now).
    const live = await adapter.subscriptions.retrieve(preapprovalId);
    if (live.externalReference && live.externalReference !== checkout.nonce) {
        apiLogger.error(
            {
                preapprovalId,
                resolvedNonce: checkout.nonce,
                liveExternalReference: live.externalReference
            },
            'HOS-191 link-preapproval: live preapproval external_reference belongs to a different pending checkout — refusing (possible IDOR)'
        );
        Sentry.captureException(
            new Error('HOS-191 link-preapproval: live external_reference mismatch'),
            { extra: { preapprovalId, resolvedNonce: checkout.nonce } }
        );
        return { outcome: 'idor' };
    }

    // Step 3b: ownership guard (FIX A, hardened by FIX 1). The check above only
    // catches a preapproval already stamped with a FOREIGN nonce. When
    // `externalReference` is still null (the common fresh case, about to be
    // stamped in Step 4), verify the preapproval genuinely belongs to this
    // checkout — the payer email is the fail-closed identity discriminant, since
    // the MercadoPago plan id is shared across every buyer of the same plan and
    // travels in the public share-link URL, so a plan match alone proves nothing.
    // Compared against `checkout.payerEmail` (the checkout-time snapshot), NOT a
    // live customer lookup — see {@link verifyPreapprovalOwnership} JSDoc (FIX 1).
    //
    // Tier is derived from HOW the checkout was resolved: Tier 1 (ownership) when
    // the caller quoted a `localSubscriptionId` (the attacker-reachable back_url
    // path, strictest); Tier 2 (nonce) when an exact nonce match resolved it
    // (trusts the unforgeable nonce); Tier 3 (heuristic) otherwise.
    const tier: OwnershipTier = viaHeuristic
        ? 'heuristic'
        : expectedLocalSubscriptionId
          ? 'ownership'
          : 'nonce';
    const ownership = await verifyPreapprovalOwnership({
        preapprovalId,
        checkout,
        livePayerEmail: live.payerEmail ?? null,
        tier,
        ...(resolvedPreapprovalPlanId ? { resolvedPreapprovalPlanId } : {})
    });
    if (ownership !== 'ok') {
        return { outcome: ownership };
    }

    // Step 4: set external_reference on the live preapproval if not already set.
    if (!live.externalReference) {
        await adapter.subscriptions.update(preapprovalId, { externalReference: checkout.nonce });
    }

    // Step 5: compare-and-set mp_subscription_id (only if still unset — race-safe)
    // and mark the correlation row terminal, atomically. The heuristic path gets
    // its own distinct terminal state (lower-confidence match, worth its own
    // audit trail); exact-identifier paths (ownership-verified or nonce) use the
    // primary 'linked' state.
    //
    // Resurrection (FIX B layer 2): the CAS also flips `status` to
    // `pending_provider`. When the row was abandoned by `abandoned-pending-subs`
    // (a slow Path C checkout the reaper mp-null-abandoned WITHOUT cancelling any
    // preapproval — there was none to cancel), a now-legitimate link (ownership
    // verified in Step 3b, a valid pending checkout resolved in Step 2) must
    // revive it so the subsequent webhook's `pending_provider → active/trialing`
    // is a valid transition. The `inArray` guard restricts resurrection to
    // `pending_provider` (no-op) and `abandoned` (revive) — never a deliberate
    // terminal state like `cancelled`. The CAS is a direct UPDATE (it does NOT go
    // through `checkSubscriptionStatusTransition`), so the flip is safe here.
    let wasLinked: boolean;
    try {
        wasLinked = await withServiceTransaction(async (ctx) => {
            // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
            const tx = ctx.tx!;
            const [updated] = await tx
                .update(billingSubscriptions)
                .set({
                    mpSubscriptionId: preapprovalId,
                    status: SubscriptionStatusEnum.PENDING_PROVIDER,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(billingSubscriptions.id, checkout.localSubscriptionId),
                        isNull(billingSubscriptions.mpSubscriptionId),
                        inArray(billingSubscriptions.status, [
                            SubscriptionStatusEnum.PENDING_PROVIDER,
                            SubscriptionStatusEnum.ABANDONED
                        ])
                    )
                )
                .returning({ id: billingSubscriptions.id });

            if (!updated) {
                return false;
            }

            if (viaHeuristic) {
                await billingPendingCheckoutModel.markReconcileAssisted({ id: checkout.id }, tx);
            } else {
                await billingPendingCheckoutModel.markLinked({ id: checkout.id }, tx);
            }
            return true;
        });
    } catch (err) {
        // FIX C: the partial UNIQUE index on `mp_subscription_id`
        // (`billing_subscriptions_mp_id_uniq`) can reject the CAS when a sibling
        // retry row (same customer, two `pending_provider` attempts) won the same
        // preapproval first. That is a lost race, semantically identical to the
        // `!wasLinked` branch below — surface it as 'already', not a 500.
        if (getPgErrorCode(err) === '23505') {
            apiLogger.warn(
                { preapprovalId, localSubscriptionId: checkout.localSubscriptionId },
                'HOS-191 link-preapproval: unique-violation on mp_subscription_id — a sibling row already claimed this preapproval (treating as already-linked)'
            );
            return { outcome: 'already', localSubscriptionId: checkout.localSubscriptionId };
        }
        throw err;
    }

    if (!wasLinked) {
        // Lost a race against a concurrent linking attempt for the SAME
        // preapproval (F2 and F3 firing near-simultaneously), or the row is no
        // longer in a resurrectable state. Equivalent to 'already' — someone else
        // just finished the exact same write.
        return { outcome: 'already', localSubscriptionId: checkout.localSubscriptionId };
    }

    // Step 6: apply a deferred discount (SPEC-262), best-effort, non-blocking.
    if (checkout.pendingDiscount) {
        // Resolve livemode from the customer row's currently-known context: the
        // pending checkout does not carry livemode directly, but the linked
        // subscription's own `livemode` column (set at creation, see
        // `pending-provider-subscription-create.ts`) is authoritative — read it
        // back rather than re-deriving it.
        const [subRow] = await client
            .select({ livemode: billingSubscriptions.livemode })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, checkout.localSubscriptionId))
            .limit(1);

        await applyPendingDiscountBestEffort({
            billing,
            localSubscriptionId: checkout.localSubscriptionId,
            preapprovalId,
            customerId: checkout.customerId,
            planId: checkout.planId,
            pendingDiscount: checkout.pendingDiscount,
            livemode: subRow?.livemode ?? false
        });
    }

    apiLogger.info(
        { preapprovalId, localSubscriptionId: checkout.localSubscriptionId, viaHeuristic },
        'HOS-191 link-preapproval: linked MercadoPago preapproval to local subscription'
    );

    return { outcome: 'linked', localSubscriptionId: checkout.localSubscriptionId };
}
