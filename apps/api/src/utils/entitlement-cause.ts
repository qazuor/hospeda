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
    // `NO_ACTIVE_SUBSCRIPTION` is LIVE, emitted by the add-on paths
    // (addon-entitlement.service.ts, addon.checkout.ts) when the customer has a
    // subscription row that is not active or trialing. It used to be attributed
    // here to `requireActiveSubscription()`, a middleware that was mounted
    // nowhere and was deleted by HOS-1012 T-028 — the attribution was wrong
    // even before the deletion.
    'NO_ACTIVE_SUBSCRIPTION',
    // `NO_BILLING_ACCOUNT` has NO emitter since that middleware was deleted.
    // Kept whitelisted rather than removed: its i18n copy still exists and the
    // web client still branches on it, so a route that starts emitting it lands
    // on resolving copy instead of a dropped cause.
    'NO_BILLING_ACCOUNT',
    // addon purchase route (routes/billing/addons.ts, HOS-602) — the
    // customer has zero subscription rows at all, distinct from having one
    // that just isn't active/trialing (NO_ACTIVE_SUBSCRIPTION above). Both
    // resolve to the same client-side "you need an active subscription"
    // gate copy, so they share the whitelist here.
    'NO_SUBSCRIPTION',
    // addon purchase route (HOS-1178) — the product-domain gate's two
    // refusals. Whitelisted for the same reason the four above are: a 422's
    // status-derived `error.code` collapses every rejection into
    // `VALIDATION_ERROR`, so without a forwarded reason the buyer is told
    // "the data you sent is invalid" for a purchase whose data was fine.
    //
    // They are two DIFFERENT remedies and must not be merged:
    //   ADDON_NOT_AVAILABLE_FOR_DOMAIN — you need a subscription in this
    //     add-on's vertical. The buyer can act on that.
    //   ADDON_DOMAIN_UNKNOWN — the add-on declares no vertical at all. Nothing
    //     the buyer does fixes it; it is an operator's catalogue row to correct.
    // Collapsing them would send someone to buy a subscription that would not
    // help. It is also what makes the two paths distinguishable in a test,
    // where both answer 422.
    'ADDON_NOT_AVAILABLE_FOR_DOMAIN',
    'ADDON_DOMAIN_UNKNOWN'
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
