/**
 * Shared checkout error type for the paid-subscription create contract
 * (HOS-114 T-002).
 *
 * Lives in its own module — separate from both
 * `subscription-checkout.service.ts` and `billing/paid-subscription-create.ts`
 * — purely to avoid a circular ESM import: `subscription-checkout.service.ts`
 * already imports `TrialService` (`trial.service.ts`), and starting HOS-114
 * T-004+ `trial.service.ts` imports `billing/paid-subscription-create.ts` to
 * reuse the paid-create helper. If the error type lived in either of those
 * two files, the other would have to import it back, creating a cycle.
 * Both files import this sibling module instead; `subscription-checkout.service.ts`
 * re-exports both symbols so every existing importer of
 * `SubscriptionCheckoutError` / `SubscriptionCheckoutErrorCode` from that
 * file keeps working unchanged.
 *
 * @module services/billing/subscription-checkout-error
 */

/**
 * Error codes surfaced by the paid-subscription checkout and reactivation
 * flows. Each value maps to a distinct user-facing condition; route
 * handlers translate them to HTTP status codes.
 */
export type SubscriptionCheckoutErrorCode =
    | 'PLAN_NOT_FOUND'
    | 'NO_MONTHLY_PRICE'
    | 'NO_ANNUAL_PRICE'
    | 'NO_MATCHING_PRICE'
    | 'CUSTOMER_NOT_FOUND'
    | 'MISSING_INIT_POINT'
    // HOS-151 Bug C: MercadoPago returned a 2xx preapproval response with NO
    // provider subscription id (`providerSubscriptionIds.mercadopago` empty or
    // absent). Persisting such a row is unrecoverable — the webhook lookup
    // (`eq(mpSubscriptionId, preapprovalId)`) never matches `''`, so the sub can
    // never activate and its preapproval can never be located to cancel. The
    // create fails loudly (after cleaning up the just-created local row) so the
    // checkout surfaces a retryable error instead of a silent orphan. Maps to
    // HTTP 502 (provider returned an unusable response).
    | 'MISSING_PROVIDER_SUBSCRIPTION_ID'
    | 'INVALID_PROMO_CODE'
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'SAME_PLAN'
    | 'NOT_AN_UPGRADE'
    // SPEC-262 T-012 P2: the FAIL-CLOSED discount mutation was rejected by MP and
    // the just-created subscription was cancelled. Maps to HTTP 502 (provider
    // rejected our amount change) — distinct from INVALID_PROMO_CODE (422) which
    // is a bad/inactive code, not a provider failure.
    | 'DISCOUNT_APPLY_FAILED'
    // HOS-114 T-004: the reactivation plan-resolution guard
    // (`billing/reactivation-plan-guard.ts`) rejects a `planId` that resolves
    // to a free plan (e.g. TOURIST_FREE_PLAN) — reactivation is only
    // meaningful onto a paid plan.
    | 'INVALID_REACTIVATION_PLAN'
    // HOS-114 T-004: the reactivation plan-resolution guard rejects a
    // monthly reactivation request (`billingInterval` omitted or `'monthly'`)
    // against a plan with no active monthly price (e.g. an annual-only
    // plan). Annual reactivation itself IS supported (HOS-123 T-003) via
    // `billingInterval: 'annual'` — this code covers only the mismatched
    // monthly request against such a plan.
    | 'ANNUAL_REACTIVATION_UNSUPPORTED'
    // HOS-114 T-015b: `TrialService.reactivateSubscription` rejects a
    // reactivation attempt when the customer already has an `active` or
    // `trialing` subscription — plan-change is the correct flow for that
    // case, not reactivation. Previously surfaced as a plain `Error` (HTTP
    // 500); now a typed, mappable business error (HTTP 409 — conflict with
    // existing subscription state).
    | 'ACTIVE_SUBSCRIPTION_EXISTS'
    // HOS-114 T-015b: `TrialService.reactivateSubscription` rejects a
    // reactivation attempt when the customer has no `canceled` subscription
    // to reactivate from. Previously surfaced as a plain `Error` (HTTP 500);
    // now a typed, mappable business error (HTTP 404 — nothing to reactivate).
    | 'NO_CANCELED_SUBSCRIPTION'
    // HOS-191: the MercadoPago `preapproval_plan` for this checkout's trial-day
    // variant could not be resolved or provisioned — the payment adapter was
    // unavailable, or the `prices.create` / registry write failed. Card-first
    // checkout cannot proceed without a plan to subscribe against. Maps to HTTP
    // 502 (provider/registry could not produce a usable plan).
    | 'MP_PLAN_PROVISIONING_FAILED'
    // HOS-211: the trial-time plan-upgrade flow (`applyTrialingPlanUpgrade`)
    // mutates the live MercadoPago preapproval's `transaction_amount` to the
    // new plan's price BEFORE applying the plan change locally — fail-closed
    // by design (see that module's JSDoc). If MP rejects the mutation, this
    // code is thrown and the local subscription is left untouched (still on
    // the old plan), so local state and MP state never drift. Maps to HTTP
    // 502 (upstream-provider failure), consistent with DISCOUNT_APPLY_FAILED.
    | 'MP_PREAPPROVAL_MUTATION_FAILED'
    // HOS-211: distinct from MP_PREAPPROVAL_MUTATION_FAILED above — this
    // covers the case where the MP preapproval mutation SUCCEEDED (the new
    // price is already live on MercadoPago) but the subsequent local
    // `billing.subscriptions.changePlan` commit threw. This is a genuine
    // local/MP drift state (MP will charge the new price at trial end while
    // the local row still shows the old plan), not a clean rejection — it
    // is NOT covered by `subscription-poll.job.ts`'s drift reconciler
    // (trialing rows are excluded), so it must page loudly rather than
    // surface as a generic 500. Maps to HTTP 500 (server-side inconsistency,
    // not an upstream provider failure).
    | 'TRIALING_UPGRADE_LOCAL_APPLY_FAILED';

/**
 * Domain-level error thrown across the paid-subscription checkout and
 * reactivation flows. Carries a discriminated `code` so callers can branch
 * on the failure mode without parsing `message`.
 */
export class SubscriptionCheckoutError extends Error {
    constructor(
        public readonly code: SubscriptionCheckoutErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'SubscriptionCheckoutError';
    }
}
