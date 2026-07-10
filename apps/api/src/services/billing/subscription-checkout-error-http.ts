/**
 * Shared HTTP-status mapping for {@link SubscriptionCheckoutError}
 * (HOS-114 T-008).
 *
 * Both `/start-paid` and the two paid-reactivation routes
 * (`/billing/trial/reactivate`, `/billing/trial/reactivate-subscription`)
 * throw `SubscriptionCheckoutError` from the shared paid-checkout helpers
 * (`paid-subscription-create.ts`, `reactivation-plan-guard.ts`). Keeping the
 * code -> HTTP mapping in exactly ONE place means a new error code only
 * needs one exhaustive switch to update, and the two routes' 4xx/5xx
 * behavior can never drift apart.
 *
 * Extracted verbatim from `routes/billing/start-paid.ts`'s
 * `mapServiceErrorToHttp` — no behavior change versus the original inline
 * function.
 *
 * @module services/billing/subscription-checkout-error-http
 */

import { HTTPException } from 'hono/http-exception';
import type { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Map a {@link SubscriptionCheckoutError} to the HTTP exception a route
 * handler should throw. Framework-agnostic error type in, Hono
 * `HTTPException` out — the mapping itself is the only route-facing
 * concern, kept separate from the (framework-agnostic) services that throw
 * the error.
 *
 * @param err - The domain error thrown by a paid-checkout / reactivation helper.
 * @returns The `HTTPException` the caller should `throw`.
 */
export function mapSubscriptionCheckoutErrorToHttp(err: SubscriptionCheckoutError): HTTPException {
    switch (err.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MONTHLY_PRICE':
        case 'NO_ANNUAL_PRICE':
        case 'NO_MATCHING_PRICE':
        case 'CUSTOMER_NOT_FOUND':
        case 'SUBSCRIPTION_NOT_FOUND':
        // HOS-114 T-015b: `reactivateSubscription` has no `canceled`
        // subscription to reactivate from — nothing found, same family as
        // the other *_NOT_FOUND codes above.
        case 'NO_CANCELED_SUBSCRIPTION':
            return new HTTPException(404, { message: err.message });
        case 'INVALID_PROMO_CODE':
        case 'SAME_PLAN':
        case 'NOT_AN_UPGRADE':
        // HOS-114 T-004: thrown by the reactivation plan-resolution guard
        // (`billing/reactivation-plan-guard.ts`) for a `planId` that resolves
        // to a free or annual-only plan — reactivation only supports
        // monthly, paid plans (annual is deferred to HOS-123).
        case 'INVALID_REACTIVATION_PLAN':
        case 'ANNUAL_REACTIVATION_UNSUPPORTED':
            return new HTTPException(422, { message: err.message });
        // HOS-114 T-015b: `reactivateSubscription` rejects the request
        // because the customer already has a live (active/trialing)
        // subscription — a genuine state conflict, not a validation error.
        case 'ACTIVE_SUBSCRIPTION_EXISTS':
            return new HTTPException(409, { message: err.message });
        case 'DISCOUNT_APPLY_FAILED':
            // SPEC-262 T-012 P2: MP rejected our fail-closed discount mutation and
            // the just-created subscription was cancelled. The code itself is valid
            // (so NOT 422) — the payment provider refused the amount change. 502
            // (Bad Gateway) signals an upstream-provider failure, consistent with
            // the SPEC-149 provider-error mapping family.
            return new HTTPException(502, { message: err.message });
        case 'MISSING_INIT_POINT':
            return new HTTPException(500, { message: err.message });
        default: {
            // Defensive: the union should be exhaustive, but TS doesn't
            // enforce that downstream consumers add new codes here. Fall
            // back to a generic 500 with the original message.
            const exhaustive: never = err.code;
            void exhaustive;
            return new HTTPException(500, { message: err.message });
        }
    }
}
