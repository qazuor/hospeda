/**
 * Client-safe reading of an entitlement gate's `HTTPException` cause (HOS-283).
 *
 * The 402 gates (`trialMiddleware`, `pastDueGraceMiddleware`) attach an internal
 * object to `HTTPException.cause` — it carries the whole `trialStatus`, among
 * other things — so the wire response must be built from a whitelist rather than
 * by forwarding the cause. The addon purchase 422 (routes/billing/addons.ts,
 * HOS-602) reuses the same mechanism to forward its service error `code` as
 * `error.reason`, since a 422's status-derived `error.code` collapses several
 * distinct rejection reasons into one generic value.
 *
 * This lives in `utils/` rather than next to either formatter because BOTH of
 * them need it: `createErrorHandler` (middlewares/response.ts, `app.onError`)
 * and `handleRouteError` (utils/response-helpers.ts, every route-factory route).
 * The two have diverged before — that divergence is what let a 402 answer with
 * `INTERNAL_ERROR` in the first place.
 *
 * @module utils/entitlement-cause
 */

/**
 * Cause codes the entitlement middlewares attach to their `HTTPException(402)`.
 * Anything outside this set is dropped rather than forwarded.
 */
const ENTITLEMENT_CAUSE_REASONS: ReadonlySet<string> = new Set([
    // trialMiddleware — mounted globally (create-app.ts), the live case.
    'TRIAL_EXPIRED',
    // pastDueGraceMiddleware — mounted on /api/v1/protected/*. Distinct remedy:
    // the customer updates their payment method, they do not buy a plan.
    'GRACE_PERIOD_EXPIRED',
    // requireActiveSubscription() — NOT mounted anywhere today (it exists only
    // in its own JSDoc example). Whitelisted so the day it is mounted the copy
    // already resolves, but treat these two as dormant, not live.
    'NO_ACTIVE_SUBSCRIPTION',
    'NO_BILLING_ACCOUNT',
    // addon purchase route (routes/billing/addons.ts, HOS-602) — the
    // customer has zero subscription rows at all, distinct from having one
    // that just isn't active/trialing (NO_ACTIVE_SUBSCRIPTION above). Both
    // resolve to the same client-side "you need an active subscription"
    // gate copy, so they share the whitelist here.
    'NO_SUBSCRIPTION'
]);

/** The client-safe projection of an entitlement cause. */
export interface EntitlementCause {
    readonly reason?: string;
    readonly details?: { upgradeAudience?: 'host' | 'tourist'; daysOverdue?: number };
}

/**
 * Extracts the client-safe part of a 402's `cause`.
 *
 * Every field is gated independently — the code against a closed vocabulary, the
 * audience against its two legal values, `daysOverdue` against being a finite
 * number — so an unrecognised cause degrades to `{}` instead of leaking.
 *
 * @param error - The thrown error, normally an `HTTPException`.
 * @returns The whitelisted `reason` and `details`, both possibly absent.
 */
export const readEntitlementCause = (error: Error): EntitlementCause => {
    const cause: unknown = (error as { cause?: unknown }).cause;
    if (cause === null || typeof cause !== 'object') {
        return {};
    }

    const record = cause as Record<string, unknown>;
    const code = record.code;
    const rawAudience = record.upgradeAudience;
    const rawDaysOverdue = record.daysOverdue;

    // A cause whose code is not whitelisted is not one of our gates, so nothing
    // it carries is forwarded — including otherwise well-formed sibling fields.
    if (typeof code !== 'string' || !ENTITLEMENT_CAUSE_REASONS.has(code)) {
        return {};
    }

    const audience: 'host' | 'tourist' | undefined =
        rawAudience === 'host' || rawAudience === 'tourist' ? rawAudience : undefined;
    const daysOverdue =
        typeof rawDaysOverdue === 'number' && Number.isFinite(rawDaysOverdue)
            ? rawDaysOverdue
            : undefined;

    const details: { upgradeAudience?: 'host' | 'tourist'; daysOverdue?: number } = {
        ...(audience === undefined ? {} : { upgradeAudience: audience }),
        ...(daysOverdue === undefined ? {} : { daysOverdue })
    };

    return {
        reason: code,
        ...(Object.keys(details).length > 0 ? { details } : {})
    };
};
